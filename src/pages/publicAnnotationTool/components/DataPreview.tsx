import {
  FileOutlined,
  PlayCircleOutlined,
  RadarChartOutlined,
} from '@ant-design/icons';
import { Button, fetchResourceURL } from '@stardustai/annotation-client';
import type { DataRecord } from '@stardustai/annotation-client';
import { Alert, Spin } from 'antd';
import { useRequest } from 'ahooks';
import ky from 'ky';
import { observer } from 'mobx-react';
import { useEffect, useRef, useState } from 'react';
import { buildFileTree } from '../../../localData/fileTree';
import type { DataFileNode } from '../../../localData/fileTree';
import { kindFromRecord } from '../../../localData/recordKind';
import { recordName } from '../../../localData/sessionInfo';
import type { PublicAnnotationToolStore } from '../PublicAnnotationToolStore';
import DataOverview from './DataOverview';

function firstFile(nodes: DataFileNode[]): string | undefined {
  for (const node of nodes) {
    if (node.isLeaf) return node.key.slice('file:'.length);
    const file = firstFile(node.children || []);
    if (file) return file;
  }
}

export default observer(function DataPreview({
  store,
  onAnnotate,
}: {
  store: PublicAnnotationToolStore;
  onAnnotate: () => void;
}) {
  const record = store.records[store.activeRecordIndex];
  const kind = kindFromRecord(record);
  const [selected, setSelected] = useState<{
    record: DataRecord;
    url: string;
  }>();
  const pending = useRef<AbortController>();
  const original = firstFile(buildFileTree(record ? [record] : []).tree);
  const url = selected && selected.record === record ? selected.url : original;
  const inline =
    record?.attachmentType === 'TEXT' && url?.startsWith('inline:');
  const { data, error, loading, run, cancel } = useRequest(
    async (value: string) => {
      pending.current?.abort();
      const abort = new AbortController();
      pending.current = abort;
      const resolved = await fetchResourceURL(value);
      abort.signal.throwIfAborted();
      const text =
        kind === 'text' && /\.(?:txt|md)(?:[?#]|$)/i.test(value)
          ? await ky
              .get(resolved, {
                signal: abort.signal,
                retry: 0,
                timeout: 30_000,
              })
              .text()
          : undefined;
      return { key: value, url: resolved, text };
    },
    { manual: true, onError: () => {} },
  );
  useEffect(() => {
    if (url && !inline && kind !== 'pointcloud') run(url);
    return () => {
      cancel();
      pending.current?.abort();
    };
  }, [url, inline, kind, run, cancel]);
  const current = data?.key === url ? data : undefined;
  return (
    <aside className="annotation-preview-panel" aria-label="数据预览与文件列表">
      <div className="data-preview-heading">
        <strong>数据预览</strong>
        <span>{record?.attachmentType}</span>
      </div>
      <div className="data-preview-body">
        {kind === 'pointcloud' ? (
          <div className="data-preview-placeholder">
            <RadarChartOutlined />
            <strong>{recordName(record)}</strong>
            <span>支持旋转、缩放与三维标注</span>
            <Button onClick={onAnnotate} icon={<PlayCircleOutlined />}>
              打开 3D 标注视图
            </Button>
          </div>
        ) : loading ? (
          <Spin />
        ) : error ? (
          <Alert
            type="error"
            message="无法预览当前文件"
            description={error.message}
          />
        ) : inline ? (
          <pre>{String(record.attachment)}</pre>
        ) : current && kind === 'image' ? (
          <img src={current.url} alt={recordName(record)} />
        ) : current && kind === 'video' ? (
          <video controls src={current.url} />
        ) : current && kind === 'audio' ? (
          <audio controls src={current.url} />
        ) : current?.text != null ? (
          <pre>{current.text}</pre>
        ) : (
          <div className="data-preview-placeholder">
            <FileOutlined />
            <span>{record ? recordName(record) : '请先选择数据'}</span>
            <Button disabled={!record} onClick={onAnnotate}>
              在标注视图中查看
            </Button>
          </div>
        )}
      </div>
      <DataOverview
        store={store}
        records={record ? [record] : []}
        onSelectFile={(value) => setSelected({ record, url: value })}
      />
    </aside>
  );
});
