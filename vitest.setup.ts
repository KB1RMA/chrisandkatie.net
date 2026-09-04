import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

/**
 * Cleanup after each test to ensure no memory leaks
 * and no test pollution between test runs.
 */
afterEach(() => {
  cleanup();
});

/**
 * jsdom does not implement the native `<dialog>` element's `showModal()`/
 * `close()` methods that components built on `Modal`
 * (src/components/admin/Modal.tsx) call. Stub them here once so every test
 * file gets the same behavior instead of hand-rolling its own copy.
 *
 * `close()` dispatches a real `close` event, matching browser behavior,
 * since `Modal` relies on that event (not a direct call) to invoke
 * `onClose`.
 *
 * Guarded because some test files opt into `@vitest-environment node`
 * (e.g. logger/action tests), where `HTMLDialogElement` isn't a global at
 * all - referencing it unconditionally would throw in every test there.
 */
beforeEach(() => {
  if (typeof HTMLDialogElement === 'undefined') {
    return;
  }

  HTMLDialogElement.prototype.showModal = vi.fn(function showModal(
    this: HTMLDialogElement,
  ) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function close(
    this: HTMLDialogElement,
  ) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  });
});
