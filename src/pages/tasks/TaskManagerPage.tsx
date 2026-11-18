import {
  MoreOutlined,
  PlayCircleOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Button,
  Link,
  message,
  useNavigate,
  useSearchParams,
} from '@stardustai/annotation-client';
import { Alert, Dropdown, Input, Modal, Table, Tabs } from 'antd';
import { useEffect, useState } from 'react';
import ExportTaskModal from '../../exports/ExportTaskModal';
import { openSavedAnnotation } from '../../localData/openAnnotation';
import type { SessionSummary, TaskStatus } from '../../localData/sessionInfo';
import { deleteSession, updateTaskDetails } from '../../localData/storage';
import BatchTaskCreateModal from './BatchTaskCreateModal';
import TaskFormModal from './TaskFormModal';
import TaskLayout from './TaskLayout';
import { TaskStatusTag } from './TaskStatus';
import { useTaskList } from './useLocalTasks';

export default function TaskManagerPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const source = search.get('batchSource') || undefined;
  const { tasks, loading, error } = useTaskList();
  const [importOpen, setImportOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<TaskStatus | 'all'>('all');
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState<SessionSummary>();
  const [deleting, setDeleting] = useState<SessionSummary>();
  const [exportId, setExportId] = useState('');
  useEffect(() => {
    if (source) setImportOpen(true);
  }, [source]);
  async function start(id: string) {
    if (busy) return;
    setBusy(id);
    try {
      await openSavedAnnotation(id, null);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setBusy('');
    }
  }
  function closeImport() {
    setImportOpen(false);
    if (source) {
      const next = new URLSearchParams(search);
      next.delete('batchSource');
      setSearch(next, { replace: true });
    }
  }
  const rows = tasks.filter(
    (task) =>
      `${task.name} ${task.description} ${task.source}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (status === 'all' || task.status === status),
  );
  const first = tasks.find((task) => task.status !== 'completed') || tasks[0];
  return (
    <TaskLayout>
      <div className="task-page-heading">
        <div>
          <h1>任务管理</h1>
          <p>导入数据后，选择任务开始标注。</p>
        </div>
        <div className="task-heading-actions">
          <Button
            icon={<PlayCircleOutlined />}
            disabled={!first || !!busy}
            loading={!!busy}
            onClick={() => first && start(first.id)}
          >
            开始标注
          </Button>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={() => setImportOpen(true)}
          >
            新建任务 / 批量创建
          </Button>
        </div>
      </div>
      <div className="task-summary-strip">
        <span>
          任务总数 <strong>{tasks.length}</strong>
        </span>
        <span>
          待标注{' '}
          <strong>
            {tasks.filter((task) => task.status === 'pending').length}
          </strong>
        </span>
        <span>
          标注中{' '}
          <strong>
            {tasks.filter((task) => task.status === 'in_progress').length}
          </strong>
        </span>
        <span>
          已完成{' '}
          <strong>
            {tasks.filter((task) => task.status === 'completed').length}
          </strong>
        </span>
        <small>单条数据或一组连续帧对应一个任务。</small>
      </div>
      {error && (
        <Alert type="error" showIcon message={error} className="mb-4" />
      )}
      <div className="task-list-panel">
        <div className="task-list-filters">
          <Tabs
            activeKey={status}
            onChange={(value) => setStatus(value as any)}
            items={[
              { key: 'all', label: `全部任务 ${tasks.length}` },
              { key: 'pending', label: '待标注' },
              { key: 'in_progress', label: '标注中' },
              { key: 'completed', label: '已完成' },
            ]}
          />
          <Input.Search
            aria-label="搜索任务"
            placeholder="搜索任务名称、说明或来源"
            allowClear
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Table<SessionSummary>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          tableLayout="fixed"
          scroll={{ x: 920 }}
          pagination={{
            defaultPageSize: 20,
            showTotal: (count) => `共 ${count} 个任务`,
          }}
          locale={{
            emptyText: tasks.length
              ? '没有匹配的任务'
              : '还没有任务，点击“新建任务 / 批量创建”导入数据',
          }}
          columns={[
            {
              title: '任务名称',
              render: (_, task) => (
                <div className="task-name-cell">
                  <Link to={`/tasks/${task.id}`}>{task.name}</Link>
                  <span>{task.description || '单条数据任务'}</span>
                </div>
              ),
            },
            {
              title: '状态',
              width: 100,
              render: (_, task) => <TaskStatusTag status={task.status} />,
            },
            {
              title: '类型',
              width: 145,
              dataIndex: 'attachmentType',
              ellipsis: true,
            },
            {
              title: '数据来源',
              width: 200,
              dataIndex: 'source',
              ellipsis: true,
            },
            {
              title: '上次保存',
              width: 175,
              render: (_, task) =>
                task.lastSavedAt
                  ? new Date(task.lastSavedAt).toLocaleString()
                  : '尚未提交',
            },
            {
              title: '操作',
              width: 155,
              render: (_, task) => (
                <div className="task-row-actions">
                  <Button
                    type="link"
                    loading={busy === task.id}
                    disabled={!!busy && busy !== task.id}
                    onClick={() => start(task.id)}
                  >
                    {task.status === 'completed' ? '查看标注' : '进入标注'}
                  </Button>
                  <Dropdown
                    trigger={['click']}
                    menu={{
                      items: [
                        {
                          key: 'detail',
                          label: '查看数据与结果',
                          onClick: () => navigate(`/tasks/${task.id}`),
                        },
                        {
                          key: 'tools',
                          label: '配置标注工具',
                          onClick: () =>
                            navigate(`/annotationTool?task=${task.id}`),
                        },
                        {
                          key: 'export',
                          label: '导出数据与结果',
                          onClick: () => setExportId(task.id),
                        },
                        {
                          key: 'edit',
                          label: '编辑名称和说明',
                          onClick: () => setEditing(task),
                        },
                        { type: 'divider' },
                        {
                          key: 'delete',
                          label: '删除任务',
                          danger: true,
                          onClick: () => setDeleting(task),
                        },
                      ],
                    }}
                  >
                    <Button
                      type="text"
                      aria-label={`${task.name}的操作`}
                      icon={<MoreOutlined />}
                    />
                  </Dropdown>
                </div>
              ),
            },
          ]}
        />
      </div>
      {importOpen && (
        <BatchTaskCreateModal
          initialSourceId={source}
          onCancel={closeImport}
          onCreated={(count) => {
            closeImport();
            message.success(`已创建 ${count} 个任务`);
          }}
        />
      )}
      {editing && (
        <TaskFormModal
          open
          initial={editing}
          onCancel={() => setEditing(undefined)}
          onSubmit={async (details) => {
            await updateTaskDetails(editing.id, details);
            setEditing(undefined);
          }}
        />
      )}
      {exportId && (
        <ExportTaskModal sessionId={exportId} onClose={() => setExportId('')} />
      )}
      <Modal
        title="删除任务"
        open={!!deleting}
        okText="删除"
        okButtonProps={{ danger: true }}
        confirmLoading={busy === 'delete'}
        onCancel={() => !busy && setDeleting(undefined)}
        onOk={async () => {
          if (!deleting || busy) return;
          setBusy('delete');
          try {
            await deleteSession(deleting.id);
            setDeleting(undefined);
          } catch (error) {
            message.error((error as Error).message);
          } finally {
            setBusy('');
          }
        }}
      >
        将删除任务“{deleting?.name}”及其标注结果。
      </Modal>
    </TaskLayout>
  );
}
