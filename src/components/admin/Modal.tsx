'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type DialogHTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

export type ModalHandle = {
  /** Closes the dialog, firing its `onClose` callback. */
  close: () => void;
};

type ModalProps = Omit<
  DialogHTMLAttributes<HTMLDialogElement>,
  'open' | 'ref' | 'onCancel'
> & {
  /**
   * Called whenever the dialog closes - Escape, or an imperative `close()`
   * through the forwarded ref. Consumers should call `close()` (not this
   * prop) to close the dialog; the native `close` event is what invokes it,
   * so it fires exactly once no matter which path triggered the close.
   */
  onClose: () => void;
  /**
   * Blocks Escape (and any other trigger of the dialog's native `cancel`
   * event) from closing the dialog while true - e.g. while an action
   * started from inside the dialog is still in flight, so the dialog can't
   * close (and the caller unmount) out from under a pending request. Save/
   * Cancel/Delete buttons should be disabled for the same condition.
   */
  preventClose?: boolean;
  /** Full class list for the dialog panel (size, background, padding, etc). */
  className: string;
  children: ReactNode;
};

/**
 * Reusable wrapper around the native `<dialog>` element for admin modals.
 *
 * Opens itself on mount via `showModal()` and stays centered in the
 * viewport - the browser's default `dialog:modal` centering (`margin: auto`)
 * is otherwise defeated by Tailwind's preflight `margin: 0` reset, which
 * left every dialog built on the old copy-pasted pattern pinned to the
 * top-left of the screen instead of centered.
 *
 * @param props - See {@link ModalProps}.
 * @param ref - Forwarded handle exposing `close()`, so a Save or Cancel
 *   handler can dismiss the dialog; the resulting native `close` event is
 *   what calls `onClose`. IMPORTANT: consumers must call `close()` via this
 *   ref to close the dialog - never call the `onClose` prop directly. Calling
 *   `onClose` directly leaves the native `<dialog>` open (`showModal()` ran,
 *   `close()` never did) while the caller unmounts believing it's dismissed;
 *   `close()` is what actually closes the dialog, and `onClose` firing is
 *   just its side effect.
 * @returns A centered native dialog element.
 */
export const Modal = forwardRef<ModalHandle, ModalProps>(function Modal(
  { onClose, preventClose = false, className, children, ...rest },
  ref,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      close: () => dialogRef.current?.close(),
    }),
    [],
  );

  return (
    <dialog
      {...rest}
      ref={dialogRef}
      onClose={onClose}
      onCancel={(event) => {
        if (preventClose) {
          event.preventDefault();
        }
      }}
      className={cn('m-auto', className)}
    >
      {children}
    </dialog>
  );
});
