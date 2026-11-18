import { database } from '../localData/database';
import { notifyLocalChange } from '../localData/events';
import type { ApiExportTarget, ExportSettings } from './types';

export function apiExportURL(template: string, taskId: string) {
  const replaced = template.replace(/\{taskId\}/g, encodeURIComponent(taskId));
  if (/[{}]/.test(replaced)) throw new Error('API 地址只支持 {taskId} 占位符');
  let url: URL;
  try {
    url = new URL(replaced);
  } catch {
    throw new Error(
      '请输入完整的 API 地址，例如 https://example.com/api/annotations',
    );
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error('API 地址需使用 HTTP / HTTPS，鉴权信息请放在请求头中');
  return url.href;
}

export function normalizeApiTarget(value: ApiExportTarget): ApiExportTarget {
  const url = value.url.trim();
  apiExportURL(url, 'task-id');
  if (!['POST', 'PUT'].includes(value.method))
    throw new Error('API 请求方法请选择 POST 或 PUT');
  const seen = new Set<string>();
  const headers = (value.headers || []).flatMap((header) => {
    const name = (header.name || '').trim();
    const content = header.value || '';
    if (!name && !content) return [];
    const key = name.toLowerCase();
    if (!name) throw new Error('请填写请求头名称');
    if (seen.has(key)) throw new Error(`请求头重复：${name}`);
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
      throw new Error(`该请求头由浏览器管理，不能手动设置：${name}`);
    try {
      new Headers([[name, content]]);
    } catch {
      throw new Error(`请求头格式不正确：${name}`);
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
    throw new Error('导出目录不能包含 .、..、反斜杠或控制字符');
  return parts.length ? `${parts.join('/')}/` : '';
}

export function normalizeExportSettings(
  value: Partial<ExportSettings>,
): ExportSettings {
  const defaultMethod = value.defaultMethod || 'download';
  if (!['download', 'api', 'storage'].includes(defaultMethod))
    throw new Error('请选择有效的默认导出方式');
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
    throw new Error('请配置 API 地址后再设为默认导出方式');
  if (defaultMethod === 'storage' && !storage)
    throw new Error('请选择对象存储数据源后再设为默认导出方式');
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
      throw new Error('目标数据源已被删除，请重新选择');
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
