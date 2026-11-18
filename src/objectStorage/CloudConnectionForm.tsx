import { Button } from '@stardustai/annotation-client';
import { Alert, Checkbox, Form, Input, Popconfirm, Select } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createStorageClient, storageError } from './adapters';
import { defaultEndpoint, normalizeConnection, publicSource } from './paths';
import { rememberConnection } from './registry';
import { deleteSavedConnection, saveConnection } from './savedConnections';
import type {
  SavedStorageConnection,
  StorageClient,
  StorageConnection,
  StoragePage,
  StorageSource,
} from './types';
import { defaultRegions, providerLabels } from './types';
import { useSavedConnections } from './useSavedConnections';

export interface ConnectedStorage {
  source: StorageSource;
  client: StorageClient;
  page: StoragePage;
}

export default function CloudConnectionForm({
  initial,
  fixedSource = false,
  showSavedConnections = true,
  editing,
  manage = false,
  onSaved,
  onCancel,
  onBusyChange,
  onConnected,
}: {
  initial?: Partial<StorageSource>;
  fixedSource?: boolean;
  showSavedConnections?: boolean;
  editing?: SavedStorageConnection;
  manage?: boolean;
  onSaved?: (value: SavedStorageConnection) => void;
  onCancel?: () => void;
  onBusyChange?: (busy: boolean) => void;
  onConnected?: (value: ConnectedStorage) => void;
}) {
  const [form] = Form.useForm<
    StorageConnection & { connectionName?: string; remember: boolean }
  >();
  const [provider, setProvider] = useState(initial?.provider || 'oss');
  const { sources, loading, error: loadError } = useSavedConnections();
  const saved = useMemo(
    () =>
      sources.filter(
        (value) =>
          !fixedSource ||
          (value.connection.provider === initial?.provider &&
            value.connection.bucket === initial?.bucket &&
            (!initial?.region || initial.region === value.connection.region) &&
            (!initial?.endpoint ||
              initial.endpoint === value.connection.endpoint)),
      ),
    [
      sources,
      fixedSource,
      initial?.provider,
      initial?.bucket,
      initial?.region,
      initial?.endpoint,
    ],
  );
  const [selectedId, setSelectedId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tested, setTested] = useState(false);
  const request = useRef(0);
  const hydrated = useRef(false);
  const sourceKey = JSON.stringify(initial);
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);
  function selectSaved(value?: SavedStorageConnection) {
    const connection = value?.connection;
    setSelectedId(value?.id);
    setProvider(connection?.provider || initial?.provider || 'oss');
    form.setFieldsValue({
      provider: initial?.provider || 'oss',
      region: defaultRegions[initial?.provider || 'oss'],
      bucket: '',
      endpoint: '',
      prefix: '',
      accessKeyId: '',
      accessKeySecret: '',
      securityToken: '',
      ...initial,
      ...connection,
      connectionName: value?.name || '',
      remember: true,
    });
    setError('');
    setTested(false);
  }
  useEffect(() => {
    hydrated.current = false;
    setBusy(false);
    selectSaved(editing);
    return () => {
      request.current++;
    };
  }, [editing?.id, manage, showSavedConnections, sourceKey]);
  useEffect(() => {
    if (manage || !showSavedConnections || loading || hydrated.current) return;
    hydrated.current = true;
    if (saved[0]) selectSaved(saved[0]);
  }, [manage, showSavedConnections, loading, saved, sourceKey]);

  async function testConnection() {
    const current = ++request.current;
    try {
      const values = await form.validateFields();
      if (current !== request.current) return;
      const connection = normalizeConnection(values);
      setBusy(true);
      setError('');
      setTested(false);
      const client = await createStorageClient(connection);
      if (current !== request.current) return;
      await client.list({ prefix: connection.prefix, delimiter: '/' });
      if (current === request.current) setTested(true);
    } catch (error) {
      if (
        current === request.current &&
        !(error && typeof error === 'object' && 'errorFields' in error)
      )
        setError(storageError(error));
    } finally {
      if (current === request.current) setBusy(false);
    }
  }
  return (
    <Form
      form={form}
      preserve={false}
      disabled={busy}
      layout="vertical"
      initialValues={{
        provider: 'oss',
        region: defaultRegions[initial?.provider || 'oss'],
        prefix: '',
        remember: true,
        ...initial,
      }}
      onValuesChange={() => {
        setTested(false);
        setError('');
      }}
      onFinish={async (values) => {
        const current = ++request.current;
        setBusy(true);
        setError('');
        let connection: StorageConnection;
        let saving = false;
        try {
          connection = normalizeConnection(values);
        } catch (error) {
          setError((error as Error).message);
          setBusy(false);
          return;
        }
        try {
          const client = await createStorageClient(connection);
          if (current !== request.current) return;
          if (manage) {
            saving = true;
            const saved = await saveConnection(
              connection,
              values.connectionName,
              {
                previousId: editing?.id,
                requireNew: !editing,
              },
            );
            if (current !== request.current) return;
            rememberConnection(connection, client);
            onSaved?.(saved);
            return;
          }
          const page = await client.list({
            prefix: connection.prefix,
            delimiter: '/',
          });
          if (current !== request.current) return;
          saving = true;
          if (values.remember)
            await saveConnection(connection, values.connectionName);
          else await deleteSavedConnection(connection);
          if (current !== request.current) return;
          rememberConnection(connection, client);
          form.setFieldsValue({
            accessKeyId: '',
            accessKeySecret: '',
            securityToken: '',
          });
          onConnected?.({ source: publicSource(connection), client, page });
        } catch (error) {
          if (current === request.current)
            setError(
              manage
                ? (error as Error).message || '保存数据源失败，请重试'
                : saving
                ? '连接成功，但保存到本机失败。请检查浏览器可用空间，或取消“保存连接到本机”后重试。'
                : storageError(error),
            );
        } finally {
          if (current === request.current) setBusy(false);
        }
      }}
    >
      {!manage && showSavedConnections && saved.length > 0 && (
        <div className="cloud-saved-connection">
          <span>已保存连接</span>
          <Select
            aria-label="已保存连接"
            value={selectedId}
            disabled={busy}
            allowClear
            placeholder="选择已保存的连接"
            options={saved.map((value) => ({
              value: value.id,
              label: `${
                value.name
              } · ${value.connection.provider.toUpperCase()} / ${
                value.connection.bucket
              }`,
            }))}
            onChange={(id) =>
              selectSaved(saved.find((value) => value.id === id))
            }
          />
          {selectedId && (
            <Popconfirm
              title="删除本机保存的连接？"
              onConfirm={async () => {
                const value = saved.find((item) => item.id === selectedId);
                if (!value) return;
                try {
                  await deleteSavedConnection(value.connection);
                  selectSaved();
                } catch {
                  setError('删除连接失败，请重试。');
                }
              }}
            >
              <Button disabled={busy}>删除连接</Button>
            </Popconfirm>
          )}
        </div>
      )}
      <div className="cloud-connection-fields">
        <Form.Item
          name="connectionName"
          label={manage ? '数据源名称' : '连接名称（可选）'}
          rules={
            manage
              ? [
                  {
                    required: true,
                    whitespace: true,
                    message: '请输入数据源名称',
                  },
                  { max: 100 },
                ]
              : []
          }
        >
          <Input
            disabled={busy}
            placeholder="例如 训练集 / 测试数据"
            maxLength={100}
          />
        </Form.Item>
        <Form.Item
          name="provider"
          label="对象存储"
          rules={[{ required: true }]}
        >
          <Select
            disabled={fixedSource || busy}
            options={Object.entries(providerLabels).map(([value, label]) => ({
              value,
              label,
            }))}
            onChange={(value) => {
              setProvider(value);
              setSelectedId(undefined);
              form.setFieldsValue({
                region: defaultRegions[value],
                endpoint: '',
                accessKeyId: '',
                accessKeySecret: '',
                securityToken: '',
              });
            }}
          />
        </Form.Item>
        <Form.Item
          name="bucket"
          label="Bucket"
          rules={[{ required: true, message: '请输入 Bucket 名称' }]}
        >
          <Input
            disabled={fixedSource || busy}
            placeholder="例如 my-annotation-data"
            autoComplete="off"
            spellCheck={false}
          />
        </Form.Item>
        <Form.Item
          name="region"
          label="Region"
          rules={[{ required: true, message: '请输入 Bucket 所在地域' }]}
        >
          <Input
            disabled={busy}
            placeholder={defaultRegions[provider]}
            autoComplete="off"
            spellCheck={false}
          />
        </Form.Item>
        <Form.Item name="endpoint" label="Endpoint（可选，默认按地域生成）">
          <Input
            disabled={busy}
            placeholder={defaultEndpoint(provider, defaultRegions[provider])}
            autoComplete="off"
            spellCheck={false}
          />
        </Form.Item>
        <Form.Item
          name="accessKeyId"
          label="AccessKey ID"
          rules={[{ required: true, message: '请输入 AK' }]}
        >
          <Input.Password disabled={busy} autoComplete="off" placeholder="AK" />
        </Form.Item>
        <Form.Item
          name="accessKeySecret"
          label="Secret AccessKey"
          rules={[{ required: true, message: '请输入 SK' }]}
        >
          <Input.Password
            disabled={busy}
            autoComplete="new-password"
            placeholder="SK"
          />
        </Form.Item>
        <Form.Item
          name="securityToken"
          label="Security Token（临时凭证时填写）"
        >
          <Input.Password
            disabled={busy}
            autoComplete="off"
            placeholder="使用长期 AK/SK 时留空"
          />
        </Form.Item>
        <Form.Item name="prefix" label="起始目录（可选）">
          <Input
            disabled={busy}
            placeholder="例如 dataset/scene-01/"
            autoComplete="off"
            spellCheck={false}
          />
        </Form.Item>
      </div>
      {!manage && (
        <Form.Item name="remember" valuePropName="checked">
          <Checkbox disabled={busy}>
            保存连接到本机（包含 AK / SK 和 Token）
          </Checkbox>
        </Form.Item>
      )}
      <p className="cloud-storage-note">
        {manage
          ? '连接信息保存在此浏览器。测试连接会检查起始目录的读取权限。'
          : '保存后可在此浏览器复用。连接需要目录列举、文件读取权限，以及 GET、HEAD 跨域配置。'}
      </p>
      {(error || (!manage && showSavedConnections && loadError)) && (
        <Alert
          type="error"
          showIcon
          message={error || loadError}
          className="cloud-storage-error"
        />
      )}
      {tested && (
        <Alert
          type="success"
          showIcon
          message="连接成功，目录可以读取"
          className="cloud-storage-error"
        />
      )}
      <div className="cloud-form-actions">
        {manage && (
          <>
            <Button disabled={busy} onClick={onCancel}>
              取消
            </Button>
            <Button disabled={busy} onClick={testConnection}>
              测试连接
            </Button>
          </>
        )}
        <Button type="primary" htmlType="submit" loading={busy}>
          {manage ? '保存数据源' : '连接并读取目录'}
        </Button>
      </div>
    </Form>
  );
}
