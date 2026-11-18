import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { database } from '../src/localData/database';
import { sessionRecords } from '../src/localData/sessionInfo';
import {
  createTask,
  listSessions,
  loadSession,
  saveSessionResult,
} from '../src/localData/storage';
import { inputResults } from '../src/localData/taskInput';
import './offlineFixture';

test('version-5 tasks become independent without changing IDs, results, files or settings', async () => {
  const old = await openDB('annotation-tool-local', 5, {
    upgrade(db) {
      db.createObjectStore('files', { keyPath: 'url' }).createIndex(
        'importId',
        'importId',
      );
      for (const name of [
        'imports',
        'connections',
        'exportSettings',
        'projects',
      ])
        db.createObjectStore(name, { keyPath: 'id' });
      for (const name of ['sessions', 'taskSummaries'])
        db.createObjectStore(name, { keyPath: 'id' }).createIndex(
          'projectId',
          'projectId',
        );
    },
  });
  const groups = [
    {
      id: 'group-a',
      name: '旧分组 A',
      description: '说明 A',
      createdAt: 10,
      updatedAt: 20,
    },
    {
      id: 'group-b',
      name: '旧分组 B',
      description: '',
      createdAt: 10,
      updatedAt: 20,
    },
    {
      id: 'empty',
      name: '原有空草稿',
      description: '',
      createdAt: 10,
      updatedAt: 20,
      inputTemplate: {
        taskParams: {
          type: 'multiple',
          records: [],
          operators: [{ key: 'draft-tool' }],
        },
      },
    },
  ];
  for (const group of groups) await old.put('projects', group);
  const sequence = {
    attachmentType: 'POINTCLOUD_SEQUENCE',
    attachment: [
      { name: '1.pcd', url: 'local://original/1.pcd' },
      { name: '2.pcd', url: 'local://original/2.pcd' },
    ],
  };
  const result = { annotations: [], notes: ['已保存结果'], issues: [] };
  const tasks = [
    {
      id: 'retained-task-a',
      projectId: 'group-a',
      name: '重复任务名称',
      description: '独立说明 A',
      input: {
        taskParams: {
          type: 'multiple',
          records: [sequence],
          operators: [{ key: 'retained-tool' }],
          taskResults: [result],
        },
      },
      index: 0,
      submittedIndices: [0],
      contentRevision: 7,
      legacyProgress: false,
      status: 'completed',
      createdAt: 100,
      updatedAt: 200,
      lastSavedAt: 190,
      cloudSources: [],
    },
    {
      id: 'retained-task-b',
      projectId: 'group-b',
      name: '重复任务名称',
      description: '独立说明 B',
      input: {
        taskParams: {
          type: 'multiple',
          records: [
            {
              attachmentType: 'IMAGE',
              attachment: 'https://data.example.test/a.png',
            },
          ],
          operators: [],
        },
      },
      index: 0,
      submittedIndices: [],
      contentRevision: 2,
      legacyProgress: false,
      status: 'pending',
      createdAt: 300,
      updatedAt: 400,
    },
  ];
  for (const task of tasks) {
    await old.put('sessions', task);
    await old.put('taskSummaries', {
      id: task.id,
      projectId: task.projectId,
      count: 1,
    });
  }
  const connection = {
    id: 'fixture-source',
    connection: { accessKeySecret: 'fixture-only-secret' },
  };
  const settings = {
    id: 'default',
    defaultMethod: 'api',
    api: { url: 'https://api.example.test', method: 'POST', headers: [] },
    updatedAt: 1,
  };
  await old.put('connections', connection);
  await old.put('exportSettings', settings);
  await old.put('files', {
    url: 'local://original/1.pcd',
    importId: 'original',
    path: '1.pcd',
    blob: new Blob(['original-bytes']),
  });
  old.close();

  const db = await database();
  assert.equal(db.version, 7);
  const summaries = await listSessions();
  assert.deepEqual(
    summaries.map((task) => task.id).sort(),
    tasks.map((task) => task.id).sort(),
  );
  for (const task of tasks) {
    const { projectId: _legacy, ...expected } = task;
    assert.deepEqual(await loadSession(task.id), expected);
    assert.equal(sessionRecords((await loadSession(task.id)).input).length, 1);
  }
  assert.ok(
    summaries.every((task) => !('projectId' in task) && task.count === 1),
  );
  assert.equal(
    db.transaction('sessions').store.indexNames.contains('projectId' as never),
    false,
  );
  assert.equal(
    db
      .transaction('taskSummaries')
      .store.indexNames.contains('projectId' as never),
    false,
  );
  assert.deepEqual(
    await db.getAll('projects'),
    [...groups].sort((a, b) => a.id.localeCompare(b.id)),
  );
  assert.equal(
    await (await db.get('files', 'local://original/1.pcd'))!.blob.text(),
    'original-bytes',
  );
  assert.deepEqual(await db.get('connections', connection.id), connection);
  assert.deepEqual(await db.get('exportSettings', settings.id), settings);
  assert.deepEqual(inputResults((await loadSession(tasks[0].id)).input), [
    result,
  ]);

  // New writes work without any grouping; saving a task changes no other task.
  const created = await createTask('新任务', tasks[1].input as any);
  assert.ok(!('projectId' in created));
  await saveSessionResult(
    created.id,
    result as any,
    0,
    created.contentRevision,
  );
  assert.deepEqual(
    await loadSession(tasks[1].id),
    (({ projectId, ...rest }) => rest)(tasks[1]),
  );
  assert.deepEqual(
    await db.getAll('projects'),
    [...groups].sort((a, b) => a.id.localeCompare(b.id)),
  );
});
