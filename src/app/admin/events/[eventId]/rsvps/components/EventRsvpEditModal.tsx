'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setPartyEventRsvp } from '../actions';
import { Modal, type ModalHandle } from '@/components/admin/Modal';

/** One person on the party being edited, with their pre-selected status. */
export type EventRsvpPartyMember = {
  id: string;
  guestName: string;
  defaultAttending: boolean;
};

type EventRsvpEditModalProps = {
  eventId: string;
  /** The guest whose row was clicked; highlighted in the member list. */
  guestId: string;
  partyName: string;
  members: EventRsvpPartyMember[];
  hasPartyResponse: boolean;
  /** The party's response timestamp as rendered, echoed back to detect a concurrent edit. */
  expectedUpdatedAt: string | null;
  onClose: () => void;
};

const OPTIONS = [
  { attending: true, label: 'Attending' },
  { attending: false, label: 'Not Attending' },
];

/**
 * Admin dialog for setting attendance across a whole party at one event.
 *
 * RSVPs are stored per party, so recording a status for one person rewrites the
 * party's response. The dialog therefore shows every member invited to the
 * event and submits a status for each, keeping any knock-on change visible and
 * deliberate rather than silently declining the people who were not edited.
 *
 * @param props - Event and party identifiers, the member list, and a close callback.
 * @returns A native dialog for editing the party's RSVP.
 */
export function EventRsvpEditModal({
  eventId,
  guestId,
  partyName,
  members,
  hasPartyResponse,
  expectedUpdatedAt,
  onClose,
}: EventRsvpEditModalProps) {
  const modalRef = useRef<ModalHandle>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [attendingById, setAttendingById] = useState<Record<string, boolean>>(
    () =>
      members.reduce<Record<string, boolean>>(
        (acc, member) => ({ ...acc, [member.id]: member.defaultAttending }),
        {},
      ),
  );

  /**
   * Closes the dialog; the resulting native close event notifies the parent.
   */
  function handleClose() {
    modalRef.current?.close();
  }

  /**
   * Saves the party's statuses, keeping the dialog open when the action fails.
   */
  function handleSave() {
    setError(null);

    startTransition(async () => {
      const result = await setPartyEventRsvp({
        eventId,
        guestId,
        expectedUpdatedAt,
        statuses: members.map((member) => ({
          guestId: member.id,
          attending: attendingById[member.id] ?? false,
        })),
      });

      if (!result.success) {
        setError(result.error);

        return;
      }

      router.refresh();
      handleClose();
    });
  }

  return (
    <Modal
      ref={modalRef}
      onClose={onClose}
      preventClose={isPending}
      className="w-full max-w-md rounded-lg bg-[#fffdfb] p-6 shadow-xl backdrop:bg-black/50"
    >
      <h2 className="text-lg font-semibold text-[#9e3f3f]">Edit RSVP</h2>
      <p className="mt-1 text-sm text-[#7a6666]">{partyName}</p>

      {!hasPartyResponse && (
        <p className="mt-4 rounded-md bg-[#f3dedb] p-3 text-sm text-[#6a5555]">
          This party has not responded through the event RSVP form. Saving
          records a response for everyone listed below.
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {members.map((member) => (
          <li
            key={member.id}
            className={`rounded-md p-3 ${
              member.id === guestId ? 'bg-[#f3dedb]/60' : 'bg-white/70'
            }`}
          >
            <p className="text-sm font-medium text-[#6a5555]">
              {member.guestName}
            </p>

            <div className="mt-2 flex gap-4">
              {OPTIONS.map((option) => (
                <label
                  key={option.label}
                  className="flex items-center gap-2 text-sm text-[#7a6666]"
                >
                  <input
                    type="radio"
                    name={`attendance-${member.id}`}
                    aria-label={`${member.guestName} ${option.label.toLowerCase()}`}
                    checked={
                      (attendingById[member.id] ?? false) === option.attending
                    }
                    onChange={() =>
                      setAttendingById((prev) => ({
                        ...prev,
                        [member.id]: option.attending,
                      }))
                    }
                    className="accent-[#9e3f3f]"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {error !== null && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md bg-[#9e3f3f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7a3030] disabled:opacity-50"
        >
          {isPending ? 'Saving...' : 'Save'}
        </button>

        <button
          type="button"
          onClick={handleClose}
          disabled={isPending}
          className="rounded-md border border-[#e5d5d5] bg-white px-4 py-2 text-sm font-medium text-[#6a5555] hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}
