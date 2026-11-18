import { Progress, Tag } from 'antd';
import type { SessionSummary, TaskStatus } from '../../localData/sessionInfo';
import { taskStatusLabels } from '../../localData/sessionInfo';

export function TaskStatusTag({ status }: { status: TaskStatus }) {
  const colors: Record<TaskStatus, string> = {
    draft: 'default',
    pending: 'default',
    in_progress: 'processing',
    completed: 'success',
  };
  return <Tag color={colors[status]}>{taskStatusLabels[status]}</Tag>;
}

export function TaskProgress({
  task,
}: {
  task: Pick<SessionSummary, 'count' | 'submittedCount' | 'legacyProgress'>;
}) {
  if (!task.count)
    return <span className="task-secondary-text">等待导入数据</span>;
  if (task.legacyProgress)
    return (
      <span title="该任务的提交进度尚未确认，重新提交后更新。">
        {task.submittedCount
          ? `${task.submittedCount} / ${task.count} 条已确认`
          : '已有历史结果'}
      </span>
    );
  return (
    <div className="task-progress">
      <Progress
        size="small"
        showInfo={false}
        percent={Math.round((task.submittedCount / task.count) * 100)}
      />
      <span>
        {task.submittedCount} / {task.count}
      </span>
    </div>
  );
}
