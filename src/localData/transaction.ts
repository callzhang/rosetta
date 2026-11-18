import { commitTransaction } from '../storage/transaction';
import type { IDBPTransaction, StoreNames } from 'idb';
import { database } from './database';
import type { Database } from './database';

// Await IndexedDB requests only inside the callback. Other async work can close
// the browser transaction before the next write reaches it.
export async function localTransaction<
  Stores extends StoreNames<Database>[],
  T,
>(
  stores: Stores,
  operation: (tx: IDBPTransaction<Database, Stores, 'readwrite'>) => Promise<T>,
): Promise<T> {
  const tx = (await database()).transaction(stores, 'readwrite');
  return commitTransaction(tx, () => operation(tx));
}
