import type { StorageClient, StorageConnection, StoragePage } from './types';

const expires = 12 * 60 * 60;
const more = (value: unknown) => value === true || value === 'true';

function nextPage(page: StoragePage, truncated: unknown) {
  if (more(truncated) && !page.nextCursor)
    throw new Error('对象存储返回了未完成的文件列表，但没有下一页标记');
  return page;
}

interface ListedObjects {
  Contents?: Array<{
    Key: string;
    Size: number | string;
    LastModified?: string;
  }>;
  CommonPrefixes?: Array<{ Prefix: string }>;
  IsTruncated?: boolean | string;
}
function listedPage(data: ListedObjects, cursor?: string) {
  return nextPage(
    {
      objects: (data.Contents || []).map((item) => ({
        key: item.Key,
        size: Number(item.Size),
        lastModified: item.LastModified,
      })),
      directories: (data.CommonPrefixes || []).map((item) => item.Prefix),
      nextCursor: more(data.IsTruncated) ? cursor : undefined,
    },
    data.IsTruncated,
  );
}

export function ossAdapter(client: any): StorageClient {
  return {
    async put(key, body) {
      await client.put(key, body, {
        mime: 'application/json',
        headers: { 'x-oss-forbid-overwrite': 'true' },
      });
    },
    async list({ prefix, delimiter, cursor }) {
      const result = await client.listV2({
        'max-keys': 1000,
        // ali-oss 6.x signs empty/undefined query values differently from the wire URL.
        // Root listings must omit prefix; recursive listings must omit delimiter.
        ...(prefix ? { prefix } : {}),
        ...(delimiter ? { delimiter } : {}),
        ...(cursor ? { 'continuation-token': cursor } : {}),
      });
      return nextPage(
        {
          objects: (result.objects || []).map((item: any) => ({
            key: item.name,
            size: Number(item.size),
            lastModified: item.lastModified,
          })),
          directories: result.prefixes || [],
          nextCursor: more(result.isTruncated)
            ? result.nextContinuationToken
            : undefined,
        },
        result.isTruncated,
      );
    },
    async signedURL(key) {
      return client.signatureUrlV4('GET', expires, undefined, key);
    },
  };
}

export function obsAdapter(client: any, bucket: string): StorageClient {
  return {
    async put(key, body) {
      await new Promise<void>((resolve, reject) =>
        client.putObject(
          {
            Bucket: bucket,
            Key: key,
            SourceFile: body,
            ContentType: 'application/json',
            ForbidOverwrite: true,
          },
          (error: unknown, response: any) => {
            if (error) reject(error);
            else if (
              !(
                Number(response?.CommonMsg?.Status) >= 200 &&
                Number(response?.CommonMsg?.Status) < 300
              )
            )
              reject(
                Object.assign(new Error('OBS 上传失败'), {
                  code: response?.CommonMsg?.Code,
                  status: response?.CommonMsg?.Status,
                }),
              );
            else resolve();
          },
        ),
      );
    },
    async list({ prefix, delimiter, cursor }) {
      const result: any = await new Promise((resolve, reject) =>
        client.listObjects(
          {
            Bucket: bucket,
            MaxKeys: 1000,
            ...(prefix ? { Prefix: prefix } : {}),
            ...(delimiter ? { Delimiter: delimiter } : {}),
            ...(cursor ? { Marker: cursor } : {}),
          },
          (error: unknown, response: any) => {
            if (error) reject(error);
            else if (response?.CommonMsg?.Status >= 300)
              reject(
                Object.assign(new Error('OBS 请求失败'), {
                  code: response.CommonMsg.Code,
                  status: response.CommonMsg.Status,
                }),
              );
            else resolve(response);
          },
        ),
      );
      const data = result.InterfaceResult || {};
      return listedPage(data, data.NextMarker);
    },
    async signedURL(key) {
      return client.createSignedUrlSync({
        Method: 'GET',
        Bucket: bucket,
        Key: key,
        Expires: expires,
      }).SignedUrl;
    },
  };
}

export function tosAdapter(client: any, bucket: string): StorageClient {
  return {
    async put(key, body) {
      await client.putObject({
        bucket,
        key,
        body,
        contentType: 'application/json',
        forbidOverwrite: true,
      });
    },
    async list({ prefix, delimiter, cursor }) {
      const { data } = await client.listObjectsType2({
        bucket,
        maxKeys: 1000,
        listOnlyOnce: true,
        ...(prefix ? { prefix } : {}),
        ...(delimiter ? { delimiter } : {}),
        ...(cursor ? { continuationToken: cursor } : {}),
      });
      return listedPage(data, data.NextContinuationToken);
    },
    async signedURL(key) {
      return client.getPreSignedUrl({ bucket, key, method: 'GET', expires });
    },
  };
}

export async function createStorageClient(
  connection: StorageConnection,
): Promise<StorageClient> {
  const {
    provider,
    accessKeyId,
    accessKeySecret,
    securityToken,
    region,
    endpoint,
    bucket,
  } = connection;
  if (provider === 'oss') {
    const { default: OSS } = await import('ali-oss');
    const options = {
      region: `oss-${region}`,
      endpoint,
      bucket,
      accessKeyId,
      accessKeySecret,
      stsToken: securityToken,
      authorizationV4: true,
      secure: endpoint.startsWith('https:'),
      timeout: 30000,
    };
    return ossAdapter(new OSS(options));
  }
  if (provider === 'obs') {
    const { default: ObsClient } = await import('esdk-obs-browserjs');
    return obsAdapter(
      new ObsClient({
        access_key_id: accessKeyId,
        secret_access_key: accessKeySecret,
        security_token: securityToken,
        server: endpoint,
        timeout: 30,
      }),
      bucket,
    );
  }
  const { TosClient } = await import('@volcengine/tos-sdk');
  return tosAdapter(
    new TosClient({
      accessKeyId,
      accessKeySecret,
      stsToken: securityToken,
      region,
      endpoint: new URL(endpoint).host,
      secure: endpoint.startsWith('https:'),
      requestTimeout: 30000,
    }),
    bucket,
  );
}

export function storageError(error: any) {
  if (error?.name === 'AbortError') return '已取消读取';
  if (/^(对象存储返回|对象存储的分页|目录分页)/.test(error?.message || ''))
    return error.message;
  const status = Number(
    error?.status || error?.statusCode || error?.response?.status,
  );
  const code = String(error?.code || error?.Code || error?.error?.Code || '');
  if (
    /ExpiredToken|InvalidToken|InvalidSecurityToken|TokenRefreshRequired/i.test(
      code,
    )
  )
    return '临时凭证已过期或无效，请重新连接对象存储。';
  if (/SignatureDoesNotMatch|SignatureMismatch/i.test(code))
    return '签名校验失败，请刷新页面后重试；若仍失败，请核对 AK/SK 是否配对、Region 和 Endpoint 是否对应，以及临时凭证的 Token。';
  if (status === 403 || /AccessDenied|InvalidAccessKeyId/i.test(code))
    return '访问被拒绝，请检查 AK/SK、Region，以及此目录的列举和读取权限。';
  if (status === 404 || /NoSuchBucket/i.test(code))
    return 'Bucket 或文件不存在，请检查 Bucket 和 Endpoint。';
  return '无法读取对象存储，请检查网络、Endpoint、凭证，以及 Bucket 的 CORS 设置（允许当前站点的 GET、HEAD）。';
}
