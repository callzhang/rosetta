export function openBroadcastChannel(
  name: string,
): BroadcastChannel | undefined {
  try {
    return typeof BroadcastChannel === 'undefined'
      ? undefined
      : new BroadcastChannel(name);
  } catch {
    return undefined;
  }
}
export function broadcast(
  channel: BroadcastChannel | undefined,
  value: unknown,
) {
  try {
    channel?.postMessage(value);
  } catch {
    /* Focus refresh and same-tab events still work if broadcasting is blocked. */
  }
}
