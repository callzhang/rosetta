import { useLocalQuery } from '../localData/useLocalQuery';
import { getExportSettings } from './settings';

export function useExportSettings() {
  const {
    data: settings,
    loading,
    error,
  } = useLocalQuery(
    'export-settings',
    getExportSettings,
    '无法读取本地导出设置，请检查浏览器存储',
  );
  return { settings, loading, error };
}
