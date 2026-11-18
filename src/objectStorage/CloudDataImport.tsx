import {
  ArrowUpOutlined,
  CloudOutlined,
  FileOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import {
  Button,
  message,
  validateSchema,
} from '@stardustai/annotation-client';
import { Alert, Checkbox, Input, Modal, Table } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { formatSize } from '../localData/files';
import type { PublicAnnotationToolStore } from '../pages/publicAnnotationTool/PublicAnnotationToolStore';
import { storageError } from './adapters';
import type { ConnectedStorage } from './CloudConnectionForm';
import CloudSourcePicker from './CloudSourcePicker';
import { buildCloudImport, listDirectoryObjects } from './import';
import { directoryPrefix } from './paths';
import type { StoragePage } from './types';

export default function CloudDataImport({
  store,
}: {
  store: PublicAnnotationToolStore;
}) {
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState<ConnectedStorage>();
  const [prefix, setPrefix] = useState('');
  const [draft, setDraft] = useState('');
  const [page, setPage] = useState<StoragePage>({
    objects: [],
    directories: [],
  });
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [count, setCount] = useState(0);
  const [recursive, setRecursive] = useState(true);
  const [sequence, setSequence] = useState(true);
  const [error, setError] = useState('');
  const controller = useRef<AbortController>();
  const request = useRef(0);
  useEffect(() => () => controller.current?.abort(), []);

  async function browse(value: string, append = false) {
    if (!connected) return;
    const next = directoryPrefix(value);
    const revision = ++request.current;
    if (!next.startsWith(connected.source.prefix)) {
      setError('请在连接时指定的起始目录内选择数据。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await connected.client.list({
        prefix: next,
        delimiter: '/',
        cursor: append ? page.nextCursor : undefined,
      });
      if (revision !== request.current) return;
      setPrefix(next);
      setDraft(next);
      setPage(
        append
          ? {
              objects: [...page.objects, ...result.objects],
              directories: [
                ...new Set([...page.directories, ...result.directories]),
              ],
              nextCursor: result.nextCursor,
            }
          : result,
      );
    } catch (error) {
      if (revision === request.current) setError(storageError(error));
    } finally {
      if (revision === request.current) setBusy(false);
    }
  }

  async function importDirectory() {
    if (!connected || busy || importing || draft !== prefix) return;
    const abort = new AbortController();
    controller.current = abort;
    setImporting(true);
    setError('');
    setCount(0);
    try {
      const objects = await listDirectoryObjects(connected.client, prefix, {
        recursive,
        signal: abort.signal,
        onProgress: setCount,
      });
      const data = buildCloudImport(objects, connected.source, sequence);
      for (const record of data.records) {
        const check = validateSchema('DataRecord', record);
        if (!check.valid) throw new Error(check.errorMessage);
      }
      if (abort.signal.aborted)
        throw new DOMException('已取消读取', 'AbortError');
      store.setRecords(data.records);
      setOpen(false);
      message.success(
        `已导入 ${data.fileCount} 个云端文件，生成 ${
          data.records.length
        } 条数据${
          data.skippedCount ? `，忽略 ${data.skippedCount} 个非标注文件` : ''
        }`,
      );
    } catch (error) {
      if ((error as Error).name !== 'AbortError')
        setError(
          (error as Error).message?.startsWith('目录') ||
            (error as Error).message?.startsWith('对象存储') ||
            (error as Error).message?.startsWith('当前任务') ||
            (error as Error).message?.startsWith('任务数据') ||
            (error as Error).message?.startsWith('本地标注任务')
            ? (error as Error).message
            : storageError(error),
        );
    } finally {
      setImporting(false);
      controller.current = undefined;
    }
  }

  const rows = [
    ...page.directories.map((key) => ({
      key,
      directory: true,
      size: 0,
      name: key.slice(prefix.length).replace(/\/$/, ''),
    })),
    ...page.objects
      .filter((object) => !object.key.endsWith('/'))
      .map((object) => ({
        ...object,
        directory: false,
        name: object.key.slice(prefix.length),
      })),
  ];
  return (
    <>
      <div className="flex items-center py-2 font-bold">
        <span className="mr-4 min-w-16">对象存储:</span>
        <Button icon={<CloudOutlined />} onClick={() => setOpen(true)}>
          从对象存储导入
        </Button>
        {connected && (
          <span className="cloud-connection-label">
            {connected.source.provider.toUpperCase()} ·{' '}
            {connected.source.bucket}
          </span>
        )}
      </div>
      <Modal
        title="从对象存储导入"
        open={open}
        width={920}
        destroyOnClose
        maskClosable={!importing && !busy}
        closable={!importing}
        onCancel={() =>
          importing ? controller.current?.abort() : setOpen(false)
        }
        footer={
          connected ? (
            <>
              <Button
                onClick={() =>
                  importing ? controller.current?.abort() : setOpen(false)
                }
              >
                {importing ? '取消读取' : '取消'}
              </Button>
              <Button
                className="ml-2"
                type="primary"
                loading={importing}
                disabled={busy || draft !== prefix}
                onClick={() => importDirectory()}
              >
                导入并配置标注工具
              </Button>
            </>
          ) : null
        }
      >
        {!connected ? (
          <CloudSourcePicker
            onConnected={(value) => {
              setConnected(value);
              setPrefix(value.source.prefix);
              setDraft(value.source.prefix);
              setPage(value.page);
              setError('');
            }}
          />
        ) : (
          <>
            <div className="cloud-directory-heading">
              <span>
                {connected.source.provider.toUpperCase()} ·{' '}
                {connected.source.bucket}
              </span>
              <Button
                disabled={busy || importing}
                onClick={() => {
                  request.current++;
                  setConnected(undefined);
                  setError('');
                }}
              >
                更换连接
              </Button>
            </div>
            <div className="cloud-directory-path">
              <Button
                icon={<ArrowUpOutlined />}
                disabled={
                  busy || importing || prefix === connected.source.prefix
                }
                onClick={() => browse(prefix.replace(/[^/]+\/$/, ''))}
              >
                上一级
              </Button>
              <Input
                aria-label="对象存储目录"
                value={draft}
                disabled={importing}
                placeholder="目录前缀，留空表示 Bucket 根目录"
                onChange={(event) => setDraft(event.target.value)}
                onPressEnter={() => browse(draft)}
              />
              <Button
                loading={busy}
                disabled={importing}
                onClick={() => browse(draft)}
              >
                打开目录
              </Button>
            </div>
            <Table
              size="small"
              rowKey="key"
              loading={busy}
              pagination={false}
              scroll={{ y: 300 }}
              dataSource={rows}
              locale={{ emptyText: '此目录为空，或没有可列出的文件' }}
              columns={[
                {
                  title: '名称',
                  dataIndex: 'name',
                  render: (name, row) =>
                    row.directory ? (
                      <button
                        type="button"
                        className="cloud-directory-link"
                        disabled={importing}
                        onClick={() => browse(row.key)}
                      >
                        <FolderOutlined /> {name}
                      </button>
                    ) : (
                      <span>
                        <FileOutlined /> {name}
                      </span>
                    ),
                },
                {
                  title: '大小',
                  width: 110,
                  render: (_, row) =>
                    row.directory ? '—' : formatSize(row.size),
                },
              ]}
            />
            {page.nextCursor && (
              <Button
                className="cloud-load-more"
                disabled={busy || importing}
                onClick={() => browse(prefix, true)}
              >
                加载更多
              </Button>
            )}
            <div className="cloud-import-options">
              <Checkbox
                disabled={importing}
                checked={recursive}
                onChange={(event) => setRecursive(event.target.checked)}
              >
                包含子目录
              </Checkbox>
              <Checkbox
                disabled={importing}
                checked={sequence}
                onChange={(event) => setSequence(event.target.checked)}
              >
                点云 / 图片按目录组成连续帧
              </Checkbox>
            </div>
            <p className="cloud-storage-note">
              选择目录后按需读取云端原始文件，不会预先下载整个目录。多种数据类型请分别进入对应子目录。
            </p>
            {importing && <p>正在读取目录，已发现 {count} 个文件…</p>}
          </>
        )}
        {error && <Alert type="error" showIcon message={error} />}
      </Modal>
    </>
  );
}
