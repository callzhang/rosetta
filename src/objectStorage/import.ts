import { t } from '../i18n';
import type { TaskSplit } from '../localData/batchTasks';
import { planTaskFiles } from '../localData/batchTasks';
import { buildResourceRecords, fileKind } from '../localData/files';
import { cloudURL, directoryPrefix } from './paths';
import type { StorageClient, StorageObject, StorageSource } from './types';

export function planCloudTasks(
  objects: StorageObject[],
  split: TaskSplit,
  sequence: boolean,
  prefix: string,
  bucket: string,
) {
  const root = directoryPrefix(prefix);
  return planTaskFiles(
    objects.map((object) => ({
      path: object.key,
      size: object.size,
      value: object,
    })),
    split,
    sequence,
    root,
    root.split('/').filter(Boolean).pop() || bucket,
  );
}

export function abortable<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted)
    return Promise.reject(
      new DOMException(t('Reading canceled'), 'AbortError'),
    );
  return new Promise((resolve, reject) => {
    const abort = () =>
      reject(new DOMException(t('Reading canceled'), 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
}

export async function listDirectoryObjects(
  client: StorageClient,
  prefix: string,
  options: {
    recursive: boolean;
    signal?: AbortSignal;
    onProgress?: (count: number) => void;
  },
) {
  const objects = new Map<string, StorageObject>();
  const visited = new Set<string>();
  let cursor: string | undefined;
  do {
    if (options.signal?.aborted)
      throw new DOMException(t('Reading canceled'), 'AbortError');
    const page = await abortable(
      client.list({
        prefix,
        delimiter: options.recursive ? undefined : '/',
        cursor,
      }),
      options.signal,
    );
    for (const object of page.objects) {
      if (!object.key.startsWith(prefix))
        throw new Error(
          t(
            'Object storage returned files outside the selected directory. Reconnect',
          ),
        );
      if (!object.key.endsWith('/')) objects.set(object.key, object);
    }
    options.onProgress?.(objects.size);
    cursor = page.nextCursor;
    if (cursor && visited.has(cursor))
      throw new Error(
        t(
          'Object storage repeated a pagination token. Reading stopped. Reconnect',
        ),
      );
    if (cursor) visited.add(cursor);
  } while (cursor);
  return [...objects.values()];
}

export function buildCloudImport(
  objects: StorageObject[],
  source: StorageSource,
  sequence: boolean,
) {
  const files = objects.filter(
    (object) =>
      object.size > 0 &&
      fileKind(object.key) &&
      !object.key
        .split('/')
        .some((part) => part.startsWith('.') || part === '__MACOSX'),
  );
  const kinds = [...new Set(files.map((object) => fileKind(object.key)!))];
  if (!kinds.length)
    throw new Error(
      t(
        'The directory contains no supported files. Use PCD/PLY, images, audio, video, or text/documents.',
      ),
    );
  if (kinds.length > 1)
    throw new Error(
      t(
        'The directory contains multiple data types. Import them from separate subdirectories; use JSON/JSONL for multisensor associations.',
      ),
    );
  const kind = kinds[0];
  const records = buildResourceRecords(
    files.map((object) => ({
      path: object.key,
      name: object.key.split('/').pop()!,
      url: cloudURL(source.provider, source.bucket, object.key),
    })),
    kind,
    sequence,
  );
  return {
    records,
    kind,
    fileCount: files.length,
    skippedCount: objects.length - files.length,
    totalSize: files.reduce((sum, item) => sum + item.size, 0),
  };
}
