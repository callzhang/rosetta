import { useLanguage, t } from '../../i18n';
import { Alert, Drawer, Empty, Input, Spin } from 'antd';
import { useRef, useState } from 'react';
import type { SessionSummary } from '../../localData/sessionInfo';
import { TaskStatusTag } from './TaskStatus';

export default function AnnotationTaskDrawer({
  open,
  tasks,
  currentTaskId,
  loading,
  error,
  disabled,
  onSelect,
  onClose,
}: {
  open: boolean;
  tasks: SessionSummary[];
  currentTaskId: string;
  loading: boolean;
  error: string;
  disabled: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  useLanguage();
  const [query, setQuery] = useState('');
  const current = useRef<HTMLButtonElement>(null);
  const search = query.trim().toLowerCase();
  const rows = tasks.filter((task) =>
    `${task.name} ${task.description} ${task.source}`
      .toLowerCase()
      .includes(search),
  );

  return (
    <Drawer
      title={t('Task list')}
      placement="left"
      width="min(360px, 100vw)"
      rootClassName="annotation-task-drawer"
      open={open}
      onClose={onClose}
      afterOpenChange={(visible) => {
        if (visible) current.current?.scrollIntoView?.({ block: 'center' });
      }}
      styles={{
        body: {
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
        },
      }}
    >
      <div className="annotation-task-search">
        <Input.Search
          aria-label={t('Search tasks')}
          placeholder={t('Search by task name or source')}
          allowClear
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {error && <Alert type="error" showIcon message={error} />}
      <div
        className="annotation-task-items"
        aria-label={t('Task list content')}
      >
        {loading ? (
          <div className="task-loading">
            <Spin />
          </div>
        ) : rows.length ? (
          rows.map((task) => (
            <button
              key={task.id}
              ref={task.id === currentTaskId ? current : undefined}
              type="button"
              className="annotation-task-item"
              aria-current={task.id === currentTaskId ? 'page' : undefined}
              disabled={disabled || !task.count}
              onClick={() => onSelect(task.id)}
            >
              <span className="annotation-task-name">
                <strong title={task.name}>{task.name}</strong>
                <small>
                  {task.count ? task.source : t('Waiting for data import')}
                </small>
              </span>
              <TaskStatusTag status={task.status} />
            </button>
          ))
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              tasks.length ? t('No matching tasks') : t('No tasks yet')
            }
          />
        )}
      </div>
    </Drawer>
  );
}
