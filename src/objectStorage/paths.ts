import { t } from '../i18n';
import type {
  StorageConnection,
  StorageProvider,
  StorageSource,
} from './types';

export function cloudURL(
  provider: StorageProvider,
  bucket: string,
  key: string,
) {
  return `${provider}://${bucket}/${key
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}
export function parseCloudURL(value: string) {
  const match = /^(oss|obs|tos):\/\/([^/]+)\/(.*)$/i.exec(value);
  if (!match) return undefined;
  try {
    return {
      provider: match[1].toLowerCase() as StorageProvider,
      bucket: match[2],
      key: match[3].split('/').map(decodeURIComponent).join('/'),
    };
  } catch {
    throw new Error(t('Invalid object storage path encoding'));
  }
}
export const sourceKey = (source: Pick<StorageSource, 'provider' | 'bucket'>) =>
  `${source.provider}://${source.bucket}`;
export function directoryPrefix(value: string) {
  const prefix = value.trim().replace(/^\/+/, '');
  return prefix && !prefix.endsWith('/') ? `${prefix}/` : prefix;
}
export function defaultEndpoint(provider: StorageProvider, region: string) {
  const area = region.trim().replace(/^oss-/, '');
  if (provider === 'oss') return `https://oss-${area}.aliyuncs.com`;
  if (provider === 'obs') return `https://obs.${area}.myhuaweicloud.com`;
  return `https://tos-${area}.volces.com`;
}
export function publicSource(value: StorageSource): StorageSource {
  return {
    provider: value.provider,
    bucket: value.bucket,
    region: value.region,
    endpoint: value.endpoint,
    prefix: value.prefix,
  };
}
export function normalizeConnection(
  value: StorageConnection,
): StorageConnection {
  if (!['oss', 'obs', 'tos'].includes(value.provider))
    throw new Error(t('Select OSS, OBS, or TOS'));
  const bucket = value.bucket?.trim();
  const region = value.region?.trim().replace(/^oss-/, '');
  if (!bucket || !/^[a-z0-9][a-z0-9.-]*$/.test(bucket))
    throw new Error(t('Enter a valid bucket name'));
  if (!region || !/^[a-z0-9-]+$/i.test(region))
    throw new Error(t('Enter a valid region'));
  let endpoint: URL;
  try {
    endpoint = new URL(
      (
        value.endpoint?.trim() || defaultEndpoint(value.provider, region)
      ).replace(/\/$/, ''),
    );
  } catch {
    throw new Error(
      t(
        'Invalid endpoint. Enter a complete http:// or https:// service domain',
      ),
    );
  }
  if (
    !['https:', 'http:'].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== '/'
  )
    throw new Error(
      t(
        'The endpoint must contain only the service domain, such as https://oss-cn-hangzhou.aliyuncs.com',
      ),
    );
  if (!value.accessKeyId?.trim() || !value.accessKeySecret?.trim())
    throw new Error(t('Enter the access key ID and secret access key'));
  return {
    provider: value.provider,
    bucket,
    region,
    endpoint: endpoint.origin,
    prefix: directoryPrefix(value.prefix || ''),
    accessKeyId: value.accessKeyId.trim(),
    accessKeySecret: value.accessKeySecret.trim(),
    securityToken: value.securityToken?.trim() || undefined,
  };
}

export function referencedSources(input: unknown, includePublic = false) {
  const found = new Map<string, ReturnType<typeof parseCloudURL>>();
  function visit(value: unknown) {
    if (typeof value === 'string') {
      const source = parseCloudURL(value);
      if (
        source &&
        (includePublic ||
          !(source.provider === 'oss' && source.bucket === 'stardust-public'))
      )
        found.set(sourceKey(source), source);
    } else if (Array.isArray(value)) {
      if (typeof value[0] !== 'number') value.forEach(visit);
    } else if (value && typeof value === 'object')
      Object.values(value).forEach(visit);
  }
  visit(input);
  return [...found.values()].filter(Boolean) as NonNullable<
    ReturnType<typeof parseCloudURL>
  >[];
}
