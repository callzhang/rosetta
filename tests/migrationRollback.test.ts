import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDB } from 'idb';
import { database } from '../src/localData/database';

test('a code error during task migration aborts every change and leaves the original database recoverable', async () => {
  const old = await openDB('annotation-tool-local', 4, {
    upgrade(db) {
      db.createObjectStore('files', { keyPath: 'url' }).createIndex(
        'importId',
        'importId',
      );
      for (const name of [
        'sessions',
        'taskSummaries',
        'imports',
        'connections',
        'exportSettings',
      ])
        db.createObjectStore(name, { keyPath: 'id' });
    },
  });
  await old.put('sessions', {
    id: 'invalid-old-input',
    input: null,
    name: '保留原数据',
  });
  await old.put('files', {
    url: 'local://old/file',
    importId: 'old',
    blob: new Blob(['preserve-file']),
  });
  old.close();
  await assert.rejects(() => database(), { name: 'AbortError' });
  const restored = await openDB('annotation-tool-local');
  assert.equal(restored.version, 4);
  assert.equal(restored.objectStoreNames.contains('projects'), false);
  assert.equal(
    (await restored.get('sessions', 'invalid-old-input')).name,
    '保留原数据',
  );
  assert.equal(
    await (await restored.get('files', 'local://old/file')).blob.text(),
    'preserve-file',
  );
  restored.close();
});
