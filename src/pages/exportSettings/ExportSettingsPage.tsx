import {
  CloudUploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  LinkOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { Button, message, useNavigate } from '@stardustai/annotation-client';
import { Alert, Form, Input, Segmented, Select, Spin } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { saveExportSettings } from '../../exports/settings';
import type { ExportMethod, ExportSettings } from '../../exports/types';
import { useExportSettings } from '../../exports/useExportSettings';
import { useSavedConnections } from '../../objectStorage/useSavedConnections';
import TaskLayout from '../tasks/TaskLayout';

export default function ExportSettingsPage() {
  const navigate = useNavigate();
  const { settings, loading, error: loadError } = useExportSettings();
  const {
    sources,
    loading: sourcesLoading,
    error: sourceError,
  } = useSavedConnections();
  const [form] = Form.useForm<ExportSettings>();
  const method: ExportMethod =
    Form.useWatch('defaultMethod', form) || 'download';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const hydrated = useRef(false);
  useEffect(() => {
    if (!settings || hydrated.current) return;
    hydrated.current = true;
    form.setFieldsValue({
      ...settings,
      api: settings.api || { url: '', method: 'POST', headers: [] },
      storage: settings.storage || {
        sourceId: undefined,
        prefix: 'annotation-results/',
      },
    });
  }, [settings, form]);
  return (
    <TaskLayout
      actions={<Button onClick={() => navigate('/tasks')}>返回任务列表</Button>}
      footer={
        <>
          <span className="workspace-footer-note">设置保存在此浏览器</span>
          <Button
            type="primary"
            loading={busy}
            disabled={loading || !settings}
            onClick={() => form.submit()}
          >
            保存设置
          </Button>
        </>
      }
    >
      <div className="task-page-heading">
        <div>
          <h1>导出设置</h1>
          <p>选择导出方式，填写接收地址。</p>
        </div>
      </div>
      {(error || loadError || sourceError) && (
        <Alert
          type="error"
          showIcon
          className="mb-4"
          message={error || loadError || sourceError}
        />
      )}
      {loading ? (
        <div className="task-loading">
          <Spin />
        </div>
      ) : (
        settings && (
          <Form
            className="export-settings-form"
            layout="vertical"
            form={form}
            disabled={busy}
            onValuesChange={() => setError('')}
            onFinish={async () => {
              setBusy(true);
              setError('');
              try {
                const saved = await saveExportSettings(
                  form.getFieldsValue(true),
                );
                form.setFieldsValue({
                  ...saved,
                  api: saved.api || { url: '', method: 'POST', headers: [] },
                  storage: saved.storage || {
                    sourceId: undefined,
                    prefix: 'annotation-results/',
                  },
                });
                message.success('导出设置已保存');
              } catch (error) {
                setError((error as Error).message || '保存失败，请重试');
              } finally {
                setBusy(false);
              }
            }}
          >
            <section className="export-settings-switch">
              <h2>导出方式</h2>
              <p>保存后设为默认导出方式。</p>
              <Form.Item name="defaultMethod" initialValue="download">
                <Segmented
                  block
                  disabled={busy}
                  aria-label="导出方式"
                  options={[
                    {
                      value: 'download',
                      label: '本地下载',
                      icon: <DownloadOutlined />,
                    },
                    { value: 'api', label: 'API', icon: <LinkOutlined /> },
                    {
                      value: 'storage',
                      label: '对象存储',
                      icon: <CloudUploadOutlined />,
                    },
                  ]}
                />
              </Form.Item>
            </section>
            {method === 'download' && (
              <section className="export-settings-section export-settings-local">
                <DownloadOutlined />
                <h2>下载标注结果到本机</h2>
                <p>下载 JSON，包含数据引用、工具配置和已保存结果。</p>
              </section>
            )}
            {method === 'api' && (
              <section
                className="export-settings-section"
                aria-label="API 导出配置"
              >
                <h2>API 导出</h2>
                <p>发送 JSON，接口返回 HTTP 2xx 时完成导出。</p>
                <div className="export-api-address">
                  <Form.Item name={['api', 'method']} label="请求方法">
                    <Select
                      options={['POST', 'PUT'].map((value) => ({
                        value,
                        label: value,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item
                    name={['api', 'url']}
                    label="接收地址"
                    extra="支持 {taskId} 占位符，例如 https://example.com/api/tasks/{taskId}/annotations"
                  >
                    <Input
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="https://example.com/api/annotations"
                    />
                  </Form.Item>
                </div>
                <div className="export-headers-label">
                  请求头（可选，用于 Authorization、X-API-Key 等鉴权）
                </div>
                <Form.List name={['api', 'headers']}>
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map((field) => (
                        <div className="export-header-row" key={field.key}>
                          <Form.Item name={[field.name, 'name']}>
                            <Input
                              aria-label="请求头名称"
                              placeholder="例如 Authorization"
                              autoComplete="off"
                            />
                          </Form.Item>
                          <Form.Item name={[field.name, 'value']}>
                            <Input.Password
                              aria-label="请求头内容"
                              placeholder="例如 Bearer token"
                              autoComplete="new-password"
                            />
                          </Form.Item>
                          <Button
                            icon={<DeleteOutlined />}
                            aria-label="删除请求头"
                            onClick={() => remove(field.name)}
                          />
                        </div>
                      ))}
                      <Button
                        icon={<PlusOutlined />}
                        onClick={() => add({ name: '', value: '' })}
                      >
                        添加请求头
                      </Button>
                    </>
                  )}
                </Form.List>
                <p className="export-settings-note">
                  请求体为 PublicAnnotationInput
                  JSON。接口需允许本站的跨域请求，鉴权请求头保存在本机。
                </p>
              </section>
            )}
            {method === 'storage' && (
              <section
                className="export-settings-section"
                aria-label="对象存储导出配置"
              >
                <h2>对象存储导出</h2>
                <p>选择 OSS、OBS 或 TOS 数据源，上传任务 JSON。</p>
                <Form.Item
                  name={['storage', 'sourceId']}
                  label="目标数据源"
                  extra="在“数据源”中管理连接。"
                >
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    loading={sourcesLoading}
                    placeholder="选择数据源"
                    options={sources.map((source) => ({
                      value: source.id,
                      label: `${
                        source.name
                      } · ${source.connection.provider.toUpperCase()} / ${
                        source.connection.bucket
                      }`,
                    }))}
                    onChange={(id) => {
                      const source = sources.find((value) => value.id === id);
                      form.setFieldsValue({
                        storage: {
                          prefix: `${
                            source?.connection.prefix || ''
                          }annotation-results/`,
                        },
                      });
                    }}
                  />
                </Form.Item>
                <Form.Item
                  name={['storage', 'prefix']}
                  label="导出目录"
                  extra="填写 Bucket 内的目录前缀，每次导出生成新文件。"
                >
                  <Input
                    placeholder="例如 annotation-results/"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Form.Item>
                <p className="export-settings-note">
                  目标凭证需允许该目录的 PutObject 上传，Bucket 的 CORS
                  需允许本站的 PUT 请求。
                </p>
              </section>
            )}
          </Form>
        )
      )}
    </TaskLayout>
  );
}
