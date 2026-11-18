import type {
  DataRecord,
  PublicAnnotationInput,
  RosettaAnnotationDraft,
  TaskResult,
} from '@stardustai/annotation-client';
import type { IDBPTransaction } from 'idb';
import { connectionProfiles } from '../objectStorage/registry';
import type { StorageSource } from '../objectStorage/types';
import type { Database } from './database';
import { database } from './database';
import { notifyLocalChange } from './events';
import type { LocalImport } from './files';
import { localURL } from './files';
import type { AnnotationSession } from './sessionInfo';
import {
  normalizeSession,
  referencedImportIds,
  sessionRecords,
  sessionSummary,
} from './sessionInfo';
import { configurationKey, inputResults } from './taskInput';
import { localTransaction } from './transaction';
import { stagedFile, stagedImportsFor } from './stagedImports';
export type { AnnotationSession, SessionSummary } from './sessionInfo';

export async function storeImport(
  data: LocalImport,
  signal: AbortSignal,
  onProgress: (value: number) => void,
) {
  return writeImport(data, signal, onProgress);
}

async function writeImport(
  data: LocalImport,
  signal: AbortSignal,
  onProgress: (value: number) => void,
) {
  const db = await database();
  const estimate = await navigator.storage?.estimate?.();
  if (
    estimate?.quota &&
    estimate.usage != null &&
    data.totalSize * 1.1 > estimate.quota - estimate.usage
  )
    throw new Error('浏览器可用空间不足，请减少本次导入数据量');
  const metadata = {
    id: data.id,
    name: data.name,
    count: data.files.length,
    totalSize: data.totalSize,
    createdAt: Date.now(),
  };
  await db.put('imports', { ...metadata, status: 'importing' });
  try {
    let completed = 0;
    for (const entry of data.files) {
      if (signal.aborted) throw new DOMException('已取消导入', 'AbortError');
      await db.put('files', {
        url: localURL(data.id, entry.path),
        blob: entry.file,
        path: entry.path,
        importId: data.id,
      });
      completed += entry.file.size;
      onProgress(Math.round((completed / data.totalSize) * 100));
    }
    if (signal.aborted) throw new DOMException('已取消导入', 'AbortError');
    await db.put('imports', { ...metadata, status: 'ready' });
  } catch (error) {
    await localTransaction(['files', 'imports'], async (tx) => {
      let cursor = await tx
        .objectStore('files')
        .index('importId')
        .openCursor(data.id);
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
      await tx.objectStore('imports').delete(data.id);
    });
    throw error;
  }
}

export async function getLocalFile(url: string) {
  const pending = stagedFile(url);
  if (pending) return pending;
  const file = await (await database()).get('files', url);
  if (!file) throw new Error(`本地文件不存在，请重新导入：${url}`);
  return file.blob;
}

export async function storeGeneratedFile(blob: Blob, filename: string) {
  const id = crypto.randomUUID();
  const path = filename.replace(/[\\/]/g, '_') || 'annotation.bin';
  await writeImport(
    {
      id,
      name: path,
      files: [{ path, file: new File([blob], path) }],
      records: [],
      totalSize: blob.size,
    },
    new AbortController().signal,
    () => {},
  );
  return localURL(id, path);
}
interface SessionSaveOptions {
  name?: string;
  description?: string;
  preserveResults?: boolean;
  requireExisting?: boolean;
  expectedRevision?: number;
}

export async function saveSession(
  input: PublicAnnotationInput,
  id: string = crypto.randomUUID(),
  index?: number,
  previousSources?: StorageSource[],
  options: SessionSaveOptions = {},
) {
  return withStagedImports(input, () =>
    persistSession(input, id, index, previousSources, options),
  );
}

async function withStagedImports<T>(
  input: PublicAnnotationInput,
  operation: () => Promise<T>,
) {
  const ids = stagedImportsFor(input).map((data) => data.id);
  try {
    await persistStagedImports(input);
    return await operation();
  } catch (error) {
    if (ids.length) await releaseUnusedImports(ids).catch(() => {});
    throw error;
  }
}

async function persistStagedImports(input: PublicAnnotationInput) {
  const db = await database();
  for (const data of stagedImportsFor(input)) {
    if ((await db.get('imports', data.id))?.status === 'ready') continue;
    await writeImport(data, new AbortController().signal, () => {});
  }
}

