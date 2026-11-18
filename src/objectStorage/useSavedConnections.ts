import { t } from '../i18n';
import { useLocalQuery } from '../localData/useLocalQuery';
import { listSavedConnections } from './savedConnections';

export function useSavedConnections() {
  const { data, loading, error } = useLocalQuery(
    'connections',
    listSavedConnections,
    t('Cannot read local data sources. Check browser storage'),
  );
  return { sources: data ?? [], loading, error };
}
