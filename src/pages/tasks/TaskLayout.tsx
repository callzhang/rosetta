import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  CheckSquareOutlined,
  CloudServerOutlined,
  ExportOutlined,
  MenuOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  Button,
  Link,
  message,
  useLocation,
  useNavigate,
} from '@stardustai/annotation-client';
import { Breadcrumb } from 'antd';
import type { MouseEvent, ReactNode } from 'react';
import { useState } from 'react';
import logo from '../../assets/logo2.png';

export type TaskSection = 'overview' | 'configuration' | 'results';
export default function TaskLayout({
  children,
  task,
  section = 'overview',
  onBeforeNavigate,
  footer,
  actions,
  contentClassName = '',
  onStartNew,
}: {
  children: ReactNode;
  task?: { id: string; name: string };
  section?: TaskSection;
  onBeforeNavigate?: () => Promise<void | boolean>;
  footer?: ReactNode;
  actions?: ReactNode;
  contentClassName?: string;
  onStartNew?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const inSources = location.pathname.startsWith('/dataSources');
  const inExports = location.pathname.startsWith('/exportSettings');
  const inQuickStart =
    !task &&
    (location.pathname === '/' || location.pathname === '/annotationTool');
  const labels = {
    overview: '任务详情',
    configuration: '标注工具',
    results: '标注结果',
  };
  async function leave(to: string) {
    if (leaving) return;
    setLeaving(true);
    try {
      if ((await onBeforeNavigate?.()) === false) return;
      setMenuOpen(false);
      navigate(to);
    } catch (error) {
      message.error((error as Error).message || '保存失败，请重试');
    } finally {
      setLeaving(false);
    }
  }
  function follow(event: MouseEvent<HTMLAnchorElement>, to: string) {
    if (
      event.button ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    setMenuOpen(false);
    if (to === '/' && inQuickStart && onStartNew) {
      event.preventDefault();
      onStartNew();
      return;
    }
    if (onBeforeNavigate) {
      event.preventDefault();
      void leave(to);
    }
  }
  function item(to: string, label: string, icon: ReactNode, active: boolean) {
    return (
      <Link
        to={to}
        onClick={(event) => follow(event, to)}
        className={`workspace-nav-item${active ? ' is-active' : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        {icon}
        <span>{label}</span>
      </Link>
    );
  }
  const crumbs = [
    {
      title: (
        <Link to="/" onClick={(event) => follow(event, '/')}>
          开始标注
        </Link>
      ),
    },
    ...(task
      ? [
          {
            title: (
              <Link
                to={`/tasks/${task.id}`}
                className="workspace-breadcrumb-task"
                onClick={(event) => follow(event, `/tasks/${task.id}`)}
              >
                {task.name}
              </Link>
            ),
          },
          { title: labels[section] },
        ]
      : inSources
      ? [{ title: '数据源' }]
      : inExports
      ? [{ title: '导出设置' }]
      : inQuickStart
      ? []
      : [{ title: '任务管理' }]),
  ];
  return (
    <div className="workspace-shell">
      {menuOpen && (
        <button
          className="workspace-menu-overlay"
          aria-label="关闭菜单"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className={`workspace-sidebar${menuOpen ? ' is-open' : ''}`}
        aria-label="工作区菜单"
      >
        <Link
          className="workspace-brand"
          to="/"
          onClick={(event) => follow(event, '/')}
        >
          <img src={logo} alt="STARDUST" />
          <span>独立标注工具</span>
        </Link>
        <div className="workspace-nav-label">工作区</div>
        <nav aria-label="功能模块">
          {item('/', '开始标注', <ThunderboltOutlined />, inQuickStart)}
          {item(
            '/tasks',
            '任务管理',
            <AppstoreOutlined />,
            !inQuickStart && !inSources && !inExports,
          )}
          {item('/dataSources', '数据源', <CloudServerOutlined />, inSources)}
          {item('/exportSettings', '导出设置', <ExportOutlined />, inExports)}
        </nav>
        {task && (
          <div className="workspace-task-menu">
            <div className="workspace-nav-label">当前任务</div>
            <div className="workspace-current-task" title={task.name}>
              <span>{task.name}</span>
            </div>
            <nav aria-label="当前任务菜单">
              {item(
                `/tasks/${task.id}`,
                '任务详情',
                <AppstoreOutlined />,
                section === 'overview',
              )}
              {item(
                `/annotationTool?task=${task.id}`,
                '标注工具',
                <SettingOutlined />,
                section === 'configuration',
              )}
              {item(
                `/tasks/${task.id}?view=results`,
                '标注结果',
                <CheckSquareOutlined />,
                section === 'results',
              )}
            </nav>
            <Link
              className="workspace-task-exit"
              to="/tasks"
              onClick={(event) => follow(event, '/tasks')}
            >
              <ArrowLeftOutlined />
              返回任务列表
            </Link>
          </div>
        )}
        <div className="workspace-local-status">
          <span className="workspace-status-dot" />
          本机存储<small>数据保存在此浏览器</small>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar">
          <Button
            className="workspace-menu-toggle"
            aria-label="打开菜单"
            aria-expanded={menuOpen}
            icon={<MenuOutlined />}
            onClick={() => setMenuOpen(!menuOpen)}
          />
          <Breadcrumb items={crumbs} />
          <div className="workspace-topbar-actions">
            {actions}
            {task && (
              <Button
                icon={<ArrowLeftOutlined />}
                loading={leaving}
                onClick={() => leave('/tasks')}
              >
                返回任务列表
              </Button>
            )}
          </div>
        </header>
        <main className={`workspace-content ${contentClassName}`}>
          {children}
        </main>
        {footer && <footer className="workspace-footer">{footer}</footer>}
      </div>
    </div>
  );
}