// Recover an unsaved workspace without marking its tasks as submitted.
export async function saveQuickRecovery(
  input: PublicAnnotationInput,
  id: string,
  expectedRevision?: number,
) {
  return withStagedImports(input, () =>
    persistSession(input, id, undefined, undefined, {
      preserveResults: false,
      requireExisting: expectedRevision != null,
      expectedRevision,
    }),
  );
}

// Persist tool configuration while retaining results from other tabs.
export function saveSessionConfigurationDraft(
  id: string,
  input: PublicAnnotationInput,
  expectedRevision: number,
) {
  return withStagedImports(input, () =>
    persistSession(input, id, undefined, undefined, {
      preserveResults: true,
      requireExisting: true,
      expectedRevision,
    }),
  );
}

// Tool overrides can change while another tab commits results for the same data.
function resultRecordKey(record: DataRecord) {
  const copy = structuredClone(record);
  if (copy.metadata?.preprocessedData)
    delete copy.metadata.preprocessedData.operators;
  return JSON.stringify(copy);
}

async function persistSession(
  input: PublicAnnotationInput,
  id: string,
  index: number | undefined,
  previousSources: StorageSource[] | undefined,
  options: SessionSaveOptions,
) {
  const saved = await localTransaction(
    ['sessions', 'taskSummaries', 'files', 'imports'],
    async (tx) => {
      const previous = await tx.objectStore('sessions').get(id);
      if (sessionRecords(input).length !== 1)
        throw new Error(
          '每个任务必须且只能包含一条数据，请使用批量创建拆分数据',
        );
      if (options.requireExisting && !previous)
        throw new Error('本地标注任务已被删除，请返回任务列表');
      if (previous) checkRevision(previous, options.expectedRevision);
      const cloudSources = connectionProfiles(
        input,
        previousSources || previous?.cloudSources,
      );
      // Configuration tabs can hold an older snapshot while another tab saves results.
      // Match records and retain those results instead of overwriting them with defaults.
      const nextInput = structuredClone(input);
      let submittedIndices: number[] = [];
      if (previous) {
        const oldResults = inputResults(previous.input);
        const byRecord = new Map<
          string,
          { result?: TaskResult; submitted: boolean }[]
        >();
        sessionRecords(previous.input).forEach((record, i) => {
          const key = resultRecordKey(record);
          const matches = byRecord.get(key) || [];
          matches.push({
            result: oldResults[i],
            submitted: previous.submittedIndices.includes(i),
          });
          byRecord.set(key, matches);
        });
        const matches = sessionRecords(nextInput).map((record) =>
          byRecord.get(resultRecordKey(record))?.shift(),
        );
        submittedIndices = matches.flatMap((match, index) =>
          match?.submitted ? [index] : [],
        );
        if (
          options.preserveResults &&
          nextInput.taskParams.type === 'include'
        ) {
          nextInput.taskResult = matches[0]?.result ?? nextInput.taskResult;
        } else if (
          options.preserveResults &&
          nextInput.taskParams.type !== 'include'
        ) {
          const params = nextInput.taskParams;
          params.taskResults = params.records.map(
            (_, i) => matches[i]?.result ?? params.taskResults?.[i],
          );
        }
      }
      const value = normalizeSession({
        ...previous,
        id,
        input: nextInput,
        name: options.name?.trim() || previous?.name,
        description: options.description?.trim() ?? previous?.description,
        submittedIndices,
        contentRevision:
          (previous?.contentRevision || 0) +
          (previous &&
          configurationKey(previous.input) !== configurationKey(nextInput)
            ? 1
            : 0),
        index: index ?? previous?.index ?? 0,
        createdAt: previous?.createdAt || Date.now(),
        updatedAt: Date.now(),
        cloudSources,
      });
      await tx.objectStore('sessions').put(value);
      await tx.objectStore('taskSummaries').put(sessionSummary(value));
      if (previous) {
        const currentImports = referencedImportIds(value.input);
        const detached = new Set(
          [...referencedImportIds(previous.input)].filter(
            (id) => !currentImports.has(id),
          ),
        );
        if (detached.size) await cleanupImports(tx, detached);
      }
      return value;
    },
  );
  notifyLocalChange('tasks');
  return saved;
}
export async function loadSession(id: string) {
  const session = await (await database()).get('sessions', id);
  if (!session)
    throw new Error('本地标注任务不存在，请返回独立标注工具重新打开');
  return normalizeSession(session);
}

export async function listSessions() {
  const db = await database();
  const values = await db.getAll('taskSummaries');
  return values.sort((a, b) => b.updatedAt - a.updatedAt);
}

