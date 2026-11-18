import { t } from '../i18n';
import { createStorageClient } from './adapters';
import {
  normalizeConnection,
  parseCloudURL,
  publicSource,
  referencedSources,
  sourceKey,
} from './paths';
import { savedConnectionFor } from './savedConnections';
import type { StorageConnection, StorageSource } from './types';

import {
  activeConnectionFor,
  hasConnection,
  rememberConnection,
} from './activeConnections';
export {
  subscribeConnections,
  hasConnection,
  rememberConnection,
} from './activeConnections';

export async function restoreConnections(values: StorageConnection[]) {
  for (const value of values) {
    const connection = normalizeConnection(value);
    if (!hasConnection(connection))
      rememberConnection(connection, await createStorageClient(connection));
  }
}
export async function restoreSavedConnections(sources: StorageSource[]) {
  for (const source of sources) {
    const connection = await savedConnectionFor(source);
    const current = activeConnectionFor(source)?.connection;
    if (connection && JSON.stringify(connection) !== JSON.stringify(current))
      rememberConnection(connection, await createStorageClient(connection));
  }
}
export function connectionProfiles(
  input: unknown,
  previous: StorageSource[] = [],
): StorageSource[] {
  return referencedSources(input, true)
    .filter(
      (source) =>
        !(source.provider === 'oss' && source.bucket === 'stardust-public') ||
        hasConnection(source) ||
        previous.some((value) => sourceKey(value) === sourceKey(source)),
    )
    .map((source) => {
      const found =
        activeConnectionFor(source)?.connection ||
        previous.find((profile) => sourceKey(profile) === sourceKey(source));
      return found
        ? publicSource(found)
        : {
            provider: source.provider,
            bucket: source.bucket,
            region: '',
            endpoint: '',
            prefix: source.key.slice(0, source.key.lastIndexOf('/') + 1),
          };
    });
}
export function credentialsFor(sources: StorageSource[]) {
  return sources.flatMap((source) => {
    const value = activeConnectionFor(source);
    return value ? [{ ...value.connection }] : [];
  });
}
export function missingConnections(sources: StorageSource[]) {
  return sources.filter((source) => !hasConnection(source));
}
export async function resolveCloudResource(url: string) {
  const source = parseCloudURL(url);
  if (!source) throw new Error(t('Invalid object storage path'));
  const value = activeConnectionFor(source);
  if (!value)
    throw new Error(
      t('Connect to {{v1}} on {{v0}} first to read cloud files.', {
        v0: source.provider.toUpperCase(),
        v1: source.bucket,
      }),
    );
  return value.client.signedURL(source.key);
}
