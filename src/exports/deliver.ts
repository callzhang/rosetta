import { database } from '../localData/database';
import type { SessionExport } from '../localData/export';
import { downloadSessionExport } from '../localData/export';
import { createStorageClient, storageError } from '../objectStorage/adapters';
import { cloudURL } from '../objectStorage/paths';
import { apiExportURL, exportPrefix, normalizeApiTarget } from './settings';
import type { ExportMethod, ExportSettings } from './types';

export type ExportReceipt = {
  method: ExportMethod;
  location: string;
  status?: number;
};

function uploadError(error: any) {
  const code = String(error?.code || error?.Code || '');
  const status = Number(error?.status || error?.statusCode);
  if (
    status === 409 ||
    /AlreadyExists|FileAlreadyExists|PreconditionFailed/.test(code)
  )
    return '该导出文件已存在，请到对象存储确认结果；重新打开导出窗口可生成新文件名。';
  if (
    /ExpiredToken|InvalidToken|InvalidSecurityToken|SignatureDoesNotMatch|SignatureMismatch/i.test(
      code,
    )
  )
    return storageError(error);
  if (status === 403 || /AccessDenied|InvalidAccessKeyId/i.test(code))
    return '对象存储写入被拒绝，请检查凭证和目标目录的 PutObject 上传权限。';
  return '对象存储导出失败，请检查网络、Endpoint、上传权限，以及允许本站 PUT 请求的 CORS 配置。';
}

export async function deliverExport(
  payload: SessionExport,
  method: ExportMethod,
  settings: ExportSettings,
  dependencies: {
    request?: typeof fetch;
    createClient?: typeof createStorageClient;
  } = {},
): Promise<ExportReceipt> {
  if (method === 'download') {
    await downloadSessionExport(payload);
    return { method, location: payload.filename };
  }
  if (method === 'api') {
    if (!settings.api) throw new Error('请先配置 API 导出地址');
    const target = normalizeApiTarget(settings.api);
    const url = apiExportURL(target.url, payload.taskId);
    const headers = new Headers(
      target.headers.map<[string, string]>((header) => [
        header.name,
        header.value,
      ]),
    );
    if (!headers.has('Content-Type'))
      headers.set('Content-Type', 'application/json');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await (dependencies.request || fetch)(url, {
        method: target.method,
        headers,
        body: payload.blob,
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(
          `API 导出失败：HTTP ${response.status}，请检查接口和鉴权配置`,
        );
      return { method, location: url, status: response.status };
    } catch (error) {
      if (controller.signal.aborted)
        throw new Error('API 请求超时，请确认接收端是否已收到数据后再重试');
      if ((error as Error).name === 'TypeError')
        throw new Error('API 请求未完成，请检查地址、网络和接口的跨域配置');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  if (method === 'storage') {
    const target = settings.storage;
    if (!target) throw new Error('请先配置对象存储导出目标');
    const source = await (await database()).get('connections', target.sourceId);
    if (!source) throw new Error('导出数据源已被删除，请重新配置');
    const key = `${exportPrefix(target.prefix)}${payload.objectFilename}`;
    try {
      const client = await (dependencies.createClient || createStorageClient)(
        source.connection,
      );
      if (!client.put) throw new Error('该数据源不支持上传');
      await client.put(key, payload.blob);
    } catch (error) {
      throw new Error(uploadError(error));
    }
    return {
      method,
      location: cloudURL(
        source.connection.provider,
        source.connection.bucket,
        key,
      ),
    };
  }
  throw new Error('不支持的导出方式');
}
