import {
  CloudServerOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { Button, message, useNavigate } from '@stardustai/annotation-client';
import { Alert, Dropdown, Input, Modal, Table, Tabs } from 'antd';
import { useState } from 'react';
import {
  createStorageClient,
  storageError,
} from '../../objectStorage/adapters';
import CloudConnectionForm from '../../objectStorage/CloudConnectionForm';
import { deleteSavedConnection } from '../../objectStorage/savedConnections';
import type {
  SavedStorageConnection,
  StorageProvider,
} from '../../objectStorage/types';
import { useSavedConnections } from '../../objectStorage/useSavedConnections';
import TaskLayout from '../tasks/TaskLayout';

export default function DataSourcesPage() {
  const navigate = useNavigate();
  const { sources, loading, error } = useSavedConnections();
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState<StorageProvider | 'all'>('all');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SavedStorageConnection>();
  const [formBusy, setFormBusy] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [deleting, setDeleting] = useState<SavedStorageConnection>();
  function openForm(value?: SavedStorageConnection) {
    setEditing(value);
    setFormBusy(false);
    setFormOpen(true);
  }
  async function testConnection(source: SavedStorageConnection) {
    setBusyId(source.id);
    try {
      const client = await createStorageClient(source.connection);
      await client.list({ prefix: source.connection.prefix, delimiter: '/' });
      message.success(`「${source.name}」连接成功，目录可以读取`);
    } catch (error) {
      message.error(storageError(error));
    } finally {
      setBusyId('');
    }
  }
  const matching = sources.filter((source) =>
    `${source.name} ${source.connection.provider} ${source.connection.bucket} ${source.connection.region} ${source.connection.endpoint} ${source.connection.prefix}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  return (
    <TaskLayout
      actions={<Button onClick={() => navigate('/tasks')}>返回任务列表</Button>}
    >
      <div className="task-page-heading">
        <div>
          <h1>数据源</h1>
          <p>保存对象存储连接，后续创建任务时直接选择。</p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openForm()}
        >
          新建数据源
        </Button>
      </div>
      {error && (
        <Alert type="error" showIcon message={error} className="mb-4" />
      )}
      <div className="task-list-panel">
        <div className="task-list-filters">
          <Tabs
            activeKey={provider}
            onChange={(key) => {
              setProvider(key as StorageProvider | 'all');
              setPage(1);
            }}
            items={['all', 'oss', 'obs', 'tos'].map((value) => ({
              key: value,
              label: `${value === 'all' ? '全部数据源' : value.toUpperCase()} ${
                matching.filter(
                  (source) =>
                    value === 'all' || source.connection.provider === value,
                ).length
              }`,
            }))}
          />
          <Input.Search
            aria-label="搜索数据源"
            allowClear
            placeholder="搜索名称、Bucket 或目录"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <Table<SavedStorageConnection>
          rowKey="id"
          loading={loading}
          tableLayout="fixed"
          scroll={{ x: 1050 }}
          dataSource={matching.filter(
            (source) =>
              provider === 'all' || source.connection.provider === provider,
          )}
          pagination={{
            current: page,
            onChange: setPage,
            defaultPageSize: 10,
            showSizeChanger: true,
            showTotal: (count) => `共 ${count} 个数据源`,
            locale: { items_per_page: '条/页' },
          }}
          locale={{
            emptyText: sources.length ? (
              '没有匹配的数据源'
            ) : (
              <div className="task-data-empty">
                <strong>还没有保存的数据源</strong>
                <p>添加 OSS、OBS 或 TOS 连接，后续直接选择使用。</p>
                <Button type="primary" onClick={() => openForm()}>
                  新建数据源
                </Button>
              </div>
            ),
          }}
          columns={[
            {
              title: '数据源名称',
              render: (_, source) => (
                <div className="task-name-row">
                  <span className="task-folder-icon">
                    <CloudServerOutlined />
                  </span>
                  <div className="task-name-cell">
                    <span className="data-source-name" title={source.name}>
                      {source.name}
                    </span>
                    <span title={source.connection.endpoint}>
                      {source.connection.endpoint}
                    </span>
                  </div>
                </div>
              ),
            },
            {
              title: '类型',
              width: 80,
              render: (_, source) => source.connection.provider.toUpperCase(),
            },
            {
              title: 'Bucket / 起始目录',
              width: 240,
              render: (_, source) => (
                <div className="data-source-location">
                  <span title={source.connection.bucket}>
                    {source.connection.bucket}
                  </span>
                  <small title={source.connection.prefix}>
                    {source.connection.prefix || 'Bucket 根目录'}
                  </small>
                </div>
              ),
            },
            {
              title: '地域',
              width: 130,
              render: (_, source) => source.connection.region,
            },
            {
              title: '操作',
              width: 290,
              render: (_, source) => (
                <div className="task-row-actions">
                  <Button
                    size="small"
                    disabled={!!busyId}
                    onClick={() =>
                      navigate(
                        `/tasks?batchSource=${encodeURIComponent(source.id)}`,
                      )
                    }
                  >
                    批量创建任务
                  </Button>
                  <Button
                    type="text"
                    size="small"
                    disabled={!!busyId}
                    onClick={() => openForm(source)}
                  >
                    编辑
                  </Button>
                  <Dropdown
                    disabled={!!busyId}
                    trigger={['click']}
                    menu={{
                      items: [
                        {
                          key: 'test',
                          label:
                            busyId === source.id ? '正在测试…' : '测试连接',
                          onClick: () => void testConnection(source),
                        },
                        { type: 'divider' },
                        {
                          key: 'delete',
                          danger: true,
                          label: '删除数据源',
                          onClick: () => setDeleting(source),
                        },
                      ],
                    }}
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<MoreOutlined />}
                      loading={busyId === source.id}
                    >
                      更多
                    </Button>
                  </Dropdown>
                </div>
              ),
            },
          ]}
        />
      </div>
      {formOpen && (
        <Modal
          title={editing ? '编辑数据源' : '新建数据源'}
          open
          width={760}
          style={{ top: 32 }}
          bodyStyle={{ maxHeight: 'calc(100vh - 190px)', overflowY: 'auto' }}
          footer={null}
          maskClosable={!formBusy}
          closable={!formBusy}
          keyboard={!formBusy}
          onCancel={() => setFormOpen(false)}
        >
          <CloudConnectionForm
            manage
            editing={editing}
            onBusyChange={setFormBusy}
            onCancel={() => setFormOpen(false)}
            onSaved={() => {
              setFormOpen(false);
              setProvider('all');
              setQuery('');
              setPage(1);
              message.success('数据源已保存');
            }}
          />
        </Modal>
      )}
      <Modal
        title="删除数据源"
        open={!!deleting}
        okText="删除数据源"
        cancelText="保留"
        okButtonProps={{ danger: true }}
        confirmLoading={!!busyId}
        onCancel={() => !busyId && setDeleting(undefined)}
        onOk={async () => {
          if (!deleting) return;
          setBusyId(deleting.id);
          try {
            await deleteSavedConnection(deleting.connection);
            setDeleting(undefined);
            setPage(1);
            message.success('已删除本机数据源配置');
          } catch (error) {
            message.error((error as Error).message || '删除失败，请重试');
          } finally {
            setBusyId('');
          }
        }}
      >
        删除数据源「{deleting?.name}」的本地连接配置？
      </Modal>
    </TaskLayout>
  );
}
