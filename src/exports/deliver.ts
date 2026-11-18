import { t } from '../i18n';
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
    return t(
      'This export file already exists. Check object storage; reopen the export dialog to generate a new filename.',
    );
  if (
    /ExpiredToken|InvalidToken|InvalidSecurityToken|SignatureDoesNotMatch|SignatureMismatch/i.test(
      code,
    )
  )
    return storageError(error);
  if (status === 403 || /AccessDenied|InvalidAccessKeyId/i.test(code))
    return t(
      'Object storage denied the upload. Check the credentials and PutObject permission for the destination directory.',
    );
  return t(
    'Object storage export failed. Check the network, endpoint, upload permission, and CORS settings allowing PUT requests from this site.',
  );
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
    if (!settings.api) throw new Error(t('Configure the API export URL first'));
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
          t(
            'API export failed: HTTP {{v0}}. Check the endpoint and authentication settings',
            { v0: response.status },
          ),
        );
      return { method, location: url, status: response.status };
    } catch (error) {
      if (controller.signal.aborted)
        throw new Error(
          t(
            'The API request timed out. Check whether the receiver received the data before retrying',
          ),
        );
      if ((error as Error).name === 'TypeError')
        throw new Error(
          t(
            'The API request did not complete. Check the URL, network, and CORS settings',
          ),
        );
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  if (method === 'storage') {
    const target = settings.storage;
    if (!target)
      throw new Error(
        t('Configure the object storage export destination first'),
      );
    const source = await (await database()).get('connections', target.sourceId);
    if (!source)
      throw new Error(
        t('The export data source was deleted. Configure it again'),
      );
    const key = `${exportPrefix(target.prefix)}${payload.objectFilename}`;
    try {
      const client = await (dependencies.createClient || createStorageClient)(
        source.connection,
      );
      if (!client.put)
        throw new Error(t('This data source does not support uploads'));
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
  throw new Error(t('Unsupported export method'));
}
