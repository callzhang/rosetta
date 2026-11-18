import {
  FolderOpenOutlined,
  InboxOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { DataRecord } from '@stardustai/annotation-client';
import {
  Button,
  useNavigate,
  validateSchema,
} from '@stardustai/annotation-client';
import { Alert, Input, Modal, Progress, Radio, Table, Tabs } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { TaskGroup, TaskSplit } from '../../localData/batchTasks';
import { planLocalTasks } from '../../localData/batchTasks';
import { inputsFromJSON, tasksFromInput } from '../../localData/dataTasks';
import { useLocalFileDrop } from '../../localData/useLocalFileDrop';
import type { LocalFile, LocalImport } from '../../localData/files';
import {
  stageImport,
  releaseStagedImports,
} from '../../localData/stagedImports';
import { prepareQuickDraft } from '../../localData/quickDrafts';
import {
  buildLocalImport,
  formatSize,
  fromFileList,
} from '../../localData/files';
import { buildFileTree } from '../../localData/fileTree';
import {
  createDefaultOperators,
  dataKindLabels,
} from '../../localData/presets';
import { kindFromRecord } from '../../localData/recordKind';
import { sessionRecords } from '../../localData/sessionInfo';
import type { NewTask } from '../../localData/storage';
import {
  createTasks,
  releaseUnusedImports,
  storeImport,
} from '../../localData/storage';
import { storageError } from '../../objectStorage/adapters';
import type { CloudDirectorySelection } from '../../objectStorage/CloudDirectoryBrowser';
import CloudDirectoryBrowser from '../../objectStorage/CloudDirectoryBrowser';
import {
  buildCloudImport,
  listDirectoryObjects,
  planCloudTasks,
} from '../../objectStorage/import';
import type { StorageObject, StorageSource } from '../../objectStorage/types';

function defaultName(task: TaskGroup<unknown>) {
  return `${task.name}${
    task.mixedKinds ? ` · ${dataKindLabels[task.kind]}` : ''
  }`.slice(0, 100);
}

export default function BatchTaskCreateModal({
  initialSourceId,
  onCancel,
  onCreated,
}: {
  initialSourceId?: string;
  onCancel: () => void;
  onCreated: (count: number) => void;
}) {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController>();
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [mode, setMode] = useState<'local' | 'cloud' | 'json'>(
    initialSourceId ? 'cloud' : 'local',
  );
  const [directory, setDirectory] = useState<CloudDirectorySelection>();
  const [cloudFiles, setCloudFiles] = useState<StorageObject[]>();
  const [jsonText, setJsonText] = useState('');
  const [jsonName, setJsonName] = useState('data.json');
  const [readCount, setReadCount] = useState(0);
  const [root, setRoot] = useState('');
  const [split, setSplit] = useState<TaskSplit>(
    initialSourceId ? 'folder' : 'file',
  );
  const sequence = true;
  const [selected, setSelected] = useState<string[]>();
  const [names, setNames] = useState<Record<string, string>>({});
  const [description, setDescription] = useState('');
  const [phase, setPhase] = useState<'idle' | 'reading' | 'files' | 'tasks'>(
    'idle',
  );
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const busy = phase !== 'idle';
  const { collecting, dragging, getRootProps } = useLocalFileDrop({
    disabled: busy,
    onFiles: (entries) =>
      pick(
        entries,
        entries.some((entry) => entry.path.includes('/')),
      ),
    onError: (error) => setError(error.message),
  });
  useEffect(() => () => controller.current?.abort(), []);
  const localPlan = useMemo(() => {
    try {
      return { ...planLocalTasks(files, split, sequence, root), error: '' };
    } catch (error) {
      return { tasks: [], skippedCount: 0, error: (error as Error).message };
    }
  }, [files, split, sequence, root]);
  const cloudPlan = useMemo(() => {
    try {
      return {
        ...planCloudTasks(
          cloudFiles || [],
          split,
          sequence,
          directory?.prefix || '',
          directory?.connected.source.bucket || '',
        ),
        error: '',
      };
    } catch (error) {
      return { tasks: [], skippedCount: 0, error: (error as Error).message };
    }
  }, [cloudFiles, split, sequence, directory]);
  const jsonPlan = useMemo(() => {
    try {
      const tasks = jsonText.trim()
        ? inputsFromJSON(jsonText, jsonName, (record) =>
            createDefaultOperators(kindFromRecord(record)!),
          )
            .flatMap((input) => {
              const check = validateSchema('PublicAnnotationInput', input);
              if (!check.valid) throw new Error(check.errorMessage);
              return tasksFromInput(input, jsonName.replace(/\.jsonl?$/i, ''));
            })
            .map((task, index) => ({
              key: `json:${index}`,
              name: task.name,
              path: jsonName,
              kind: kindFromRecord(sessionRecords(task.input!)[0]) || 'text',
              mixedKinds: false,
              sequence: sessionRecords(task.input!)[0].attachmentType.includes(
                'SEQUENCE',
              ),
              files: [task.input],
              recordCount: 1,
              fileCount: buildFileTree(sessionRecords(task.input!)).count,
              totalSize: new Blob([JSON.stringify(task.input)]).size,
              input: task.input!,
              submitted: task.submitted,
            }))
        : [];
      return { tasks, skippedCount: 0, error: '' };
    } catch (error) {
      return { tasks: [], skippedCount: 0, error: (error as Error).message };
    }
  }, [jsonText, jsonName]);
  const plan: {
    tasks: TaskGroup<unknown>[];
    skippedCount: number;
    error: string;
  } = mode === 'json' ? jsonPlan : mode === 'cloud' ? cloudPlan : localPlan;
  const selectedKeys = useMemo(() => selected && new Set(selected), [selected]);
  const selectedTasks = plan.tasks.filter(
    (task) => !selectedKeys || selectedKeys.has(task.key),
  );
  const totalSize = selectedTasks.reduce(
    (sum, task) => sum + task.totalSize,
    0,
  );
  const nameError = selectedTasks.some(
    (task) => !(names[task.key] ?? defaultName(task)).trim(),
  );

  function pick(entries: LocalFile[], folder: boolean) {
    if (!entries.length) {
      setError('没有找到文件，请重新选择');
      return;
    }
    const firstRoot = entries[0].path.split('/')[0];
    setRoot(
      folder && entries.every((entry) => entry.path.startsWith(`${firstRoot}/`))
        ? firstRoot
        : '',
    );
    setFiles(entries);
    setSplit(folder ? 'folder' : 'file');
    setSelected(undefined);
    setNames({});
    setError('');
    setProgress(0);
  }

  async function readDirectory() {
    if (!directory || busy || controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setPhase('reading');
    setError('');
    setReadCount(0);
    try {
      const objects = await listDirectoryObjects(
        directory.connected.client,
        directory.prefix,
        { recursive: true, signal: abort.signal, onProgress: setReadCount },
      );
      if (abort.signal.aborted)
        throw new DOMException('已取消读取', 'AbortError');
      setCloudFiles(objects);
      setSelected(undefined);
      setNames({});
    } catch (error) {
      setError(
        (error as Error).name === 'AbortError'
          ? '已取消读取目录，未创建任务'
          : storageError(error),
      );
    } finally {
      controller.current = undefined;
      setPhase('idle');
    }
  }

  function prepareTask(
    task: TaskGroup<unknown>,
    records: DataRecord[],
    source?: StorageSource,
  ): NewTask {
    for (const record of records) {
      const check = validateSchema('DataRecord', record);
      if (!check.valid) throw new Error(check.errorMessage);
    }
    return {
      name: (names[task.key] ?? defaultName(task)).trim(),
      description,
      cloudSources: source ? [source] : undefined,
      input: {
        taskParams: {
          type: 'multiple',
          records,
          operators: createDefaultOperators(task.kind),
        },
      },
    };
  }

  async function collectTasks(onLocal: (data: LocalImport) => Promise<void>) {
    const pending: NewTask[] = [];
    if (mode === 'local') {
      for (const task of localPlan.tasks.filter(
        (task) => !selectedKeys || selectedKeys.has(task.key),
      )) {
        const data = buildLocalImport(
          task.files,
          task.kind,
          task.sequence,
          crypto.randomUUID(),
        );
        const pendingTask = prepareTask(task, data.records);
        await onLocal(data);
        pending.push(pendingTask);
      }
    } else if (mode === 'cloud') {
      if (!directory || !cloudFiles)
        throw new Error('请先选择云端目录并读取数据清单');
      for (const task of cloudPlan.tasks.filter(
        (task) => !selectedKeys || selectedKeys.has(task.key),
      )) {
        const data = buildCloudImport(
          task.files,
          directory.connected.source,
          task.sequence,
        );
        pending.push(
          prepareTask(task, data.records, directory.connected.source),
        );
      }
    } else {
      for (const task of jsonPlan.tasks.filter(
        (task) => !selectedKeys || selectedKeys.has(task.key),
      ))
        pending.push({
          name: (names[task.key] ?? task.name).trim(),
          description,
          input: task.input,
          submitted: task.submitted,
        });
    }
    return pending;
  }

  async function previewSelection() {
    if (busy || collecting || !selectedTasks.length || nameError || plan.error)
      return;
    const owner = {};
    setPhase('tasks');
    setError('');
    try {
      const tasks = await collectTasks(async (data) =>
        stageImport(owner, data),
      );
      const id = prepareQuickDraft(tasks, owner);
      onCancel();
      navigate(`/annotationTool?draft=${id}`);
    } catch (error) {
      releaseStagedImports(owner);
      setError((error as Error).message || '无法预览数据');
    } finally {
      setPhase('idle');
    }
  }

  async function submit() {
    if (
      controller.current ||
      busy ||
      !selectedTasks.length ||
      nameError ||
      plan.error
    )
      return;
    const abort = new AbortController();
    controller.current = abort;
    setPhase(mode === 'local' ? 'files' : 'tasks');
    setError('');
    setProgress(0);
    const importIds: string[] = [];
    let committed = false;
    try {
      let completed = 0;
      const pending = await collectTasks(async (data) => {
        importIds.push(data.id);
        await storeImport(data, abort.signal, (value) =>
          setProgress(
            Math.round(
              ((completed + (data.totalSize * value) / 100) / totalSize) * 100,
            ),
          ),
        );
        completed += data.totalSize;
      });
      setProgress(100);
      if (abort.signal.aborted)
        throw new DOMException('已取消导入', 'AbortError');
      setPhase('tasks');
      const created = await createTasks(pending);
      committed = true;
      onCreated(created.length);
    } catch (error) {
      if (!committed && importIds.length) {
        try {
          await releaseUnusedImports(importIds);
        } catch {
          setError(
            '本次任务未创建，部分临时文件未能清理。请检查浏览器本地存储。',
          );
          return;
        }
      }
      setError(
        (error as Error).name === 'AbortError'
          ? '已取消导入，未创建任务。可调整清单后重试。'
          : (error as Error).message || '批量创建失败，请重试',
      );
    } finally {
      controller.current = undefined;
      setPhase('idle');
    }
  }

  return (
    <Modal
      title="新建任务 / 批量创建"
      open
      width={960}
      style={{ top: 32 }}
      bodyStyle={{ maxHeight: 'calc(100vh - 210px)', overflowY: 'auto' }}
      maskClosable={!busy && !collecting}
      closable={!busy && !collecting}
      keyboard={!busy && !collecting}
      onCancel={onCancel}
      footer={
        <div className="batch-task-footer">
          <span>
            已选择 {selectedTasks.length} 个任务 · {formatSize(totalSize)}
          </span>
          <Button
            disabled={collecting || phase === 'tasks'}
            onClick={() => (busy ? controller.current?.abort() : onCancel())}
          >
            {phase === 'reading'
              ? '取消读取'
              : phase === 'files'
              ? '取消导入'
              : '取消'}
          </Button>
          <Button
            disabled={
              busy ||
              collecting ||
              !selectedTasks.length ||
              nameError ||
              !!plan.error
            }
            onClick={previewSelection}
          >
            预览并配置工具
          </Button>
          <Button
            type="primary"
            loading={phase === 'files' || phase === 'tasks'}
            disabled={
              busy ||
              collecting ||
              !selectedTasks.length ||
              nameError ||
              !!plan.error
            }
            onClick={submit}
          >
            {phase === 'tasks'
              ? '正在创建任务'
              : `创建 ${selectedTasks.length} 个任务`}
          </Button>
        </div>
      }
    >
      <Tabs
        activeKey={mode}
        onChange={(value) => {
          setMode(value as 'local' | 'cloud' | 'json');
          setSelected(undefined);
          setNames({});
          setError('');
          if (value === 'cloud') {
            setDirectory(undefined);
            setCloudFiles(undefined);
          }
          setSplit(
            value === 'cloud' || files.some((entry) => entry.path.includes('/'))
              ? 'folder'
              : 'file',
          );
        }}
        items={[
          { key: 'local', label: '本地文件', disabled: busy || collecting },
          { key: 'cloud', label: '对象存储', disabled: busy || collecting },
          { key: 'json', label: 'JSON / JSONL', disabled: busy || collecting },
        ]}
      />
      <p className="batch-task-intro">
        每条数据创建一个任务。多选文件即可批量创建；同目录的连续帧可合并为一条数据。
      </p>
      <div style={{ display: mode === 'local' ? undefined : 'none' }}>
        <div
          {...getRootProps()}
          className={`batch-task-drop${dragging ? ' is-dragging' : ''}`}
        >
          <InboxOutlined />
          <div>
            <strong>
              {collecting ? '正在读取文件…' : '拖入文件或父文件夹'}
            </strong>
            <p>PCD / PLY、图片、音视频、文本与文档</p>
          </div>
          <div className="batch-task-pickers">
            <Button
              icon={<UploadOutlined />}
              disabled={busy || collecting}
              onClick={() => fileInput.current?.click()}
            >
              选择多个文件
            </Button>
            <Button
              icon={<FolderOpenOutlined />}
              disabled={busy || collecting}
              onClick={() => folderInput.current?.click()}
            >
              选择父文件夹
            </Button>
          </div>
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            if (event.target.files?.length)
              pick(fromFileList(event.target.files), false);
            event.target.value = '';
          }}
        />
      </div>
      {mode === 'cloud' && (
        <div className="batch-cloud-source">
          <CloudDirectoryBrowser
            initialSourceId={initialSourceId}
            disabled={busy}
            onChange={(value) => {
              setDirectory(value);
              setCloudFiles(undefined);
              setSelected(undefined);
              setNames({});
              setError('');
            }}
          />
          <div className="batch-cloud-read">
            <span className="batch-task-hint">
              只保存文件引用，标注时按需读取原文件。清单包含所选目录的所有子目录。
            </span>
            <Button disabled={!directory || busy} onClick={readDirectory}>
              读取目录生成清单
            </Button>
          </div>
        </div>
      )}
      <input
        ref={folderInput}
        type="file"
        multiple
        hidden
        {...{ webkitdirectory: '', directory: '' }}
        onChange={(event) => {
          if (event.target.files?.length)
            pick(fromFileList(event.target.files), true);
          event.target.value = '';
        }}
      />
      {mode === 'json' && (
        <div className="task-json-import">
          <label>
            上传 PublicAnnotationInput JSON 或 DataRecord JSONL{' '}
            <input
              type="file"
              accept=".json,.jsonl"
              disabled={busy}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setJsonName(file.name);
                setJsonText(await file.text());
                setSelected(undefined);
                setNames({});
                event.target.value = '';
              }}
            />
          </label>
          <Input.TextArea
            rows={7}
            value={jsonText}
            disabled={busy}
            aria-label="JSON 数据"
            placeholder="也可粘贴 PublicAnnotationInput JSON，包含多条数据时自动拆分。"
            onChange={(event) => {
              setJsonText(event.target.value);
              setSelected(undefined);
              setNames({});
            }}
          />
        </div>
      )}
      {mode !== 'json' && (
        <div className="batch-task-options">
          <span>数据拆分</span>
          <Radio.Group
            value={split}
            disabled={busy || collecting}
            onChange={(event) => {
              setSplit(event.target.value);
              setSelected(undefined);
              setNames({});
              setError('');
            }}
          >
            <Radio value="file">每个文件一个任务</Radio>
            <Radio
              value="folder"
              disabled={
                mode === 'local' &&
                !files.some((entry) => entry.path.includes('/'))
              }
            >
              同目录连续帧
            </Radio>
          </Radio.Group>
        </div>
      )}
      <p className="batch-task-hint">
        {split === 'folder'
          ? '同一个实际目录内的点云或图片组成一条连续帧数据；其他文件逐个创建，子目录分别处理。'
          : '每个文件创建一个独立任务。点云或图片连续帧请放在同一目录，选择“同目录连续帧”。'}
      </p>
      <div className="batch-task-preview-heading">
        <strong>
          任务清单 <span>{plan.tasks.length} 个</span>
        </strong>
        <span>可修改任务名称，取消勾选不需要的任务</span>
      </div>
      <Table<TaskGroup<unknown>>
        size="small"
        rowKey="key"
        dataSource={plan.tasks}
        scroll={{ x: 710 }}
        pagination={{
          defaultPageSize: 5,
          showSizeChanger: false,
          size: 'small',
        }}
        rowSelection={{
          selectedRowKeys: selectedTasks.map((task) => task.key),
          onChange: (keys) => setSelected(keys as string[]),
          getCheckboxProps: () => ({ disabled: busy || collecting }),
        }}
        locale={{
          emptyText:
            mode === 'cloud'
              ? cloudFiles
                ? '当前目录没有可标注的文件'
                : '选择数据源和目录，点击“读取目录生成清单”'
              : files.length
              ? '没有可标注的文件，请重新选择'
              : '选择文件或父文件夹后，在这里预览数据',
        }}
        columns={[
          {
            title: '任务名称',
            width: 230,
            render: (_, task) => (
              <Input
                aria-label={`${task.path}的任务名称`}
                value={names[task.key] ?? defaultName(task)}
                maxLength={100}
                status={
                  selectedTasks.includes(task) &&
                  !(names[task.key] ?? defaultName(task)).trim()
                    ? 'error'
                    : undefined
                }
                disabled={busy || collecting}
                onChange={(event) =>
                  setNames((current) => ({
                    ...current,
                    [task.key]: event.target.value,
                  }))
                }
              />
            ),
          },
          { title: '来源', dataIndex: 'path', ellipsis: true },
          {
            title: '类型',
            width: 125,
            render: (_, task) =>
              `${dataKindLabels[task.kind]}${task.sequence ? '连续帧' : ''}`,
          },
          {
            title: '文件 / 数据',
            width: 105,
            render: (_, task) =>
              `${task.fileCount ?? task.files.length} / ${task.recordCount}`,
          },
        ]}
      />
      {!!plan.skippedCount && (
        <p className="batch-task-hint">
          已忽略 {plan.skippedCount} 个不支持、隐藏或空文件。
        </p>
      )}
      {!!plan.tasks.length && (
        <label className="batch-task-description">
          标注说明（应用到本次所有任务）
          <Input.TextArea
            rows={2}
            maxLength={2000}
            showCount
            value={description}
            disabled={busy || collecting}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="可选，填写这批数据的标注要求"
          />
        </label>
      )}
      {busy && (
        <div className="batch-task-progress">
          <span>
            {phase === 'reading'
              ? `正在读取目录，已发现 ${readCount} 个文件…`
              : phase === 'files'
              ? '正在保存本地文件…'
              : '正在创建任务…'}
          </span>
          {phase !== 'reading' && (
            <Progress percent={progress} status="active" />
          )}
        </div>
      )}
      {(error || plan.error || nameError) && (
        <Alert
          className="mt-3"
          type="error"
          showIcon
          message={error || plan.error || '请补全已勾选数据的名称'}
        />
      )}
    </Modal>
  );
}
