import { useRequest } from 'ahooks';
import { useEffect } from 'react';
import { subscribeLocalChanges } from './events';
import type { LocalChangeTopic } from './events';

// useRequest owns cancellation and request ordering for both success and failure.
// The key also hides the previous task during the render before effects run.
export function useLocalQuery<T>(
  topic: LocalChangeTopic,
  load: () => Promise<T>,
  errorMessage: string | ((error: Error) => string),
  key: string = topic,
) {
  const { data, error, loading, params, run, cancel } = useRequest(
    async (requestKey: string) => ({ key: requestKey, value: await load() }),
    { manual: true, onError: () => {} },
  );

  useEffect(() => {
    const refresh = () => run(key);
    refresh();
    const unsubscribe = subscribeLocalChanges(topic, refresh);
    return () => {
      unsubscribe();
      cancel();
    };
  }, [topic, key, run, cancel]);

  const current = params[0] === key;
  return {
    data: data?.key === key ? data.value : undefined,
    loading: !current || loading,
    error:
      current && !loading && error
        ? typeof errorMessage === 'function'
          ? errorMessage(error)
          : errorMessage
        : '',
  };
}
