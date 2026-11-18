import { sourceKey } from './paths';
import {
  credentialsFor,
  missingConnections,
  restoreConnections,
} from './registry';
import type { StorageConnection, StorageSource } from './types';

const messageType = 'rosetta:cloud-credentials';

export function prepareCredentialHandoff(
  target: Window,
  sessionId: string,
  sources: StorageSource[],
) {
  const origin = window.location.origin;
  let timeout: ReturnType<typeof setTimeout>;
  const clean = () => {
    window.removeEventListener('message', receive);
    clearTimeout(timeout);
    try {
      target.opener = null;
    } catch {}
  };
  function receive(event: MessageEvent) {
    if (
      event.origin !== origin ||
      event.source !== target ||
      event.data?.type !== messageType ||
      event.data?.sessionId !== sessionId ||
      !event.ports[0]
    )
      return;
    event.ports[0].postMessage({
      nonce: event.data.nonce,
      connections: credentialsFor(sources),
    });
    event.ports[0].close();
    clean();
  }
  window.addEventListener('message', receive);
  timeout = setTimeout(clean, 60000);
  return clean;
}

export async function receiveCredentialHandoff(
  sessionId: string,
  sources: StorageSource[],
) {
  if (!window.opener || !missingConnections(sources).length) return;
  const origin = window.location.origin;
  const nonce = crypto.randomUUID();
  await new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    const finish = () => {
      clearTimeout(timeout);
      channel.port1.close();
      resolve();
    };
    const timeout = setTimeout(finish, 8000);
    channel.port1.onmessage = async (event) => {
      if (event.data?.nonce !== nonce || !Array.isArray(event.data.connections))
        return;
      const allowed = new Set(sources.map(sourceKey));
      try {
        await restoreConnections(
          (event.data.connections as StorageConnection[]).filter((value) =>
            allowed.has(sourceKey(value)),
          ),
        );
      } catch {
        /* Reconnect through the form if a transferred connection is invalid. */
      } finally {
        finish();
      }
    };
    try {
      window.opener.postMessage(
        { type: messageType, sessionId, nonce },
        origin,
        [channel.port2],
      );
    } catch {
      finish();
    }
  });
  window.opener = null;
}
