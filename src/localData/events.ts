import { openBroadcastChannel, broadcast } from '../storage/channel';
// Only change notifications cross tabs. Task data and credentials stay in IndexedDB.
export type LocalChangeTopic =
  | 'tasks'
  | 'connections'
  | 'export-settings'
  | 'cache';

export function notifyLocalChange(topic: LocalChangeTopic) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(`rosetta:local-${topic}`));
  const channel = openBroadcastChannel(`rosetta:local-${topic}`);
  broadcast(channel, 'changed');
  channel?.close();
}

export function subscribeLocalChanges(
  topic: LocalChangeTopic,
  listener: () => void,
) {
  const event = `rosetta:local-${topic}`;
  window.addEventListener(event, listener);
  window.addEventListener('focus', listener);
  const channel = openBroadcastChannel(event);
  if (channel) channel.onmessage = listener;
  return () => {
    window.removeEventListener(event, listener);
    window.removeEventListener('focus', listener);
    channel?.close();
  };
}
