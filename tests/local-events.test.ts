import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  notifyLocalChange,
  subscribeLocalChanges,
} from '../src/localData/events';

test('local subscriptions still update when BroadcastChannel is unavailable or blocked', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const original = Object.getOwnPropertyDescriptor(
    globalThis,
    'BroadcastChannel',
  );
  const window = new EventTarget();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: window,
  });
  Object.defineProperty(globalThis, 'BroadcastChannel', {
    configurable: true,
    value: class {
      constructor() {
        throw new DOMException('Blocked', 'SecurityError');
      }
    },
  });
  try {
    let calls = 0;
    const unsubscribe = subscribeLocalChanges('tasks', () => {
      calls++;
    });
    assert.doesNotThrow(() => notifyLocalChange('tasks'));
    assert.equal(calls, 1);
    window.dispatchEvent(new Event('focus'));
    assert.equal(calls, 2);
    unsubscribe();
    notifyLocalChange('tasks');
    assert.equal(calls, 2);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
    if (original)
      Object.defineProperty(globalThis, 'BroadcastChannel', original);
    else Reflect.deleteProperty(globalThis, 'BroadcastChannel');
  }
});
