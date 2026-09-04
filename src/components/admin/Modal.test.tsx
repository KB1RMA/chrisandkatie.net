import { expect, test, describe, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { Modal, type ModalHandle } from './Modal';

// The HTMLDialogElement showModal()/close() polyfill jsdom lacks is
// registered once, globally, in vitest.setup.ts.

describe('Modal', () => {
  test('should open itself via showModal on mount', () => {
    render(
      <Modal onClose={vi.fn()} className="max-w-md">
        Content
      </Modal>,
    );

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1);
  });

  test('should stay centered by overriding preflight margin reset', () => {
    render(
      <Modal onClose={vi.fn()} className="max-w-md">
        Content
      </Modal>,
    );

    expect(screen.getByRole('dialog')).toHaveClass('m-auto');
  });

  test('should merge the caller-provided panel classes', () => {
    render(
      <Modal onClose={vi.fn()} className="max-w-md bg-white">
        Content
      </Modal>,
    );

    expect(screen.getByRole('dialog')).toHaveClass('max-w-md', 'bg-white');
  });

  test('should call onClose when the dialog closes natively (e.g. Escape)', () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose} className="max-w-md">
        Content
      </Modal>,
    );

    screen.getByRole('dialog').dispatchEvent(new Event('close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('should close (and notify onClose) when the forwarded ref is used', () => {
    const onClose = vi.fn();
    const ref = createRef<ModalHandle>();

    render(
      <Modal ref={ref} onClose={onClose} className="max-w-md">
        Content
      </Modal>,
    );

    ref.current?.close();

    expect(HTMLDialogElement.prototype.close).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('should not block the native Escape/cancel default action by default', () => {
    // jsdom doesn't implement the browser's actual Escape-closes-<dialog>
    // behavior, so this can't simulate a keypress end-to-end. What we *can*
    // verify: without `preventClose`, Modal's `cancel` handler never calls
    // preventDefault(), so the browser's default action (calling close(),
    // which then fires 'close' -> onClose, exactly like the Cancel button)
    // proceeds. That default action is spec'd, native browser behavior for
    // dialog.showModal() - not something this component implements - so
    // leaving 'cancel' unblocked is what keeps Escape working.
    render(
      <Modal onClose={vi.fn()} className="max-w-md">
        Content
      </Modal>,
    );

    const cancelEvent = new Event('cancel', { cancelable: true });
    screen.getByRole('dialog').dispatchEvent(cancelEvent);

    expect(cancelEvent.defaultPrevented).toBe(false);
  });

  test('should block the native Escape/cancel default action when preventClose is set', () => {
    // preventClose lets a caller keep the dialog open through Escape while
    // an action started from inside it (e.g. a pending delete/save request)
    // is still in flight, so the dialog can't close - and the caller
    // unmount - out from under that request.
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose} preventClose className="max-w-md">
        Content
      </Modal>,
    );

    const cancelEvent = new Event('cancel', { cancelable: true });
    screen.getByRole('dialog').dispatchEvent(cancelEvent);

    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  test('should pass through extra dialog attributes such as aria-labelledby', () => {
    render(
      <Modal
        onClose={vi.fn()}
        className="max-w-md"
        aria-labelledby="modal-title"
      >
        <h2 id="modal-title">Title</h2>
      </Modal>,
    );

    expect(screen.getByRole('dialog')).toHaveAttribute(
      'aria-labelledby',
      'modal-title',
    );
  });
});
