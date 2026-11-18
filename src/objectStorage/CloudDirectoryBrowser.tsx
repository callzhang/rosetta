import {
  ArrowUpOutlined,
  FileOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import { Button } from '@stardustai/annotation-client';
import { Alert, Input, Table } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { formatSize } from '../localData/files';
import { storageError } from './adapters';
import type { ConnectedStorage } from './CloudConnectionForm';
import CloudSourcePicker from './CloudSourcePicker';
import { directoryPrefix } from './paths';
import type { StoragePage } from './types';

export interface CloudDirectorySelection {
  connected: ConnectedStorage;
  prefix: string;
}

export default function CloudDirectoryBrowser({
  initialSourceId,
  disabled = false,
  onChange,
}: {
  initialSourceId?: string;
  disabled?: boolean;
  onChange: (value?: CloudDirectorySelection) => void;
}) {
  const [connected, setConnected] = useState<ConnectedStorage>();
  const [prefix, setPrefix] = useState('');
  const [draft, setDraft] = useState('');
  const [page, setPage] = useState<StoragePage>({
    objects: [],
    directories: [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const usedInitial = useRef(false);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  async function browse(value: string, append = false) {
    if (!connected || disabled) return;
    const next = directoryPrefix(value);
    if (!next.startsWith(connected.source.prefix)) {
      setError('请在数据源的起始目录内选择');
      setDraft(prefix);
      onChange({ connected, prefix });
      return;
    }
    const current = ++request.current;
    setBusy(true);
    setError('');
    onChange(undefined);
    try {
      const result = await connected.client.list({
        prefix: next,
        delimiter: '/',
        cursor: append ? page.nextCursor : undefined,
      });
      if (current !== request.current) return;
      if (append && result.nextCursor && result.nextCursor === page.nextCursor)
        throw new Error('目录分页标记重复，请重新打开目录');
      setPrefix(next);
      setDraft(next);
      setPage(
        append
          ? {
              objects: [
                ...new Map(
                  [...page.objects, ...result.objects].map((object) => [
                    object.key,
                    object,
                  ]),
                ).values(),
              ],
              directories: [
                ...new Set([...page.directories, ...result.directories]),
              ],
              nextCursor: result.nextCursor,
            }
          : result,
      );
      onChange({ connected, prefix: next });
    } catch (error) {
      if (current === request.current) {
        setError(storageError(error));
        setDraft(prefix);
        onChange({ connected, prefix });
      }
    } finally {
      if (current === request.current) setBusy(false);
    }
  }
  if (!connected)
    return (
      <CloudSourcePicker
        initialSourceId={usedInitial.current ? undefined : initialSourceId}
        onConnected={(value) => {
          usedInitial.current = true;
          setConnected(value);
          setPrefix(value.source.prefix);
          setDraft(value.source.prefix);
          setPage(value.page);
          setError('');
          onChange({ connected: value, prefix: value.source.prefix });
        }}
      />
    );
  const rows = [
    ...page.directories.map((key) => ({
      key,
      name: key.slice(prefix.length).replace(/\/$/, ''),
      directory: true,
      size: 0,
    })),
    ...page.objects
      .filter((object) => !object.key.endsWith('/'))
      .map((object) => ({
        ...object,
        name: object.key.slice(prefix.length),
        directory: false,
      })),
  ];
  return (
    <div className="cloud-directory-browser">
      <div className="cloud-directory-heading">
        <span>
          {connected.source.provider.toUpperCase()} · {connected.source.bucket}
        </span>
        <Button
          disabled={disabled || busy}
          onClick={() => {
            request.current++;
            setConnected(undefined);
            setError('');
            onChange(undefined);
          }}
        >
          更换数据源
        </Button>
      </div>
      <div className="cloud-directory-path">
        <Button
          icon={<ArrowUpOutlined />}
          disabled={disabled || busy || prefix === connected.source.prefix}
          onClick={() => browse(prefix.replace(/[^/]+\/$/, ''))}
        >
          上一级
        </Button>
        <Input
          aria-label="对象存储目录"
          disabled={disabled || busy}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            onChange(
              event.target.value === prefix ? { connected, prefix } : undefined,
            );
          }}
          onPressEnter={() => browse(draft)}
          placeholder="目录前缀，留空为 Bucket 根目录"
        />
        <Button
          loading={busy}
          disabled={disabled}
          onClick={() => browse(draft)}
        >
          打开目录
        </Button>
      </div>
      <Table
        size="small"
        rowKey="key"
        dataSource={rows}
        loading={busy}
        pagination={false}
        scroll={{ y: 220 }}
        locale={{ emptyText: '当前目录为空' }}
        columns={[
          {
            title: '名称',
            dataIndex: 'name',
            render: (name, row) =>
              row.directory ? (
                <button
                  className="cloud-directory-link"
                  disabled={disabled || busy}
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
            render: (_, row) => (row.directory ? '—' : formatSize(row.size)),
          },
        ]}
      />
      {page.nextCursor && (
        <Button
          className="cloud-load-more"
          disabled={disabled || busy}
          onClick={() => browse(prefix, true)}
        >
          加载更多
        </Button>
      )}
      {error && (
        <Alert className="mt-3" type="error" showIcon message={error} />
      )}
    </div>
  );
}
