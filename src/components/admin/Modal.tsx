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
  'open' | 'ref'
> & {
  /**
   * Called whenever the dialog closes - Escape, a backdrop click via a
   * `<form method="dialog">` submit button, or an imperative `close()`
   * through the forwarded ref. Consumers should call `close()` rather than
   * this prop directly; the native `close` event is what invokes it.
   */
  onClose: () => void;
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
 *   what calls `onClose`, so callers should not call `onClose` themselves.
 * @returns A centered native dialog element.
 */
export const Modal = forwardRef<ModalHandle, ModalProps>(function Modal(
  { onClose, className, children, ...rest },
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
      className={cn('m-auto', className)}
    >
      {children}
    </dialog>
  );
});
