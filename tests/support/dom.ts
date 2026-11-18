import { fireEvent, waitFor } from '@testing-library/dom';
import { JSDOM, VirtualConsole } from 'jsdom';
import type { DOMWindow } from 'jsdom';
import assert from 'node:assert/strict';

export function installDOMStubs(window: DOMWindow) {
  window.structuredClone = structuredClone;
  window.matchMedia = (media: string): MediaQueryList => ({
    media,
    matches: false,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
  });
  window.ResizeObserver = class implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

export function createDOMFixture(url: string) {
  const errors: string[] = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', (...values: unknown[]) => {
    errors.push(values.map(String).join(' '));
  });
  virtualConsole.on('jsdomError', (error: Error) => {
    if (
      !/Could not parse CSS stylesheet|Not implemented: window.getComputedStyle/.test(
        error.message,
      )
    )
      errors.push(error.message);
  });
  const dom = new JSDOM(
    '<!doctype html><html><body><div id="root"></div></body></html>',
    {
      url,
      runScripts: 'outside-only',
      pretendToBeVisual: true,
      virtualConsole,
    },
  );
  const { window } = dom;
  const { document } = window;
  installDOMStubs(window);
  return {
    dom,
    window,
    document,
    errors,
    until: (check: () => unknown, message: string) =>
      waitUntil(document, check, message),
  };
}

export function waitUntil(
  document: Document,
  check: () => unknown,
  message: string,
  timeout = 3000,
) {
  return waitFor(() => assert.ok(check(), message), {
    container: document.documentElement,
    timeout,
    interval: 25,
  });
}

export function fillInput(input: HTMLInputElement, value: string) {
  fireEvent.input(input, { target: { value } });
}

export function findButton(container: ParentNode, label: string) {
  return [...container.querySelectorAll('button')].find(
    (node) => node.textContent.replace(/\s/g, '') === label,
  );
}
