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
      title="任务列表"
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
          aria-label="搜索任务"
          placeholder="搜索任务名称或来源"
          allowClear
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {error && <Alert type="error" showIcon message={error} />}
      <div className="annotation-task-items" aria-label="任务列表内容">
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
                <small>{task.count ? task.source : '等待导入数据'}</small>
              </span>
              <TaskStatusTag status={task.status} />
            </button>
          ))
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={tasks.length ? '没有匹配的任务' : '暂无任务'}
          />
        )}
      </div>
    </Drawer>
  );
}
