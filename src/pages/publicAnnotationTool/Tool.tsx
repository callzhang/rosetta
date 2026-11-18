import {
  ArrowRightOutlined,
  DatabaseOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import {
  AlgorithmEditor,
  Button,
  GlobalSpinner,
  message,
  OperatorsEditor,
  useNavigate,
  useSearchParams,
} from '@stardustai/annotation-client';
import type { PublicAnnotationInput } from '@stardustai/annotation-client';
import { Alert, Modal, Select, Tooltip } from 'antd';
import i18next from 'i18next';
import { debounce } from 'lodash';
import { reaction, toJS } from 'mobx';
import { observer } from 'mobx-react';
import { ElementRef, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { loadSession } from '../../localData/storage';
import { openAnnotationPreview } from '../../localData/openAnnotation';
import { QuickSession } from '../../localData/quickSession';
import { dataKindLabels, kindFromRecord } from '../../localData/recordKind';
import { recordName } from '../../localData/sessionInfo';
import TaskLayout from '../tasks/TaskLayout';
import CacheManagerModal from './components/CacheManagerModal';
import DataPreview from './components/DataPreview';
import SceneSelect from './SceneSelect';
import { takeQuickDraft } from '../../localData/quickDrafts';
import {
  formatType,
  PublicAnnotationToolStore,
} from './PublicAnnotationToolStore';
const JsonEditor = lazy(() => import('./JSONEdit'));
const PublicAnnotationJSONEditor = observer(
  ({ store }: { store: PublicAnnotationToolStore }) => {
    const jsonEditorRef = useRef<ElementRef<typeof JsonEditor>>(null);
    return (
      <Suspense fallback={<GlobalSpinner />}>
        <JsonEditor
          ref={jsonEditorRef}
          value={store.input}
          onChange={(value) => store.setDataWithString(value)}
        />
      </Suspense>
    );
  },
);
const PublicAnnotationOperatorsEditor = observer(
  ({ store }: { store: PublicAnnotationToolStore }) => (
    <div className="annotation-operator-editor">
      {store.records.length ? (
        <OperatorsEditor
          input={toJS(store.input)}
          initialIndex={store.activeRecordIndex}
          onInputChange={(input) => store.setData(input, true)}
          onProtectionSave={async () => {
            store.setDataWithString.flush();
            if (store.error) throw store.error;
            await store.persistProtectionDraft();
          }}
        />
      ) : (
        <div className="annotation-tools-empty rounded-lg bg-white dark:bg-gray-900">
          {i18next.t('上传数据后自动匹配标注工具')}
        </div>
      )}
    </div>
  ),
);
export const PublicAnnotationAlgoEditor = observer(
  ({ store }: { store: PublicAnnotationToolStore }) =>
    store.records.length ? (
      <AlgorithmEditor
        input={toJS(store.input)}
        initialIndex={store.activeRecordIndex}
        onInputChange={(input) => store.setData(input, true)}
      />
    ) : (
      <div className="annotation-tools-empty rounded-lg bg-white dark:bg-gray-900">
        {i18next.t('上传数据后配置算法辅助')}
      </div>
    ),
);
const formatTypeToName = (format: formatType) => {
  switch (format) {
    case formatType.OperatorEditor:
      return i18next.t('标注工具');
    case formatType.AlgoEditor:
      return i18next.t('算法辅助');
    case formatType.JSON:
      return i18next.t('JSON');
  }
};

const PublicAnnotationTool = observer(function () {
  const [store] = useState(() => new PublicAnnotationToolStore());
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const taskId = params.get('task');
  const legacyTasks = params.has('tasks');
  const draftId = params.get('draft');
  const [loadingTask, setLoadingTask] = useState(!!taskId);
  const [taskError, setTaskError] = useState('');
  const [busy, setBusy] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSavedAt, setConfigSavedAt] = useState<number>();
  const [savedCount, setSavedCount] = useState(0);
  const [showCacheManager, setShowCacheManager] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  useEffect(() => () => store.dispose(), [store]);
  useEffect(
    () =>
      reaction(
        () => toJS(store.input),
        () => {
          if (!store.managedTask) setConfigSavedAt(undefined);
        },
      ),
    [store],
  );

  useEffect(() => {
    if (legacyTasks) {
      navigate('/tasks', { replace: true });
      return;
    }
    let disposed = false;
    setTaskError('');
    setSavedCount(0);
    if (!taskId) {
      store.resetCustom();
      if (draftId) {
        try {
          const draft = takeQuickDraft(draftId, store);
          store.setData(draft.input, false);
          store.quickSession.setDetails(draft.details);
        } catch (error) {
          setTaskError((error as Error).message);
        }
      }
      setLoadingTask(false);
      return;
    }
    setLoadingTask(true);
    loadSession(taskId)
      .then((value) => {
        if (!disposed) {
          store.restoreTask(value);
        }
      })
      .catch((error) => !disposed && setTaskError(error.message))
      .finally(() => !disposed && setLoadingTask(false));
    return () => {
      disposed = true;
    };
  }, [taskId, draftId, legacyTasks, store, navigate]);

  useEffect(() => {
    if (!store.managedTask) return;
    const persist = debounce(
      async ({ id, input }: { id: string; input: PublicAnnotationInput }) => {
        setConfigSaving(true);
        try {
          await store.persistConfiguration(input, id);
          setConfigSavedAt(Date.now());
        } catch (error) {
          message.error(`任务配置保存失败：${(error as Error).message}`);
        } finally {
          setConfigSaving(false);
        }
      },
      500,
    );
    const dispose = reaction(
      () => ({ id: store.sessionId, input: toJS(store.input) }),
      ({ id, input }) => {
        if (id && input) persist({ id, input });
        else persist.cancel();
      },
    );
    return () => {
      dispose();
      persist.cancel();
    };
  }, [store, store.managedTask]);

  async function captureCurrent() {
    store.setDataWithString.flush();
    if (store.error) throw store.error;
  }
  async function startAnnotation() {
    if (busy) return;
    setBusy(true);
    try {
      await openAnnotationPreview(async () => {
        await captureCurrent();
        if (store.managedTask) await store.persistTask();
        const input = await store.migrateInput();
        let quickSession = store.quickSession;
        if (store.managedTask && store.sessionId) {
          quickSession = new QuickSession();
          quickSession.linkTask(input, store.sessionId, store.contentRevision);
        }
        return {
          input,
          index: store.activeRecordIndex,
          quickSession: quickSession.snapshot(),
        };
      });
    } catch (error) {
      message.error((error as Error).message || '无法打开标注页面，请重试');
    } finally {
      setBusy(false);
    }
  }
  async function saveConfiguration() {
    await captureCurrent();
    if (store.managedTask) await store.persistTask();
    else {
      const input = await store.getFinalInput();
      const saved = await store.quickSession.saveAll(input);
      setSavedCount(saved.length);
    }
    setConfigSavedAt(Date.now());
  }
  async function saveToTasks() {
    if (busy) return;
    setBusy(true);
    try {
      await saveConfiguration();
      message.success('已保存到本机任务');
    } catch (error) {
      message.error((error as Error).message || '保存失败，请重试');
    } finally {
      setBusy(false);
    }
  }
  async function selectData(index: number) {
    if (busy) return;
    setBusy(true);
    try {
      await captureCurrent();
      store.selectRecord(index);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function openExample(input: PublicAnnotationInput) {
    setBusy(true);
    try {
      store.setData(input, false);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function reset() {
    Modal.confirm({
      title: '更换数据',
      content: '更换前请保存当前数据和标注。',
      okText: '更换数据',
      onOk: () => {
        store.resetCustom();
        setSavedCount(0);
        setConfigSavedAt(undefined);
      },
    });
  }

  function confirmLeaving(): Promise<boolean> {
    if (configSavedAt) return Promise.resolve(true);
    return new Promise((resolve) => {
      Modal.confirm({
        title: '离开当前标注数据？',
        content: '请先保存到任务，避免丢失当前修改。',
        okText: '离开工作区',
        cancelText: '继续编辑',
        onOk: () => {
          resolve(true);
        },
        onCancel: () => {
          resolve(false);
        },
      });
    });
  }

  if (loadingTask)
    return (
      <TaskLayout>
        <GlobalSpinner />
      </TaskLayout>
    );
  if (taskError)
    return (
      <TaskLayout>
        <Alert
          type="error"
          showIcon
          message={taskError}
          action={
            <Button onClick={() => navigate('/tasks')}>返回任务列表</Button>
          }
        />
      </TaskLayout>
    );
  const hasData = store.records.length > 0;
  const active = store.records[store.activeRecordIndex];
  const kind = kindFromRecord(active);
  return (
    <TaskLayout
      task={
        store.managedTask && store.sessionId
          ? { id: store.sessionId, name: store.taskName || '当前任务' }
          : undefined
      }
      section="configuration"
      contentClassName={'annotation-tool-page-content'}
      onStartNew={hasData && !store.managedTask ? reset : undefined}
      onBeforeNavigate={
        hasData && !store.managedTask
          ? confirmLeaving
          : store.managedTask
          ? saveConfiguration
          : undefined
      }
      actions={
        <>
          <Tooltip title="数据缓存管理">
            <Button
              aria-label="数据缓存管理"
              icon={<DatabaseOutlined />}
              onClick={() => setShowCacheManager(true)}
            />
          </Tooltip>
        </>
      }
      footer={
        <>
          <div className="workspace-footer-note">
            <strong>
              {store.records.length} 条数据
              {savedCount ? ` · 已保存 ${savedCount} 条任务` : ''}
            </strong>
            <span>
              {configSaving
                ? '正在保存配置…'
                : configSavedAt
                ? `已保存 · ${new Date(configSavedAt).toLocaleTimeString()}`
                : store.managedTask
                ? '配置自动保存到本机'
                : '数据尚未保存到任务'}
            </span>
          </div>
          <Button
            disabled={busy || !hasData}
            loading={busy}
            onClick={saveToTasks}
          >
            {store.managedTask ? '保存配置' : '保存到任务'}
          </Button>
          <Button
            type="primary"
            disabled={busy || !hasData}
            onClick={startAnnotation}
          >
            开始标注 <ArrowRightOutlined />
          </Button>
        </>
      }
    >
      {!store.managedTask && (
        <div>
          <SceneSelect
            store={store}
            onSelect={(input) => {
              void openExample(input);
            }}
          />
        </div>
      )}
      {hasData && (
        <div className="annotation-current-data">
          <span>
            {store.managedTask ? store.taskName : recordName(active)} ·{' '}
            {kind ? dataKindLabels[kind] : active?.attachmentType}
          </span>
          <div>
            {store.records.length > 1 && (
              <Select
                aria-label="选择当前数据"
                value={store.activeRecordIndex}
                disabled={busy}
                options={store.records.map((record, index) => ({
                  value: index,
                  label: `${index + 1}. ${recordName(record)}`,
                }))}
                onChange={(index) => {
                  void selectData(index);
                }}
              />
            )}
            {!store.managedTask && (
              <Button size="small" disabled={busy} onClick={reset}>
                更换数据
              </Button>
            )}
          </div>
        </div>
      )}
      <div className="annotation-tool-body">
        <div
          className="annotation-configuration-view"
          role="tabpanel"
          aria-label="工具配置与数据预览"
        >
          <div className="annotation-config-toolbar">
            <div
              className="annotation-config-tabs"
              role="tablist"
              aria-label="标注工具配置"
            >
              {[
                formatType.OperatorEditor,
                formatType.AlgoEditor,
                formatType.JSON,
              ].map((format) => (
                <button
                  type="button"
                  key={format}
                  aria-pressed={store.format === format}
                  role="tab"
                  onClick={() => store.setFormat(format)}
                >
                  {formatTypeToName(format)}
                </button>
              ))}
            </div>
            <Button
              size="small"
              icon={previewOpen ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              aria-expanded={previewOpen}
              onClick={() => setPreviewOpen((open) => !open)}
            >
              {previewOpen ? '收起数据与文件' : '查看数据与文件'}
            </Button>
          </div>
          <div
            className="annotation-config-layout"
            data-preview-open={previewOpen}
          >
            <div className="annotation-config-main">
              {store.format === formatType.OperatorEditor ? (
                <PublicAnnotationOperatorsEditor store={store} />
              ) : store.format === formatType.AlgoEditor ? (
                <PublicAnnotationAlgoEditor store={store} />
              ) : (
                <PublicAnnotationJSONEditor store={store} />
              )}
            </div>
            {previewOpen && (
              <DataPreview store={store} onAnnotate={startAnnotation} />
            )}
          </div>
        </div>
      </div>
      <CacheManagerModal
        visible={showCacheManager}
        onClose={() => setShowCacheManager(false)}
      />
    </TaskLayout>
  );
});

export default PublicAnnotationTool;
