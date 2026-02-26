'use client';

import { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteEvent } from '../actions';

type EventDeleteDialogProps = {
  event: { id: string; name: string };
  rsvpCount: number;
  onClose: () => void;
};

/**
 * Dialog component for confirming deletion of a wedding event.
 *
 * @param props - Component props.
 * @param props.event - The event to delete, containing its id and name.
 * @param props.rsvpCount - The number of RSVP responses associated with the event.
 * @param props.onClose - Callback invoked when the dialog should be closed.
 * @returns A native dialog element prompting the user to confirm event deletion.
 */
export default function EventDeleteDialog({
  event,
  rsvpCount,
  onClose,
}: EventDeleteDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  async function handleConfirm() {
    setIsSubmitting(true);
    setError(null);

    try {
      await deleteEvent({ id: event.id });
      router.refresh();
      onClose();
    } catch {
      setError('Failed to delete the event. Please try again.');
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    dialogRef.current?.close();
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl backdrop:bg-black/50"
    >
      <h2 className="mb-2 text-lg font-semibold text-gray-900">Delete Event</h2>

      <p className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        This will permanently delete <strong>{event.name}</strong> and{' '}
        {rsvpCount} RSVP response(s). This cannot be undone.
      </p>

      {error !== null && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex gap-3">
        <button
          onClick={handleConfirm}
          disabled={isSubmitting}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Deleting...' : 'Delete'}
        </button>

        <button
          onClick={handleCancel}
          disabled={isSubmitting}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </dialog>
  );
}
