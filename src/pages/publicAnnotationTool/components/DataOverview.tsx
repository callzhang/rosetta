import { Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import i18next from 'i18next';
import { observer } from 'mobx-react';
import { useEffect, useRef, useState } from 'react';
import type { DataFileNode } from '../../../localData/fileTree';
import type { DataRecord } from '@stardustai/annotation-client';
import { buildFileTree } from '../../../localData/fileTree';
import { dataKindLabels, kindFromRecord } from '../../../localData/presets';
import type { PublicAnnotationToolStore } from '../PublicAnnotationToolStore';

function fileNode(file: DataFileNode): DataNode {
  return {
    key: file.key,
    title: <span title={file.path}>{file.title}</span>,
    isLeaf: file.isLeaf,
    children: file.children?.map(fileNode),
  };
}

export default observer(function DataOverview({
  store,
  records = store.records,
  onSelectFile,
}: {
  store: PublicAnnotationToolStore;
  records?: DataRecord[];
  onSelectFile?: (url: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const { tree, count } = buildFileTree(records);
  const kinds = [...new Set(records.map(kindFromRecord).filter(Boolean))];
  useEffect(() => {
    const element = listRef.current;
    if (!element) return;
    const resize = new ResizeObserver(() => setHeight(element.clientHeight));
    setHeight(element.clientHeight);
    resize.observe(element);
    return () => resize.disconnect();
  }, []);
  return (
    <aside
      className="annotation-data-overview rounded-lg bg-white dark:bg-gray-900"
      aria-label={i18next.t('数据文件列表')}
    >
      <div className="data-files-heading">
        <span>{i18next.t('文件列表')}</span>
        <span className="data-files-count">
          {i18next.t('{{count}} 个文件', { count })}
        </span>
      </div>
      {count > 0 && (
        <div className="data-files-summary">
          {kinds.map((kind) => i18next.t(dataKindLabels[kind!])).join(' / ')} ·{' '}
          {i18next.t('{{count}} 条数据', { count: records.length })}
        </div>
      )}
      <div className="data-file-list" ref={listRef}>
        {tree.length ? (
          <Tree.DirectoryTree
            key={tree[0].key + count}
            className="data-file-tree"
            height={height || 320}
            itemHeight={28}
            virtual
            blockNode
            selectable={!!onSelectFile}
            onSelect={(_keys, info) => {
              if (info.node.isLeaf)
                onSelectFile?.(String(info.node.key).slice('file:'.length));
            }}
            defaultExpandAll
            treeData={tree.map(fileNode)}
          />
        ) : (
          <div className="data-files-empty">{i18next.t('尚未上传文件')}</div>
        )}
      </div>
    </aside>
  );
});
