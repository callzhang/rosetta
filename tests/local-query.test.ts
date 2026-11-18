import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import type { DOMWindow } from 'jsdom';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import type { LocalQueryHarness } from './fixtures/local-query';
import { waitUntil } from './support/dom';

test('local queries ignore stale failures, hide data on task changes and unsubscribe on unmount', async () => {
  const bundle = await build({
    entryPoints: [
      fileURLToPath(new URL('./fixtures/local-query.tsx', import.meta.url)),
    ],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"test"' },
  });
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    runScripts: 'outside-only',
  });
  const window = dom.window as DOMWindow & {
    localQueryTest: LocalQueryHarness;
  };
  const until = (check: () => unknown) =>
    waitUntil(window.document, check, 'Query state did not settle');
  try {
    window.eval(bundle.outputFiles[0].text);
    const query = window.localQueryTest;
    query.render('first');
    await until(() => query.reads.length === 1);
    query.refresh();
    await until(() => query.reads.length === 2);
    query.reads[0].reject(new Error('obsolete failure'));
    await delay(30);
    assert.equal(query.state().loading, true);
    assert.equal(query.state().error, '');
    query.reads[1].resolve('latest data');
    await until(
      () => query.state().data === 'latest data' && !query.state().loading,
    );

    query.refresh();
    await until(() => query.reads.length === 3);
    query.refresh();
    await until(() => query.reads.length === 4);
    query.reads[3].resolve('newest data');
    await until(() => query.state().data === 'newest data');
    query.reads[2].reject(new Error('late failure'));
    await delay(30);
    assert.equal(query.state().error, '');
    assert.equal(query.state().loading, false);

    query.render('second');
    await until(() => query.reads.length === 5);
    assert.ok(
      query.renders
        .filter((state) => state.key === 'second')
        .every((state) => state.data === undefined),
    );
    query.reads[4].reject(new Error('current failure'));
    await until(() => query.state().error === 'current failure');
    query.refresh();
    await until(() => query.reads.length === 6);
    query.unmount();
    query.reads[5].resolve('unmounted');
    query.refresh();
    await delay(30);
    assert.equal(query.reads.length, 6);
    assert.equal(window.document.querySelector('output'), null);
  } finally {
    dom.window.close();
  }
});
