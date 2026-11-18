import { listSessions, loadSession } from '../../localData/storage';
import { useLocalQuery } from '../../localData/useLocalQuery';

export function useTaskList() {
  const { data, loading, error } = useLocalQuery(
    'tasks',
    listSessions,
    '无法读取本地任务，请检查浏览器存储是否可用。',
  );
  return { tasks: data ?? [], loading, error };
}

export function useLocalTask(id: string) {
  const {
    data: task,
    loading,
    error,
  } = useLocalQuery(
    'tasks',
    () => loadSession(id),
    (error) => error.message,
    id,
  );
  return { task, loading, error };
}
