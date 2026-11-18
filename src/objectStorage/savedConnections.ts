import { t } from '../i18n';
import { forgetConnection } from './activeConnections';
import { database } from '../localData/database';
import { localTransaction } from '../localData/transaction';
import { notifyLocalChange } from '../localData/events';
import { normalizeConnection, sourceKey } from './paths';
import type { StorageConnection, StorageSource } from './types';

export async function listSavedConnections() {
  const values = await (await database()).getAll('connections');
  return values.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveConnection(
  value: StorageConnection,
  name?: string,
  options: { previousId?: string; requireNew?: boolean } = {},
) {
  const connection = normalizeConnection(value);
  const id = sourceKey(connection);
  const saved = await localTransaction(['connections'], async (tx) => {
    const previous = await tx
      .objectStore('connections')
      .get(options.previousId || id);
    const target =
      options.previousId && options.previousId !== id
        ? await tx.objectStore('connections').get(id)
        : previous;
    if (options.previousId && !previous)
      throw new Error(
        t('The data source was deleted. Refresh the list and try again'),
      );
    if (
      (options.requireNew && target) ||
      (options.previousId !== id && options.previousId && target)
    )
      throw new Error(
        t(
          'This bucket already has a saved data source. Edit the existing data source',
        ),
      );
    const value = {
      id,
      name: name?.trim() || previous?.name || connection.bucket,
      connection,
      createdAt: previous?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    await tx.objectStore('connections').put(value);
    if (options.previousId && options.previousId !== id)
      await tx.objectStore('connections').delete(options.previousId);
    return value;
  });
  forgetConnection(connection);
  if (options.previousId && options.previousId !== id) {
    const [provider, bucket] = options.previousId.split('://');
    if (provider === 'oss' || provider === 'obs' || provider === 'tos')
      forgetConnection({ provider, bucket });
  }
  notifyLocalChange('connections');
  return saved;
}

export async function deleteSavedConnection(
  source: Pick<StorageSource, 'provider' | 'bucket'>,
) {
  await (await database()).delete('connections', sourceKey(source));
  forgetConnection(source);
  notifyLocalChange('connections');
}

export async function savedConnectionFor(source: StorageSource) {
  const saved = await (await database()).get('connections', sourceKey(source));
  if (!saved) return undefined;
  // An imported task can target a different endpoint with the same bucket name.
  if (source.region && source.region !== saved.connection.region)
    return undefined;
  if (source.endpoint && source.endpoint !== saved.connection.endpoint)
    return undefined;
  return saved.connection;
}
