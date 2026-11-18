import {
  FolderOpenOutlined,
  InboxOutlined,
  QuestionCircleOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { Button, message } from '@stardustai/annotation-client';
import { Typography } from 'antd';
import { useRef } from 'react';
import { fromFileList } from '../../../localData/files';
import type { LocalFile } from '../../../localData/files';
import { stageLocalFiles } from '../../../localData/stagedImports';
import { useLocalFileDrop } from '../../../localData/useLocalFileDrop';
import type { PublicAnnotationToolStore } from '../PublicAnnotationToolStore';

export default function LocalDataUpload({
  store,
}: {
  store: PublicAnnotationToolStore;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  function pick(files: LocalFile[], folder: boolean) {
    try {
      const data = stageLocalFiles(store, files, folder);
      store.setRecords(data.records);
      if (data.skipped)
        message.info(`已跳过 ${data.skipped} 个空文件或不支持的文件`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '无法读取文件');
    }
  }
  const { collecting, dragging, getRootProps } = useLocalFileDrop({
    disabled: false,
    onFiles: (files) =>
      pick(
        files,
        files.some((entry) => entry.path.includes('/')),
      ),
    onError: (error) => message.error(error.message),
  });
  return (
    <section className="annotation-local-upload" aria-label="上传自己的数据">
      <div className="annotation-upload-actions">
        <span className="annotation-scene-label">本地数据:</span>
        <Button
          icon={<UploadOutlined />}
          onClick={() => fileInput.current?.click()}
          disabled={collecting}
        >
          选择文件
        </Button>
        <Button
          icon={<FolderOpenOutlined />}
          onClick={() => folderInput.current?.click()}
          disabled={collecting}
        >
          选择文件夹
        </Button>
        <Typography.Link
          target="_blank"
          rel="noopener noreferrer"
          href="https://docs.morningstar.works/zh-CN/docs/data/data-format"
        >
          <QuestionCircleOutlined /> 数据准备说明
        </Typography.Link>
      </div>
      <div
        {...getRootProps()}
        className={`annotation-file-drop${dragging ? ' is-dragging' : ''}`}
        role="button"
        tabIndex={collecting ? -1 : 0}
        aria-label="拖动文件到此处开始标注"
        aria-busy={collecting}
        onClick={() => !collecting && fileInput.current?.click()}
        onKeyDown={(event) => {
          if (['Enter', ' '].includes(event.key)) {
            event.preventDefault();
            if (!collecting) fileInput.current?.click();
          }
        }}
      >
        <InboxOutlined />
        <div>
          <strong>
            {collecting ? '正在读取文件…' : '拖动文件到此处开始标注'}
          </strong>
          <span>支持图片、点云、音视频和文本。</span>
        </div>
      </div>
      <input
        ref={fileInput}
        hidden
        type="file"
        multiple
        onChange={(event) => {
          if (event.target.files?.length)
            pick(fromFileList(event.target.files), false);
          event.target.value = '';
        }}
      />
      <input
        ref={folderInput}
        hidden
        type="file"
        multiple
        {...{ webkitdirectory: '', directory: '' }}
        onChange={(event) => {
          if (event.target.files?.length)
            pick(fromFileList(event.target.files), true);
          event.target.value = '';
        }}
      />
    </section>
  );
}
