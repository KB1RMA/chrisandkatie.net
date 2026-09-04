import { expect, test, describe, vi, beforeEach } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { Modal, type ModalHandle } from './Modal';

// jsdom does not implement the native dialog methods the component calls.
// close() dispatches a real 'close' event, matching browser behavior, since
// Modal relies on that event (not a direct call) to invoke onClose.
beforeEach(() => {
  vi.clearAllMocks();

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

  test('should not block the native Escape/cancel default action', () => {
    // jsdom doesn't implement the browser's actual Escape-closes-<dialog>
    // behavior, so this can't simulate a keypress end-to-end. What we *can*
    // verify: Modal attaches no `onCancel` handler, so the browser's default
    // action for the dialog's 'cancel' event (calling close(), which then
    // fires 'close' -> onClose, exactly like the Cancel button) is never
    // preventDefault()'d. That default action is spec'd, native browser
    // behavior for dialog.showModal() - not something this component
    // implements - so leaving 'cancel' untouched is what keeps Escape working.
    render(
      <Modal onClose={vi.fn()} className="max-w-md">
        Content
      </Modal>,
    );

    const cancelEvent = new Event('cancel', { cancelable: true });
    screen.getByRole('dialog').dispatchEvent(cancelEvent);

    expect(cancelEvent.defaultPrevented).toBe(false);
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
