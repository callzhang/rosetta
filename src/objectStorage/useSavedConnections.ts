import { useLocalQuery } from '../localData/useLocalQuery';
import { listSavedConnections } from './savedConnections';

export function useSavedConnections() {
  const { data, loading, error } = useLocalQuery(
    'connections',
    listSavedConnections,
    '无法读取本地数据源，请检查浏览器本地存储',
  );
  return { sources: data ?? [], loading, error };
}
