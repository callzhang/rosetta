import { normalizeConnection, sourceKey } from './paths';
import type { StorageClient, StorageConnection, StorageSource } from './types';

type Source = Pick<StorageSource, 'provider' | 'bucket'>;
const connections = new Map<
  string,
  { connection: StorageConnection; client: StorageClient }
>();
const listeners = new Set<() => void>();
export function subscribeConnections(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export const activeConnectionFor = (source: Source) =>
  connections.get(sourceKey(source));
export const hasConnection = (source: Source) =>
  connections.has(sourceKey(source));
export function rememberConnection(
  connection: StorageConnection,
  client: StorageClient,
) {
  const normalized = normalizeConnection(connection);
  connections.set(sourceKey(normalized), { connection: normalized, client });
  listeners.forEach((listener) => listener());
}
export function forgetConnection(source: Source) {
  if (connections.delete(sourceKey(source)))
    listeners.forEach((listener) => listener());
}
