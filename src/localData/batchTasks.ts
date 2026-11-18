import { t, getLanguage } from '../i18n';
import type { DataKind, LocalFile } from './files';
import { fileKind, normalizePath } from './files';

export type TaskSplit = 'file' | 'folder';

export interface TaskGroup<T> {
  key: string;
  name: string;
  path: string;
  kind: DataKind;
  mixedKinds: boolean;
  sequence: boolean;
  files: T[];
  recordCount: number;
  fileCount?: number;
  totalSize: number;
}

export type LocalTaskGroup = TaskGroup<LocalFile>;

// Each group produces one record: a file, or consecutive frames in one exact directory.
export function planLocalTasks(
  entries: LocalFile[],
  split: TaskSplit,
  sequence: boolean,
  root = '',
) {
  const prefix = root ? `${normalizePath(root)}/` : '';
  return planTaskFiles(
    entries.map((entry) => {
      const path = normalizePath(entry.path);
      return { path, size: entry.file.size, value: { ...entry, path } };
    }),
    split,
    sequence,
    prefix,
    root.split('/').filter(Boolean).pop() || t('Local files'),
  );
}

export function planTaskFiles<T>(
  entries: { path: string; size: number; value: T }[],
  split: TaskSplit,
  sequence: boolean,
  prefix: string,
  rootName: string,
) {
  const groups = new Map<string, TaskGroup<T>>();
  const compare = new Intl.Collator(getLanguage(), { numeric: true });
  const seen = new Set<string>();
  let skippedCount = 0;
  for (const entry of [...entries].sort((a, b) =>
    compare.compare(a.path, b.path),
  )) {
    const path = entry.path;
    const kind = fileKind(path);
    if (
      !kind ||
      !entry.size ||
      path
        .split('/')
        .some((part) => part.startsWith('.') || part === '__MACOSX')
    ) {
      skippedCount++;
      continue;
    }
    if (prefix && !path.startsWith(prefix))
      throw new Error(
        t(
          'The file is outside the selected parent folder or directory. Select it again',
        ),
      );
    if (seen.has(path))
      throw new Error(t('Duplicate file path: {{v0}}', { v0: path }));
    seen.add(path);
    const relative = path.slice(prefix.length);
    const continuous =
      split === 'folder' && sequence && ['pointcloud', 'image'].includes(kind);
    const directory = path.includes('/')
      ? path.slice(0, path.lastIndexOf('/'))
      : '';
    const scope = continuous ? directory : path;
    const key = JSON.stringify([split, scope, kind]);
    let group = groups.get(key);
    if (!group) {
      const name = continuous
        ? directory.split('/').filter(Boolean).pop() || rootName
        : relative;
      group = {
        key,
        name,
        path: scope.replace(/\/$/, '') || t('Selected files'),
        kind,
        mixedKinds: false,
        sequence: continuous,
        files: [],
        recordCount: 0,
        totalSize: 0,
      };
      groups.set(key, group);
    }
    group.files.push(entry.value);
    group.totalSize += entry.size;
  }
  const tasks = [...groups.values()].sort(
    (a, b) =>
      compare.compare(a.path, b.path) || compare.compare(a.kind, b.kind),
  );
  const kindsByPath = new Map<string, Set<DataKind>>();
  for (const task of tasks) {
    const kinds = kindsByPath.get(task.path) || new Set<DataKind>();
    kinds.add(task.kind);
    kindsByPath.set(task.path, kinds);
  }
  for (const task of tasks) {
    task.mixedKinds = kindsByPath.get(task.path)!.size > 1;
    task.recordCount = 1;
  }
  return { tasks, skippedCount };
}
