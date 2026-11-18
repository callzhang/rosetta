import { useLanguage, t } from '../../i18n';
import { Progress, Tag } from 'antd';
import type { SessionSummary, TaskStatus } from '../../localData/sessionInfo';
import { taskStatusLabels } from '../../localData/sessionInfo';

export function TaskStatusTag({ status }: { status: TaskStatus }) {
  useLanguage();
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
  useLanguage();
  if (!task.count)
    return (
      <span className="task-secondary-text">
        {t('Waiting for data import')}
      </span>
    );
  if (task.legacyProgress)
    return (
      <span
        title={t(
          'Submission progress for this task is unconfirmed. Submit again to update it.',
        )}
      >
        {task.submittedCount
          ? t('{{v0}} / {{v1}} records confirmed', {
              v0: task.submittedCount,
              v1: task.count,
            })
          : t('Previous results available')}
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
