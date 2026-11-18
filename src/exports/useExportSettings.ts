import { t } from '../i18n';
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
    t('Cannot read local export settings. Check browser storage'),
  );
  return { settings, loading, error };
}
