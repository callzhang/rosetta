import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { IncomingHttpHeaders } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { createStorageClient } from '../src/objectStorage/adapters';
import { createDOMFixture } from './support/dom';

test('OBS and TOS keep signed listing and JSON uploads working with maintained axios', async (t) => {
  const bundle = await build({
    entryPoints: [
      fileURLToPath(
        new URL('./fixtures/storage-transport.ts', import.meta.url),
      ),
    ],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    alias: {
      'axios/lib/core/createError': fileURLToPath(
        new URL('../src/objectStorage/axiosLegacyError.ts', import.meta.url),
      ),
    },
    define: { 'process.env.NODE_ENV': '"test"' },
  });
  const requests: Array<{
    method: string;
    url: URL;
    headers: IncomingHttpHeaders;
    body: string;
  }> = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const url = new URL(request.url!, 'http://storage.test');
    requests.push({
      method: request.method!,
      url,
      headers: request.headers,
      body: Buffer.concat(chunks).toString(),
    });
    const tos = Boolean(request.headers['x-tos-date']);
    response.setHeader('x-tos-request-id', 'tos-fixture');
    response.setHeader('x-obs-request-id', 'obs-fixture');
    response.setHeader('ETag', '"fixture-etag"');
    if (url.searchParams.get('prefix') === 'forbidden/') {
      response.statusCode = 403;
      response.setHeader(
        'Content-Type',
        tos ? 'application/json' : 'application/xml',
      );
      response.end(
        tos
          ? JSON.stringify({
              Code: 'AccessDenied',
              Message: 'Access denied',
              RequestId: 'tos-fixture',
            })
          : '<Error><Code>AccessDenied</Code><Message>Access denied</Message><RequestId>obs-fixture</RequestId></Error>',
      );
    } else if (request.method === 'PUT') {
      response.end();
    } else if (tos) {
      response.setHeader('Content-Type', 'application/json');
      response.end(
        JSON.stringify({
          Contents: [{ Key: 'samples/a b.txt', Size: 12 }],
          CommonPrefixes: [{ Prefix: 'samples/sub/' }],
          IsTruncated: true,
          NextContinuationToken: 'next +/=',
        }),
      );
    } else {
      response.setHeader('Content-Type', 'application/xml');
      response.end(
        '<ListBucketResult><Name>fixture-bucket</Name><Contents><Key>samples/a b.txt</Key><Size>12</Size></Contents><CommonPrefixes><Prefix>samples/sub/</Prefix></CommonPrefixes><IsTruncated>true</IsTruncated><NextMarker>next +/=</NextMarker></ListBucketResult>',
      );
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const endpoint = `http://127.0.0.1:${address.port}`;
  const { dom, window, errors } = createDOMFixture(endpoint);
  const open = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async = true,
    user?: string,
    password?: string,
  ) {
    // Keep a valid bucket hostname for signing and route test traffic locally.
    const local = new URL(String(url));
    local.host = new URL(endpoint).host;
    return open.call(this, method, local.href, async, user, password);
  };
  try {
    window.eval(bundle.outputFiles[0].text);
    const create = (
      window as unknown as { createStorageClient: typeof createStorageClient }
    ).createStorageClient;
    for (const provider of ['obs', 'tos'] as const) {
      await t.test(provider, async () => {
        requests.length = 0;
        const client = await create({
          provider,
          endpoint: 'http://storage.example.test',
          bucket: 'fixture-bucket',
          region: provider === 'tos' ? 'cn-beijing' : 'cn-north-4',
          prefix: '',
          accessKeyId: 'fixture-access-key',
          accessKeySecret: 'fixture-secret',
          securityToken: 'fixture-session-token',
        });
        const first = await client.list({ prefix: 'samples/', delimiter: '/' });
        assert.deepEqual(
          Array.from(first.objects, ({ key, size }) => ({ key, size })),
          [{ key: 'samples/a b.txt', size: 12 }],
        );
        assert.equal(first.directories[0], 'samples/sub/');
        assert.equal(first.nextCursor, 'next +/=');
        await client.list({
          prefix: 'samples/',
          delimiter: '/',
          cursor: first.nextCursor,
        });
        const listing = requests
          .filter((request) => request.method === 'GET')
          .at(-1)!;
        assert.equal(
          listing.url.searchParams.get(
            provider === 'tos' ? 'continuation-token' : 'marker',
          ),
          'next +/=',
        );
        assert.equal(listing.url.searchParams.get('prefix'), 'samples/');
        assert.equal(listing.url.searchParams.get('delimiter'), '/');
        assert.ok(
          listing.headers.authorization?.includes('fixture-access-key'),
        );
        assert.equal(
          listing.headers[`x-${provider}-security-token`] ||
            listing.headers['x-amz-security-token'],
          'fixture-session-token',
        );

        const json = '{"taskParams":{"records":[]}}';
        await client.put!(
          'exports/task.json',
          new window.Blob([json], { type: 'application/json' }),
        );
        const upload = requests.at(-1)!;
        assert.equal(upload.method, 'PUT');
        assert.ok(
          decodeURIComponent(upload.url.pathname).endsWith(
            '/exports/task.json',
          ),
          upload.url.pathname,
        );
        assert.equal(upload.body, json);
        assert.equal(upload.headers['content-type'], 'application/json');
        assert.equal(
          upload.headers[`x-${provider}-forbid-overwrite`] ||
            upload.headers['x-amz-forbid-overwrite'],
          'true',
        );
        assert.ok(upload.headers.authorization?.includes('fixture-access-key'));

        const count = requests.length;
        const signed = new URL(await client.signedURL('samples/a b.txt'));
        assert.ok(signed.pathname.endsWith('/samples/a%20b.txt'));
        assert.ok(
          [...signed.searchParams.keys()].some((key) => /signature/i.test(key)),
        );
        assert.equal(
          requests.length,
          count,
          'Generating a signed URL must not make a network request',
        );
        await assert.rejects(
          client.list({ prefix: 'forbidden/' }),
          (error: any) => {
            assert.equal(
              Number(
                error.status || error.statusCode || error.response?.status,
              ),
              403,
            );
            return true;
          },
        );
      });
    }
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