async function updateSession(
  id: string,
  update: (value: AnnotationSession) => void,
) {
  const saved = await localTransaction(
    ['sessions', 'taskSummaries'],
    async (tx) => {
      const stored = await tx.objectStore('sessions').get(id);
      if (!stored) throw new Error('本地标注任务已被删除，请返回任务列表');
      const value = normalizeSession(stored);
      update(value);
      value.updatedAt = Date.now();
      const normalized = normalizeSession(value);
      await tx.objectStore('sessions').put(normalized);
      await tx.objectStore('taskSummaries').put(sessionSummary(normalized));
      return normalized;
    },
  );
  notifyLocalChange('tasks');
  return saved;
}

function checkRevision(session: AnnotationSession, expected?: number) {
  if (expected != null && session.contentRevision !== expected)
    throw new Error(
      '任务数据或工具配置已更新，请刷新当前页面后继续。已有结果已保留。',
    );
}

export interface NewTask {
  name: string;
  description?: string;
  input: PublicAnnotationInput;
  submitted?: boolean;
  cloudSources?: StorageSource[];
}

export async function createTasks(tasks: NewTask[]) {
  if (!tasks.length) throw new Error('请至少添加一个任务');
  const now = Date.now();
  const values = tasks.map((task) => {
    const name = task.name.trim();
    if (!name) throw new Error('请输入任务名称');
    if (name.length > 100) throw new Error('任务名称不能超过 100 个字符');
    const description = task.description?.trim() || '';
    if (description.length > 2000)
      throw new Error('任务说明不能超过 2000 个字符');
    const input = structuredClone<PublicAnnotationInput>(
      task.input || {
        taskParams: { type: 'multiple', records: [], operators: [] },
      },
    );
    if (sessionRecords(input).length !== 1)
      throw new Error(
        '每条数据任务必须且只能包含一条数据，请按单条数据拆分后导入',
      );
    const importedResult =
      inputResults(input)[0] != null && task.submitted !== false;
    return normalizeSession({
      id: crypto.randomUUID(),
      name,
      description,
      input,
      submittedIndices: importedResult ? [0] : [],
      lastSavedAt: importedResult ? now : undefined,
      legacyProgress: false,
      cloudSources: connectionProfiles(input, task.cloudSources),
      createdAt: now,
      updatedAt: now,
    });
  });
  await localTransaction(['sessions', 'taskSummaries'], async (tx) => {
    for (const value of values) {
      await tx.objectStore('sessions').add(value);
      await tx.objectStore('taskSummaries').add(sessionSummary(value));
    }
  });
  notifyLocalChange('tasks');
  return values;
}

export async function createTask(
  name: string,
  input: PublicAnnotationInput,
  description = '',
) {
  return (await createTasks([{ name, description, input }]))[0];
}

export function updateTaskDetails(
  id: string,
  details: { name: string; description: string },
) {
  if (!details.name.trim()) return Promise.reject(new Error('请输入任务名称'));
  return updateSession(id, (value) => {
    value.name = details.name.trim();
    value.description = details.description.trim();
  });
}

export function startSession(id: string, expectedRevision?: number) {
  return updateSession(id, (value) => {
    checkRevision(value, expectedRevision);
    if (!sessionRecords(value.input).length)
      throw new Error('请先为任务导入数据');
    value.status = 'in_progress';
  });
}

export function saveSessionResult(
  id: string,
  result: TaskResult,
  index: number,
  expectedRevision?: number,
) {
  const snapshot = structuredClone(result);
  return updateSession(id, (value) => {
    checkRevision(value, expectedRevision);
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= sessionRecords(value.input).length
    )
      throw new Error('标注数据位置无效，未覆盖已有结果');
    if (value.input.taskParams.type === 'include')
      value.input.taskResult = snapshot;
    else {
      value.input.taskParams.taskResults ||= value.input.taskParams.records.map(
        () => undefined,
      );
      value.input.taskParams.taskResults[index] = snapshot;
    }
    value.lastSavedAt = Date.now();
    value.submittedIndices = [...new Set([...value.submittedIndices, index])];
  });
}

