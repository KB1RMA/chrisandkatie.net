'use client';

/**
 * CreateEventButton component with integrated create modal.
 *
 * Client component that renders a button which opens the EventCreateModal
 * when clicked.
 */
import { useState } from 'react';
import EventCreateModal from './EventCreateModal';

/**
 * Button that opens the EventCreateModal dialog when clicked.
 *
 * @returns Button element with modal dialog.
 */
export function CreateEventButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-md bg-[#9e3f3f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b76565]"
      >
        Create Event
      </button>

      {isOpen && <EventCreateModal onClose={() => setIsOpen(false)} />}
    </>
  );
}
