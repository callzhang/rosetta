import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { database } from '../src/localData/database';
import { sessionRecords } from '../src/localData/sessionInfo';
import {
  getLocalFile,
  listSessions,
  loadSession,
} from '../src/localData/storage';
import { inputResults } from '../src/localData/taskInput';

const result = (note: string) => ({
  annotations: [],
  notes: [note],
  issues: [],
});
test('version-4 migration splits containers into flat tasks and retains drafts, sequences, timestamps, credentials and bookmark IDs', async () => {
  const old = await openDB('annotation-tool-local', 4, {
    upgrade(db) {
      db.createObjectStore('files', { keyPath: 'url' }).createIndex(
        'importId',
        'importId',
      );
      for (const store of [
        'imports',
        'sessions',
        'taskSummaries',
        'connections',
        'exportSettings',
      ])
        db.createObjectStore(store, { keyPath: 'id' });
    },
  });
  const sequence = {
    attachmentType: 'POINTCLOUD_SEQUENCE',
    attachment: [
      { name: '1.pcd', url: 'local://import/1.pcd' },
      { name: '2.pcd', url: 'local://import/2.pcd' },
    ],
  };
  const image = {
    attachmentType: 'IMAGE',
    attachment: 'https://data.example.test/image.png',
  };
  const meta = {
    createdAt: 100,
    updatedAt: 200,
    description: '要求',
    contentRevision: 4,
    lastSavedAt: 180,
    cloudSources: [],
  };
  await old.put('sessions', {
    ...meta,
    id: 'multi',
    name: '旧批次',
    index: 1,
    submittedIndices: [0],
    input: {
      algorithms: [{ name: 'retained-algorithm' }],
      extraDataList: [{ source: 'sequence' }, { source: 'image' }],
      taskParams: {
        type: 'multiple',
        operators: [{ key: 'existing-tool' }],
        records: [sequence, image],
        taskResults: [result('sequence-result'), result('image-result')],
      },
    },
  });
  const draftInput = {
    taskParams: {
      type: 'multiple',
      records: [],
      operators: [{ key: 'draft-tool' }],
    },
  };
  await old.put('sessions', {
    ...meta,
    id: 'empty',
    name: '旧草稿',
    index: 0,
    submittedIndices: [],
    input: draftInput,
  });
  await old.put('sessions', {
    ...meta,
    id: 'empty-include',
    name: '旧空单条草稿',
    index: 0,
    submittedIndices: [],
    input: {
      taskParams: { type: 'include', value: { record: {}, operators: [] } },
    },
  });
  await old.put('sessions', {
    ...meta,
    id: 'single',
    name: '单条历史数据',
    index: 0,
    submittedIndices: [0],
    input: {
      taskParams: { type: 'include', value: { record: image, operators: [] } },
      taskResult: result('single-result'),
    },
  });
  await old.put('sessions', {
    ...meta,
    id: 'multi::data:0',
    name: '碰撞检查',
    index: 0,
    submittedIndices: [],
    input: {
      taskParams: { type: 'multiple', operators: [], records: [image] },
    },
  });
  const connection = {
    id: 'oss://fixture',
    name: '私有源',
    connection: { accessKeySecret: 'fixture-secret' },
    createdAt: 1,
    updatedAt: 2,
  };
  const settings = {
    id: 'default',
    defaultMethod: 'api',
    api: {
      url: 'https://api.example.test',
      method: 'POST',
      headers: [{ name: 'Authorization', value: 'fixture-token' }],
    },
    updatedAt: 3,
  };
  await old.put('connections', connection);
  await old.put('exportSettings', settings);
  await old.put('files', {
    url: 'local://import/1.pcd',
    importId: 'import',
    path: '1.pcd',
    blob: new Blob(['original']),
  });
  old.close();
  const db = await database();
  assert.equal(db.version, 7);
  const tasks = await listSessions();
  const current = await loadSession('multi');
  assert.deepEqual(sessionRecords(current.input), [image]);
  assert.deepEqual(inputResults(current.input), [result('image-result')]);
  assert.equal(current.contentRevision, 5);
  assert.deepEqual((current.input as any).extraDataList, [{ source: 'image' }]);
  const sequenceTask = await loadSession('multi::data:0:copy');
  assert.equal(sequenceTask.id, 'multi::data:0:copy');
  assert.deepEqual(sessionRecords(sequenceTask.input), [sequence]);
  assert.deepEqual(inputResults(sequenceTask.input), [
    result('sequence-result'),
  ]);
  assert.deepEqual(sequenceTask.submittedIndices, [0]);
  assert.equal(sequenceTask.input.algorithms?.[0].name, 'retained-algorithm');
  const archived = await db.getAll('projects');
  assert.equal(archived.length, 5);
  assert.deepEqual(
    archived.find((item) => item.legacySessionId === 'empty')!.inputTemplate,
    draftInput,
  );
  assert.ok(
    !tasks.some((task) => task.id === 'empty' || task.id === 'empty-include'),
  );
  assert.equal(current.createdAt, 100);
  assert.equal(current.updatedAt, 200);
  assert.equal((await loadSession('single')).name, '单条历史数据');
  assert.equal(
    sessionRecords((await loadSession('multi::data:0')).input).length,
    1,
  );
  assert.equal((await listSessions()).length, 4);
  assert.ok(
    (await listSessions()).every(
      (task) => task.count === 1 && !('projectId' in task),
    ),
  );
  assert.deepEqual(await db.get('connections', connection.id), connection);
  assert.deepEqual(await db.get('exportSettings', settings.id), settings);
  assert.equal(
    await (await getLocalFile('local://import/1.pcd')).text(),
    'original',
  );
  assert.ok(
    !JSON.stringify(await db.getAll('sessions')).includes('fixture-secret'),
  );
});
