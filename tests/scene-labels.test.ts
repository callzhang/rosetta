import { build } from 'esbuild';
import type { DOMWindow } from 'jsdom';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import type { SceneLabelsHarness } from './fixtures/scene-labels';
import { createDOMFixture } from './support/dom';

test('scene and instance names remain visible with an English default, update after language changes, and keep stable selection IDs', async () => {
  const bundle = await build({
    entryPoints: [
      fileURLToPath(new URL('./fixtures/scene-labels.tsx', import.meta.url)),
    ],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"test"' },
  });
  const {
    dom,
    window: browserWindow,
    document,
    until,
  } = createDOMFixture('https://scene.example');
  const window = browserWindow as DOMWindow & {
    sceneLabelsTest: SceneLabelsHarness;
  };
  const buttons = (selector: string) => [
    ...document.querySelectorAll<HTMLButtonElement>(selector),
  ];
  const categories = () => buttons('nav button');
  const instances = () => buttons('[aria-label="数据实例"] button');
  const named = (name: string) =>
    buttons('button').find((button) => button.textContent === name);
  const assertVisibleLabels = () => {
    assert.ok(categories().length > 10);
    assert.ok(instances().length > 60);
    for (const button of [...categories(), ...instances()])
      assert.ok(
        button.textContent?.trim(),
        'No category or instance should have an empty label',
      );
  };
  try {
    window.eval(bundle.outputFiles[0].text);
    await until(
      () => categories().length > 0,
      'Uninitialized scene labels should render immediately',
    );
    assertVisibleLabels();
    const categoryId = named('Auto labeling')!.dataset.id;
    const instanceId = named('Multilingual ASR')!.dataset.id;
    assert.equal(named('Large language models'), undefined);
    assert.equal(named('Medical multi-turn dialogue annotation'), undefined);
    assert.equal(document.documentElement.lang, 'en-US');

    await window.sceneLabelsTest.initialize();
    await until(
      () => named('Auto labeling') && named('Multilingual ASR'),
      'Initialization must refresh labels that were already mounted',
    );
    assertVisibleLabels();
    assert.equal(named('Auto labeling')!.dataset.id, categoryId);
    assert.equal(named('Multilingual ASR')!.dataset.id, instanceId);
    assert.ok(
      named('Autonomous driving'),
      'An empty translation must fall back to its English source name',
    );
    assert.equal(named('大模型'), undefined);

    await window.sceneLabelsTest.changeLanguage('zh-CN');
    await until(
      () => named('自动标注') && named('医疗多轮对话标注') && named('大模型'),
      'Chinese examples must be selected after initialization instead of during module import',
    );
    assertVisibleLabels();
    assert.equal(named('自动标注')!.dataset.id, categoryId);
    assert.equal(named('多语种ASR')!.dataset.id, instanceId);
    window.sceneLabelsTest.unmount();
    const renders = window.sceneLabelsTest.renderCount();
    await window.sceneLabelsTest.changeLanguage('en-US');
    await delay(20);
    assert.equal(window.sceneLabelsTest.renderCount(), renders);
  } finally {
    dom.window.close();
  }
});
