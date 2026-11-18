import { t } from '../i18n';
import { database } from '../localData/database';
import { notifyLocalChange } from '../localData/events';
import type { ApiExportTarget, ExportSettings } from './types';

export function apiExportURL(template: string, taskId: string) {
  const replaced = template.replace(/\{taskId\}/g, encodeURIComponent(taskId));
  if (/[{}]/.test(replaced))
    throw new Error(t('The API URL only supports the {taskId} placeholder'));
  let url: URL;
  try {
    url = new URL(replaced);
  } catch {
    throw new Error(
      t(
        'Enter a complete API URL, such as https://example.com/api/annotations',
      ),
    );
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error(
      t(
        'The API URL must use HTTP or HTTPS. Put authentication information in request headers',
      ),
    );
  return url.href;
}

export function normalizeApiTarget(value: ApiExportTarget): ApiExportTarget {
  const url = value.url.trim();
  apiExportURL(url, 'task-id');
  if (!['POST', 'PUT'].includes(value.method))
    throw new Error(t('Select POST or PUT as the API request method'));
  const seen = new Set<string>();
  const headers = (value.headers || []).flatMap((header) => {
    const name = (header.name || '').trim();
    const content = header.value || '';
    if (!name && !content) return [];
    const key = name.toLowerCase();
    if (!name) throw new Error(t('Enter a request header name'));
    if (seen.has(key))
      throw new Error(t('Duplicate request header: {{v0}}', { v0: name }));
    if (
      /^(sec-|proxy-)/.test(key) ||
      [
        'host',
        'origin',
        'cookie',
        'referer',
        'content-length',
        'connection',
        'user-agent',
        'accept-encoding',
        'access-control-request-method',
        'access-control-request-headers',
      ].includes(key)
    )
      throw new Error(
        t(
          'This header is managed by the browser and cannot be set manually: {{v0}}',
          { v0: name },
        ),
      );
    try {
      new Headers([[name, content]]);
    } catch {
      throw new Error(t('Invalid request header: {{v0}}', { v0: name }));
    }
    seen.add(key);
    return [{ name, value: content.trim() }];
  });
  return { url, method: value.method, headers };
}

export function exportPrefix(value: string) {
  const parts = (value || '').trim().split('/').filter(Boolean);
  if (
    parts.some(
      (part) => part === '.' || part === '..' || /[\0\r\n\\]/.test(part),
    )
  )
    throw new Error(
      t(
        'The export directory cannot contain ., .., backslashes, or control characters',
      ),
    );
  return parts.length ? `${parts.join('/')}/` : '';
}

export function normalizeExportSettings(
  value: Partial<ExportSettings>,
): ExportSettings {
  const defaultMethod = value.defaultMethod || 'download';
  if (!['download', 'api', 'storage'].includes(defaultMethod))
    throw new Error(t('Select a valid default export method'));
  const api = value.api?.url?.trim()
    ? normalizeApiTarget(value.api)
    : undefined;
  const storage = value.storage?.sourceId?.trim()
    ? {
        sourceId: value.storage.sourceId.trim(),
        prefix: exportPrefix(value.storage.prefix),
      }
    : undefined;
  if (defaultMethod === 'api' && !api)
    throw new Error(
      t('Configure the API URL before making it the default export method'),
    );
  if (defaultMethod === 'storage' && !storage)
    throw new Error(
      t(
        'Select an object storage data source before making it the default export method',
      ),
    );
  return { id: 'default', defaultMethod, api, storage, updatedAt: Date.now() };
}

export async function getExportSettings(): Promise<ExportSettings> {
  return (
    (await (await database()).get('exportSettings', 'default')) || {
      id: 'default',
      defaultMethod: 'download',
      updatedAt: 0,
    }
  );
}

export async function saveExportSettings(value: Partial<ExportSettings>) {
  const settings = normalizeExportSettings(value);
  const db = await database();
  const tx = db.transaction(['exportSettings', 'connections'], 'readwrite');
  try {
    if (
      settings.storage &&
      !(await tx.objectStore('connections').get(settings.storage.sourceId))
    )
      throw new Error(
        t('The destination data source was deleted. Select it again'),
      );
    await tx.objectStore('exportSettings').put(settings);
    await tx.done;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* It may already be aborted. */
    }
    await tx.done.catch(() => {});
    throw error;
  }
  notifyLocalChange('export-settings');
  return settings;
}
