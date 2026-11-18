import { ArrowLeftOutlined, DownloadOutlined } from '@ant-design/icons';
import type {
  RosettaAnnotationDraft,
  RosettaAnnotationHandle,
  TaskParams,
  TaskResult,
} from '@stardustai/annotation-client';
import {
  Button,
  GlobalSpinner,
  message,
  useNavigate,
} from '@stardustai/annotation-client';
import { Alert, Modal } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import ExportTaskModal from '../exports/ExportTaskModal';
import type { AnnotationPreview } from '../localData/annotationPreview';
import {
  activateAnnotationPreview,
  checkpointAnnotationPreview,
} from '../localData/annotationPreview';
import { QuickSession } from '../localData/quickSession';
import { recordName, sessionRecords } from '../localData/sessionInfo';
import { applyAnnotationDraft } from '../localData/stagedImports';
import AnnotationWorkspace from './AnnotationWorkspace';

export default function QuickAnnotationPage({
  preview,
}: {
  preview: AnnotationPreview;
}) {
  const navigate = useNavigate();
  const editor = useRef<RosettaAnnotationHandle>(null);
  const [owner] = useState(() => ({}));
  const [quickSession] = useState(() => new QuickSession());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(preview.index);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number>();
  const [exportId, setExportId] = useState<string>();
  const [blockingDialogOpen, setBlockingDialogOpen] = useState(false);
  const current = useRef(preview);
  const input = useRef(preview.input);
  const pending = useRef(false);

  useEffect(() => {
    let disposed = false;
    const release = activateAnnotationPreview(preview, owner);
    quickSession
      .restore(preview.quickSession)
      .then(() => !disposed && setReady(true))
      .catch((error) => !disposed && setError((error as Error).message));
    return () => {
      disposed = true;
      release();
    };
  }, [preview, owner, quickSession]);

  const apply = useCallback(
    (draft: RosettaAnnotationDraft) => {
      input.current = applyAnnotationDraft(owner, input.current, draft);
    },
    [owner],
  );
  async function checkpoint(position: number) {
    current.current = await checkpointAnnotationPreview(
      current.current,
      input.current,
      position,
      quickSession.snapshot(),
    );
  }
  const save = useCallback(
    async (
      result: TaskResult,
      params: TaskParams,
      position: number,
      draft?: RosettaAnnotationDraft,
    ) => {
      if (pending.current) throw new Error('正在保存，请稍后重试');
      pending.current = true;
      setSaving(true);
      try {
        apply({ ...draft, result, params, index: position });
        await quickSession.saveResult(input.current, result, position);
        await checkpoint(position);
        setSavedAt(Date.now());
      } finally {
        pending.current = false;
        setSaving(false);
      }
    },
    [apply, quickSession],
  );
  const recover = useCallback(
    async (draft: RosettaAnnotationDraft) => {
      // saveSessionDraft writes segmentation once, after its local recovery task exists.
      apply({ ...draft, segmentation: undefined });
      await quickSession.recover(input.current, draft);
    },
    [apply, quickSession],
  );

  async function saveToTasks(exportCurrent = false) {
    if (!editor.current || pending.current) return;
    pending.current = true;
    setSaving(true);
    try {
      if (exportCurrent) await editor.current.authorizeExport();
      const operationId = await editor.current.authorizeSave();
      const draft = await editor.current.captureDraft();
      apply(draft);
      const saved = exportCurrent
        ? [await quickSession.saveCurrent(input.current, draft.index)]
        : await quickSession.saveAll(input.current);
      await checkpoint(draft.index);
      await editor.current.confirmSave(operationId);
      setSavedAt(Date.now());
      if (exportCurrent) setExportId(saved[0].id);
      else message.success(`已保存 ${saved.length} 条任务`);
    } catch (error) {
      message.error((error as Error).message || '保存失败，请重试');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  const records = sessionRecords(preview.input);
  function returnToConfiguration() {
    Modal.confirm({
      title: '返回工具配置',
      content: '返回配置前，请先保存标注。',
      okText: '返回配置',
      cancelText: '继续标注',
      onOk: () => {
        window.close();
        if (!window.closed) navigate('/annotationTool');
      },
    });
  }
  return (
    <div className="cloud-annotation-page annotation-focus-page">
      <header className="annotation-session-toolbar">
        <Button
          icon={<ArrowLeftOutlined />}
          disabled={saving}
          onClick={returnToConfiguration}
        >
          返回工具配置
        </Button>
        <div className="annotation-session-context">
          <small>数据标注</small>
          <strong>{recordName(records[index])}</strong>
        </div>
        <span className="annotation-session-position">
          数据 {index + 1} / {records.length}
        </span>
        <span className="annotation-session-save" role="status">
          {saving
            ? '正在保存…'
            : savedAt
            ? `上次保存 ${new Date(savedAt).toLocaleTimeString()}`
            : '结果保存在此浏览器'}
        </span>
        <Button disabled={saving || !ready} onClick={() => saveToTasks()}>
          保存到任务
        </Button>
        <Button
          icon={<DownloadOutlined />}
          disabled={saving || !ready || blockingDialogOpen}
          onClick={() => saveToTasks(true)}
        >
          导出当前数据
        </Button>
      </header>
      {error ? (
        <div className="cloud-access-page">
          <Alert type="error" showIcon message={error} />
        </div>
      ) : ready ? (
        <AnnotationWorkspace
          taskId={preview.id}
          sources={preview.cloudSources}
          editorRef={editor}
          input={preview.input}
          initialIndex={preview.index}
          onChangeIndex={setIndex}
          onSave={save}
          onProtectionSave={recover}
          onBlockingDialogChange={setBlockingDialogOpen}
        />
      ) : (
        <GlobalSpinner />
      )}
      {exportId && (
        <ExportTaskModal
          sessionId={exportId}
          open={!blockingDialogOpen}
          onClose={() => setExportId(undefined)}
        />
      )}
    </div>
  );
}