export async function saveSessionDraft(
  id: string,
  draft: RosettaAnnotationDraft,
  expectedRevision: number,
) {
  const snapshot = structuredClone(draft);
  // Recovery retains the editor state and leaves the task unsubmitted.
  const saved = await localTransaction(
    ['sessions', 'taskSummaries', 'files', 'imports'],
    async (tx) => {
      const stored = await tx.objectStore('sessions').get(id);
      if (!stored) throw new Error('本地标注任务已被删除，请返回任务列表');
      checkRevision(stored, expectedRevision);
      const value = normalizeSession(stored);
      if (
        !Number.isInteger(snapshot.index) ||
        snapshot.index < 0 ||
        snapshot.index >= sessionRecords(value.input).length
      )
        throw new Error('标注数据位置无效，未覆盖已有结果');
      const result = snapshot.result;
      if (snapshot.segmentation) {
        const importId = `protection-${id}`;
        const path = `${snapshot.index}.sdbf`;
        const url = localURL(importId, path);
        const blob = new Blob([new Uint8Array(snapshot.segmentation)], {
          type: 'application/octet-stream',
        });
        await tx.objectStore('files').put({ url, blob, path, importId });
        await tx.objectStore('imports').put({
          id: importId,
          name: '标注草稿分割数据',
          count: 1,
          totalSize: blob.size,
          status: 'ready',
          createdAt: Date.now(),
        });
        const input = value.input as PublicAnnotationInput & {
          extraData?: Record<string, unknown>;
          extraDataList?: Record<string, unknown>[];
        };
        if (input.taskParams.type === 'include')
          input.extraData = { ...input.extraData, segmentationDataUrl: url };
        else {
          input.extraDataList ||= input.taskParams.records.map(() => ({}));
          input.extraDataList[snapshot.index] = {
            ...input.extraDataList[snapshot.index],
            segmentationDataUrl: url,
          };
        }
      }
      if (value.input.taskParams.type === 'include')
        value.input.taskResult = result;
      else {
        value.input.taskParams.taskResults ||= sessionRecords(value.input).map(
          () => undefined,
        );
        value.input.taskParams.taskResults[snapshot.index] = result;
      }
      value.index = snapshot.index;
      value.submittedIndices = value.submittedIndices.filter(
        (index) => index !== snapshot.index,
      );
      value.legacyProgress = false;
      value.lastSavedAt = Date.now();
      value.updatedAt = value.lastSavedAt;
      const saved = normalizeSession(value);
      await tx.objectStore('sessions').put(saved);
      await tx.objectStore('taskSummaries').put(sessionSummary(saved));
      return saved;
    },
  );
  notifyLocalChange('tasks');
  return saved;
}

export function saveSessionIndex(
  id: string,
  index: number,
  expectedRevision?: number,
) {
  return updateSession(id, (value) => {
    checkRevision(value, expectedRevision);
    value.index = Math.max(
      0,
      Math.min(index, sessionRecords(value.input).length - 1),
    );
  });
}

export function renameSession(id: string, name: string) {
  if (!name.trim()) return Promise.reject(new Error('请输入任务名称'));
  return updateSession(id, (value) => {
    value.name = name.trim();
  });
}

export async function deleteSession(id: string, expectedRevision?: number) {
  const deleted = await localTransaction(
    ['sessions', 'taskSummaries', 'files', 'imports'],
    async (tx) => {
      const stored = await tx.objectStore('sessions').get(id);
      if (!stored) return false;
      checkRevision(stored, expectedRevision);
      await tx.objectStore('sessions').delete(id);
      await tx.objectStore('taskSummaries').delete(id);
      await cleanupImports(tx, referencedImportIds(stored.input));
      return true;
    },
  );
  if (deleted) notifyLocalChange('tasks');
}

type TaskTransaction = IDBPTransaction<
  Database,
  ('sessions' | 'taskSummaries' | 'files' | 'imports')[],
  'readwrite'
>;
export async function cleanupImports(
  tx: TaskTransaction,
  imports: Set<string>,
) {
  const remaining = await tx.objectStore('sessions').getAll();
  const used = new Set(
    remaining.flatMap((value) => [...referencedImportIds(value.input)]),
  );
  for (const importId of imports) {
    if (used.has(importId)) continue;
    let cursor = await tx
      .objectStore('files')
      .index('importId')
      .openCursor(importId);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.objectStore('imports').delete(importId);
  }
}

export async function removeSessionRecords(
  id: string,
  indices: number[],
  expectedRevision: number,
) {
  if (indices.length !== 1 || indices[0] !== 0)
    throw new Error('每条任务只包含一条数据，请选择有效的数据任务');
  await deleteSession(id, expectedRevision);
}

export async function releaseUnusedImport(id: string) {
  return releaseUnusedImports([id]);
}

export async function releaseUnusedImports(ids: string[]) {
  await localTransaction(
    ['sessions', 'taskSummaries', 'files', 'imports'],
    (tx) => cleanupImports(tx, new Set(ids)),
  );
}
