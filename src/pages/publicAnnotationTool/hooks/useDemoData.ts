import i18next from 'i18next';
import { useEffect, useMemo, useReducer } from 'react';
import { getDemoData } from '../demoData';

export function useDemoData() {
  const [version, refresh] = useReducer((value: number) => value + 1, 0);
  useEffect(() => {
    i18next.on('initialized', refresh);
    i18next.on('languageChanged', refresh);
    i18next.on('loaded', refresh);
    // Initialization may have completed between render and subscription.
    refresh();
    return () => {
      i18next.off('initialized', refresh);
      i18next.off('languageChanged', refresh);
      i18next.off('loaded', refresh);
    };
  }, []);
  return useMemo(() => getDemoData(), [version]);
}
