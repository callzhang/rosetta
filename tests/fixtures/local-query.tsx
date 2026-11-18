import { createRoot } from 'react-dom/client';
import { useLocalQuery } from '../../src/localData/useLocalQuery';

interface QueryState {
  data?: string;
  loading: boolean;
  error: string;
}
interface PendingRead {
  key: string;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
}
export interface LocalQueryHarness {
  reads: PendingRead[];
  renders: Array<QueryState & { key: string }>;
  state: () => QueryState;
  render: (key: string) => void;
  refresh: () => void;
  unmount: () => void;
}

const reads: PendingRead[] = [];
const renders: LocalQueryHarness['renders'] = [];
let state: QueryState;
function Probe({ queryKey }: { queryKey: string }) {
  state = useLocalQuery(
    'tasks',
    () =>
      new Promise<string>((resolve, reject) =>
        reads.push({ key: queryKey, resolve, reject }),
      ),
    (error) => error.message,
    queryKey,
  );
  renders.push({ key: queryKey, ...state });
  return (
    <output>{state.loading ? 'Loading' : state.error || state.data}</output>
  );
}
const root = createRoot(document.getElementById('root')!);
const harness: LocalQueryHarness = {
  reads,
  renders,
  state: () => state,
  render: (queryKey) => root.render(<Probe queryKey={queryKey} />),
  refresh: () => window.dispatchEvent(new Event('rosetta:local-tasks')),
  unmount: () => root.unmount(),
};
Object.assign(window, { localQueryTest: harness });
