import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { database } from '../src/localData/database';
import {
  createTask,
  deleteSession,
  getLocalFile,
  loadSession,
  saveSessionConfigurationDraft,
  saveSessionDraft,
  saveSessionResult,
} from '../src/localData/storage';
import './offlineFixture';

const input = {
  taskParams: {
    type: 'include' as const,
    value: {
      version: '1.0.0',
      record: {
        attachmentType: 'IMAGE' as const,
        attachment: 'https://fixture.example/image.png',
      },
      operators: [],
    },
  },
} as any;
const result = {
  annotations: [],
  notes: ['自动保存前的修改'],
  issues: [],
} as any;
const draft = { params: input.taskParams.value, result, index: 0 };

test('protection saves a recoverable draft without completing the task and commits segmentation bytes with it', async () => {
  const task = await createTask('保护自动保存', input);
  await saveSessionResult(
    task.id,
    { ...result, notes: ['previous submission'] },
    0,
  );
  assert.equal((await loadSession(task.id)).status, 'completed');
  const saved = await saveSessionDraft(
    task.id,
    { ...draft, segmentation: new Uint8Array([1, 2, 3, 4]) },
    task.contentRevision,
  );
  assert.equal(saved.status, 'in_progress');
  assert.deepEqual(saved.submittedIndices, []);
  assert.equal(saved.index, 0);
  assert.ok(saved.lastSavedAt);
  const restored = await loadSession(task.id);
  const restoredResult =
    restored.input.taskParams.type === 'include'
      ? restored.input.taskResult!
      : restored.input.taskParams.taskResults![0]!;
  assert.deepEqual(restoredResult.notes, result.notes);
  const url = (restored.input as any).extraData.segmentationDataUrl as string;
  assert.ok(url.startsWith('local://protection-'));
  assert.deepEqual(
    Array.from(new Uint8Array(await (await getLocalFile(url)).arrayBuffer())),
    [1, 2, 3, 4],
  );
  assert.equal(
    result.metadata,
    undefined,
    'save must not mutate the live snapshot',
  );
  const db = await database();
  const previous = structuredClone(restored);
  await assert.rejects(
    () => saveSessionDraft(task.id, draft, task.contentRevision + 1),
    /配置已更新/,
  );
  await assert.rejects(
    () =>
      saveSessionDraft(task.id, { ...draft, index: 2 }, task.contentRevision),
    /位置无效/,
  );
  assert.deepEqual(await loadSession(task.id), previous);
  await deleteSession(task.id);
  assert.equal(
    await db.get('files', url),
    undefined,
    'deleting the task also releases its recovery labels',
  );
});

test('a failed IndexedDB transaction rolls back both labels and results and does not report a successful save', async () => {
  const task = await createTask('存储失败保护', input);
  const before = await loadSession(task.id);
  const db = await database();
  const files = await db.getAll('files');
  const imports = await db.getAll('imports');
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (value, key) {
    if (this.name === 'taskSummaries')
      throw new DOMException('存储空间不足', 'QuotaExceededError');
    return put.call(this, value, key);
  };
  try {
    await assert.rejects(
      () =>
        saveSessionDraft(
          task.id,
          { ...draft, segmentation: new Uint8Array([9]) },
          task.contentRevision,
        ),
      /存储空间不足/,
    );
  } finally {
    IDBObjectStore.prototype.put = put;
  }
  assert.deepEqual(await loadSession(task.id), before);
  assert.deepEqual(await db.getAll('files'), files);
  assert.deepEqual(await db.getAll('imports'), imports);
  assert.equal(
    (await db.getAll('saveReports')).filter(
      (report) => report.taskId === task.id,
    ).length,
    0,
  );
});

test('emergency drafts save locally while signed out, unlicensed and offline without authorizing a normal save', async () => {
  const task = await createTask('授权失败保护', input);
  const fetch = globalThis.fetch;
  let requests = 0;
  try {
    const reports = await (await database()).getAll('saveReports');
    globalThis.fetch = async () => {
      requests++;
      throw new Error('offline');
    };
    const saved = await saveSessionDraft(task.id, draft, task.contentRevision);
    assert.equal(saved.status, 'in_progress');
    assert.deepEqual(
      (await loadSession(task.id)).input.taskResult?.notes,
      result.notes,
    );
    const config = structuredClone(input);
    config.taskParams.value.operators = [{ id: 'local-operator' }];
    const configuration = await saveSessionConfigurationDraft(
      task.id,
      config,
      saved.contentRevision,
    );
    assert.equal(configuration.input.taskParams.type, 'include');
    if (configuration.input.taskParams.type !== 'include')
      throw new Error('Expected include parameters');
    assert.deepEqual(
      configuration.input.taskParams.value.operators,
      config.taskParams.value.operators,
    );
    assert.deepEqual(configuration.input.taskResult?.notes, result.notes);
    assert.equal(
      requests,
      0,
      'recovery must not contact the login or license service',
    );
    assert.deepEqual(await (await database()).getAll('saveReports'), reports);

    await saveSessionResult(task.id, result, 0, configuration.contentRevision);
    assert.equal((await loadSession(task.id)).status, 'completed');
  } finally {
    globalThis.fetch = fetch;
  }
});
