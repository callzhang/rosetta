import {
  DownloadOutlined,
  PlayCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import {
  Button,
  message,
  useNavigate,
  useParams,
  useSearchParams,
} from '@stardustai/annotation-client';
import { Alert, Descriptions, Spin, Tree } from 'antd';
import { useState } from 'react';
import ExportTaskModal from '../../exports/ExportTaskModal';
import { buildFileTree } from '../../localData/fileTree';
import { openSavedAnnotation } from '../../localData/openAnnotation';
import { dataKindLabels, kindFromRecord } from '../../localData/presets';
import { sessionRecords } from '../../localData/sessionInfo';
import { inputResults } from '../../localData/taskInput';
import TaskLayout from './TaskLayout';
import { TaskStatusTag } from './TaskStatus';
import { useLocalTask } from './useLocalTasks';

export default function TaskDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { task, loading, error } = useLocalTask(id);
  const [busy, setBusy] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  if (loading)
    return (
      <TaskLayout>
        <div className="task-loading">
          <Spin />
        </div>
      </TaskLayout>
    );
  if (!task)
    return (
      <TaskLayout>
        <Alert
          type="error"
          showIcon
          message={error || '任务不存在'}
          action={
            <Button onClick={() => navigate('/tasks')}>返回任务列表</Button>
          }
        />
      </TaskLayout>
    );
  const records = sessionRecords(task.input);
  const files = buildFileTree(records);
  const result = inputResults(task.input)[0];
  const kind = kindFromRecord(records[0]);
  return (
    <TaskLayout
      task={task}
      section={params.get('view') === 'results' ? 'results' : 'overview'}
    >
      <div className="task-page-heading">
        <div>
          <h1>{task.name}</h1>
          <p>
            {task.description || '当前任务对应一条数据，标注结果独立保存。'}
          </p>
        </div>
        <div className="task-heading-actions">
          <Button
            icon={<SettingOutlined />}
            onClick={() => navigate(`/annotationTool?task=${task.id}`)}
          >
            配置标注工具
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => setExportOpen(true)}
          >
            导出
          </Button>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await openSavedAnnotation(task.id, null);
              } catch (error) {
                message.error((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            进入标注
          </Button>
        </div>
      </div>
      <div className="task-list-panel task-data-details">
        <Descriptions size="small" column={2}>
          <Descriptions.Item label="状态">
            <TaskStatusTag status={task.status} />
          </Descriptions.Item>
          <Descriptions.Item label="数据类型">
            {kind ? dataKindLabels[kind] : records[0]?.attachmentType}
          </Descriptions.Item>
          <Descriptions.Item label="Attachment 类型">
            {records[0]?.attachmentType}
          </Descriptions.Item>
          <Descriptions.Item label="文件数量">{files.count}</Descriptions.Item>
          <Descriptions.Item label="上次提交">
            {task.lastSavedAt
              ? new Date(task.lastSavedAt).toLocaleString()
              : '尚未提交'}
          </Descriptions.Item>
        </Descriptions>
      </div>
      <div className="task-data-columns">
        <section className="task-list-panel task-data-details">
          <h2>文件列表</h2>
          <Tree treeData={files.tree} defaultExpandAll selectable={false} />
        </section>
        <section className="task-list-panel task-data-details">
          <h2>标注结果</h2>
          {result ? (
            <pre className="task-result-json">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : (
            <p>此数据尚未保存标注结果，进入标注工作台后提交。</p>
          )}
        </section>
      </div>
      {exportOpen && (
        <ExportTaskModal
          sessionId={task.id}
          onClose={() => setExportOpen(false)}
        />
      )}
    </TaskLayout>
  );
}
