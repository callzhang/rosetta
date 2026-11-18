import { t } from '../../i18n';
import { listSessions, loadSession } from '../../localData/storage';
import { useLocalQuery } from '../../localData/useLocalQuery';

export function useTaskList() {
  const { data, loading, error } = useLocalQuery(
    'tasks',
    listSessions,
    t('Cannot read local tasks. Check whether browser storage is available.'),
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
