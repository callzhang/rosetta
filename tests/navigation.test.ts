import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

test('annotation tabs preserve session hashes and preview URLs under root and GitHub Pages prefixes', async () => {
  for (const base of ['/', '/rosetta/']) {
    const bundle = await build({
      entryPoints: [
        fileURLToPath(new URL('../src/navigation.ts', import.meta.url)),
      ],
      bundle: true,
      write: false,
      platform: 'browser',
      format: 'iife',
      globalName: 'navigation',
      define: { 'import.meta.env.BASE_URL': JSON.stringify(base) },
    });
    const context = {
      navigation: undefined as
        | { getPathWithBase: (path: string) => string }
        | undefined,
    };
    runInNewContext(bundle.outputFiles[0].text, context);
    assert.equal(
      context.navigation!.getPathWithBase('/annotate?index=2#session/task-id'),
      `${base}annotate?index=2#session/task-id`,
    );
    assert.equal(
      context.navigation!.getPathWithBase('/annotate#preview/preview-id'),
      `${base}annotate#preview/preview-id`,
    );
  }
});
