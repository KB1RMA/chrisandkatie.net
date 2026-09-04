import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * Cleanup after each test to ensure no memory leaks
 * and no test pollution between test runs.
 */
afterEach(() => {
  cleanup();
});

/**
 * jsdom does not implement the <dialog> element's imperative API. Polyfill
 * showModal/close so components using native <dialog> modals are testable
 * without mocking the dialog element itself. Guarded because some test
 * files opt into the "node" environment, where no DOM globals exist.
 */
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(
      this: HTMLDialogElement,
    ) {
      this.setAttribute('open', '');
    };
  }

  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(
      this: HTMLDialogElement,
    ) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }
}
