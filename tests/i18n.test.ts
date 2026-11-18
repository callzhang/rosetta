import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createDOMFixture, fillInput } from './support/dom';
import type { I18nHarness } from './fixtures/i18n';

test('English is the first-run default; switching languages preserves edits, updates static labels, persists, and follows other tabs', async () => {
  const bundle = await build({
    entryPoints: [
      fileURLToPath(new URL('./fixtures/i18n.tsx', import.meta.url)),
    ],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"test"' },
  });
  for (const initial of [null, 'zh-CN']) {
    const { dom, window, document, until, errors } = createDOMFixture(
      'https://i18n.example',
    );
    const browser = window as typeof window & { i18nTest: I18nHarness };
    if (initial) window.localStorage.setItem('rosetta.language', initial);
    try {
      window.eval(bundle.outputFiles[0].text);
      await until(
        () => document.querySelector('input'),
        'The translated form should render',
      );
      assert.equal(document.documentElement.lang, initial || 'en-US');
      assert.equal(
        document.querySelector('h1')!.textContent,
        initial ? '任务管理' : 'Task management',
      );
      if (initial) document.querySelector('button')!.click();
      await until(
        () => document.querySelector('h1')?.textContent === 'Task management',
        'English should render',
      );
      const input = document.querySelector('input')!;
      fillInput(input, '用户自定义 task');
      document.querySelector('button')!.click();
      await until(
        () => document.querySelector('h1')?.textContent === '任务管理',
        'Chinese should render without remounting the form',
      );
      assert.equal(document.querySelector('input'), input);
      assert.equal(input.value, '用户自定义 task');
      assert.equal(document.querySelector('p')!.textContent, '图片 / 已完成');
      assert.equal(
        document.querySelector('output')!.textContent,
        '已创建 3 个任务',
      );
      assert.equal(document.title, '独立标注工具');
      assert.equal(
        window.localStorage.getItem(browser.i18nTest.LANGUAGE_KEY),
        'zh-CN',
      );
      window.dispatchEvent(
        new window.StorageEvent('storage', {
          key: 'rosetta.language',
          newValue: 'en-US',
        }),
      );
      await until(
        () => document.querySelector('h1')?.textContent === 'Task management',
        'Language changes in another tab should be applied',
      );
      assert.equal(
        document.querySelector('p')!.textContent,
        'Image / Completed',
      );
      assert.equal(
        document.querySelector('output')!.textContent,
        'Created 3 tasks',
      );
      assert.equal(input.value, '用户自定义 task');
      assert.equal(document.documentElement.lang, 'en-US');
      assert.deepEqual(errors, []);
    } finally {
      browser.i18nTest?.unmount();
      dom.window.close();
    }
  }
});
