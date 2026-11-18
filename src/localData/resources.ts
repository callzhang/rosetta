import { parseCloudURL } from '../objectStorage/paths';
import { hasConnection, resolveCloudResource } from '../objectStorage/registry';
import { getLocalFile } from './storage';

const urls = new Map<string, Promise<string>>();
export async function resolveLocalResource(
  url: string,
  fallback: (url: string) => Promise<string>,
): Promise<string> {
  if (url.startsWith('local://')) {
    if (!urls.has(url)) {
      const pending = getLocalFile(url).then((blob) =>
        URL.createObjectURL(blob),
      );
      urls.set(url, pending);
      pending.catch(() => urls.delete(url));
    }
    return urls.get(url)!;
  }
  if (/^(https?:|blob:|data:|\/)/.test(url)) return url;
  const source = parseCloudURL(url);
  if (
    source &&
    (hasConnection(source) ||
      source.provider !== 'oss' ||
      source.bucket !== 'stardust-public')
  )
    return resolveCloudResource(url);
  return fallback(url);
}
window.addEventListener('pagehide', (event) => {
  if (event.persisted) return;
  urls.forEach((promise) => promise.then(URL.revokeObjectURL).catch(() => {}));
  urls.clear();
});
