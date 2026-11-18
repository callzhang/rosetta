export async function commitTransaction<T>(
  transaction: { done: Promise<unknown>; abort(): void },
  operation: () => Promise<T>,
): Promise<T> {
  try {
    const value = await operation();
    await transaction.done;
    return value;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      /* already settled */
    }
    await transaction.done.catch(() => {});
    throw error;
  }
}
