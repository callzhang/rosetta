import { Button, Link } from '@stardustai/annotation-client';
import { Alert, Descriptions, Modal, Radio, Spin, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import type { SessionExport } from '../localData/export';
import { prepareSessionExport } from '../localData/export';
import { formatSize } from '../localData/files';
import { useSavedConnections } from '../objectStorage/useSavedConnections';
import type { ExportReceipt } from './deliver';
import { deliverExport } from './deliver';
import { apiExportURL } from './settings';
import type { ExportMethod } from './types';
import { useExportSettings } from './useExportSettings';

export default function ExportTaskModal({
  sessionId,
  onClose,
  open = true,
}: {
  sessionId: string;
  onClose: () => void;
  open?: boolean;
}) {
  const {
    settings,
    loading: settingsLoading,
    error: settingsError,
  } = useExportSettings();
  const {
    sources,
    loading: sourcesLoading,
    error: sourcesError,
  } = useSavedConnections();
  const [payload, setPayload] = useState<SessionExport>();
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<ExportMethod>('download');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<ExportReceipt>();
  const initialized = useRef(false);
  const sending = useRef(false);
  const source = sources.find(
    (value) => value.id === settings?.storage?.sourceId,
  );
  useEffect(() => {
    let disposed = false;
    prepareSessionExport(sessionId)
      .then((value) => {
        if (!disposed) setPayload(value);
      })
      .catch((error) => {
        if (!disposed) setError((error as Error).message);
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [sessionId]);
  useEffect(() => {
    if (!settings || sourcesLoading || initialized.current) return;
    initialized.current = true;
    setMethod(
      settings.defaultMethod === 'api' && settings.api
        ? 'api'
        : settings.defaultMethod === 'storage' && source
        ? 'storage'
        : 'download',
    );
  }, [settings, sourcesLoading, source]);
  const ready =
    !!payload && !!settings && !loading && !settingsLoading && !sourcesLoading;
  const available =
    method === 'download' || (method === 'api' ? !!settings?.api : !!source);
  async function send() {
    if (!payload || !settings || !available || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      setReceipt(await deliverExport(payload, method, settings));
    } catch (error) {
      setError((error as Error).message || '导出失败，请重试');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  let apiURL = '';
  if (settings?.api && payload) {
    try {
      apiURL = apiExportURL(settings.api.url, payload.taskId);
    } catch {
      /* The settings page can repair an invalid target. */
    }
  }
  return (
    <Modal
      title="导出任务"
      open={open}
      width={700}
      style={{ top: 32 }}
      bodyStyle={{ maxHeight: 'calc(100vh - 210px)', overflowY: 'auto' }}
      maskClosable={!busy}
      closable={!busy}
      keyboard={!busy}
      onCancel={onClose}
      footer={
        <div className="export-dialog-footer">
          <Link to="/exportSettings" target="_blank" rel="noopener noreferrer">
            导出设置 ↗
          </Link>
          {!receipt && (
            <Button disabled={busy} onClick={onClose}>
              取消
            </Button>
          )}
          {receipt ? (
            <Button type="primary" onClick={onClose}>
              完成
            </Button>
          ) : (
            <Button
              type="primary"
              loading={busy}
              disabled={!ready || !available}
              onClick={send}
            >
              导出
            </Button>
          )}
        </div>
      }
    >
      {!ready && !error && !settingsError && !sourcesError && (
        <div className="task-loading">
          <Spin />
        </div>
      )}
      {payload && (
        <>
          <Descriptions size="small" column={1} className="export-task-summary">
            <Descriptions.Item label="任务">
              {payload.taskName}
            </Descriptions.Item>
            <Descriptions.Item label="文件">
              {payload.filename} · {formatSize(payload.blob.size)}
            </Descriptions.Item>
            <Descriptions.Item label="数据">
              {payload.recordCount} 条，
              {payload.legacyProgress
                ? '提交进度未确认'
                : `已提交 ${payload.submittedCount} 条`}
            </Descriptions.Item>
          </Descriptions>
          <p className="export-content-note">
            导出数据引用、工具配置和已保存结果。原始文件单独存储。
          </p>
          <Radio.Group
            className="export-method-options"
            value={method}
            disabled={busy}
            onChange={(event) => {
              setMethod(event.target.value);
              setReceipt(undefined);
              setError('');
            }}
          >
            <Radio value="download">本地下载</Radio>
            <Radio value="api" disabled={!settings?.api}>
              API{!settings?.api ? '（未配置）' : ''}
            </Radio>
            <Radio value="storage" disabled={!source}>
              对象存储{!source ? '（未配置）' : ''}
            </Radio>
          </Radio.Group>
          <div className="export-target-preview">
            {method === 'download' ? (
              <span>下载到当前设备</span>
            ) : method === 'api' ? (
              <>
                <strong>{settings?.api?.method}</strong>
                <span>{apiURL}</span>
              </>
            ) : (
              <>
                <strong>{source?.name}</strong>
                <span>
                  {source?.connection.provider.toUpperCase()} ·{' '}
                  {source?.connection.bucket} / {settings?.storage?.prefix}
                </span>
                <small>{payload.objectFilename}</small>
              </>
            )}
          </div>
        </>
      )}
      {(error || settingsError || sourcesError) && (
        <Alert
          type="error"
          showIcon
          message={error || settingsError || sourcesError}
          className="mt-3"
        />
      )}
      {settings?.storage && !source && !sourcesLoading && (
        <Alert
          type="info"
          showIcon
          message="对象存储目标的数据源不可用，请在导出设置中重新选择。"
          className="mt-3"
        />
      )}
      {receipt && (
        <Alert
          type="success"
          showIcon
          className="mt-3"
          message={
            receipt.method === 'api'
              ? `API 已接收，HTTP ${receipt.status}`
              : receipt.method === 'storage'
              ? '已上传到对象存储'
              : '已开始下载'
          }
          description={
            receipt.method === 'storage' ? (
              <Typography.Paragraph className="export-location" copyable>
                {receipt.location}
              </Typography.Paragraph>
            ) : undefined
          }
        />
      )}
    </Modal>
  );
}
