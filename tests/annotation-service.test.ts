import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDOMFixture } from './support/dom';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
test('a production frontend without an annotation URL shows a translated notice and opens no local iframe', async () => {
  const bundle = await build({
    absWorkingDir: root,
    stdin: {
      resolveDir: root,
      loader: 'tsx',
      contents: `
      import { createRoot } from 'react-dom/client';
      import { OperatorsEditor } from './src/annotationService';
      import { setLanguage } from './src/i18n';
      const root = createRoot(document.getElementById('root'));
      root.render(<OperatorsEditor input={{taskParams: {type: 'multiple', records: [], operators: []}}} />);
      globalThis.serviceTest = { setLanguage, unmount: () => root.unmount() };
    `,
    },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    jsx: 'automatic',
    define: {
      'process.env.NODE_ENV': '"test"',
      'import.meta.env.PROD': 'true',
      'import.meta.env.VITE_ANNOTATION_URL': 'undefined',
    },
  });
  const { dom, window, document, until, errors } = createDOMFixture(
    'https://pages.example/rosetta/',
  );
  try {
    window.eval(bundle.outputFiles[0].text);
    await until(
      () =>
        document.body.textContent.includes(
          'Annotation service is not connected',
        ),
      'An unconfigured production site should explain how to proceed',
    );
    assert.equal(document.querySelector('iframe'), null);
    await window.serviceTest.setLanguage('zh-CN');
    await until(
      () => document.body.textContent.includes('尚未连接标注服务'),
      'The notice should follow the selected language',
    );
    assert.equal(document.querySelector('iframe'), null);
    assert.deepEqual(errors, []);
  } finally {
    window.serviceTest?.unmount();
    dom.window.close();
  }
});
