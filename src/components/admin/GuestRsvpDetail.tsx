'use client';

import { useState, useTransition } from 'react';
import type { WeddingEvent, RsvpResponse, Attendee } from '@/lib/db/schema';
import {
  updateRsvpAttendance,
  cascadeRsvpNotAttending,
  updateAttendeeDetails,
} from '@/app/admin/guests/actions';

type AttendeeInput = {
  name: string;
  mealOption: 'option_a' | 'option_b' | null;
  dietaryRestrictions?: string;
};

type RsvpResponseWithDetails = RsvpResponse & {
  event: WeddingEvent;
  attendees: Attendee[];
};

type Props = {
  guestId: string;
  guestEvents: { event: WeddingEvent }[];
  rsvpResponses: RsvpResponseWithDetails[];
};

const MEAL_LABELS: Record<string, string> = {
  option_a: 'Option A',
  option_b: 'Option B',
};

const ATTENDANCE_LABELS: Record<string, string> = {
  attending: 'Attending',
  not_attending: 'Not Attending',
};

/**
 * Admin inline RSVP editor for a specific guest.
 *
 * Renders per-event RSVP status with inline edit controls.
 * When the wedding RSVP changes to not_attending and per-event RSVPs exist,
 * shows a confirmation modal asking whether to cascade the change.
 *
 * @param props - guestId, guestEvents, and rsvpResponses with attendee details.
 * @returns Client component for editing a guest's RSVPs inline.
 */
export function GuestRsvpDetail({
  guestId,
  guestEvents,
  rsvpResponses,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Cascade modal state
  const [showCascadeModal, setShowCascadeModal] = useState(false);
  const [pendingNotAttendingEventId, setPendingNotAttendingEventId] = useState<
    string | null
  >(null);

  // Attendee editing state: eventId → array of attendee inputs
  const [editingAttendees, setEditingAttendees] = useState<
    Record<string, AttendeeInput[] | null>
  >({});

  const rsvpByEvent = new Map<string, RsvpResponseWithDetails>(
    rsvpResponses.map((rsvp) => [rsvp.eventId, rsvp]),
  );

  const mainEvent = guestEvents.find(
    ({ event }) => event.type === 'main',
  )?.event;
  const perEventRsvps = rsvpResponses.filter(
    (rsvp) => rsvp.eventId !== mainEvent?.id,
  );

  /**
   * Clears feedback messages after a short delay.
   */
  function clearMessages() {
    setTimeout(() => {
      setError(null);
      setSuccessMessage(null);
    }, 4000);
  }

  /**
   * Handles changing attendance status for an event.
   * When setting the main event to not_attending and per-event RSVPs exist,
   * shows the cascade confirmation modal instead of saving immediately.
   *
   * @param eventId - The ID of the event to update.
   * @param attendanceStatus - The new attendance status.
   */
  function handleAttendanceChange(
    eventId: string,
    attendanceStatus: 'attending' | 'not_attending',
  ) {
    const isMainEvent = eventId === mainEvent?.id;
    const hasPerEventRsvps = perEventRsvps.length > 0;

    if (
      isMainEvent &&
      attendanceStatus === 'not_attending' &&
      hasPerEventRsvps
    ) {
      setPendingNotAttendingEventId(eventId);
      setShowCascadeModal(true);

      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await updateRsvpAttendance({
        guestId,
        eventId,
        attendanceStatus,
      });

      if (!result.success) {
        setError(result.error);
      } else {
        setSuccessMessage('RSVP updated.');
        clearMessages();
      }
    });
  }

  /**
   * Handles cascade modal confirmation — updates main event and all per-event RSVPs.
   *
   * @param cascadeToEvents - Whether to cascade the not_attending status to all events.
   */
  function handleCascadeConfirm(cascadeToEvents: boolean) {
    setShowCascadeModal(false);

    startTransition(async () => {
      setError(null);

      const result = await cascadeRsvpNotAttending({
        guestId,
        cascadeToEvents,
      });

      if (!result.success) {
        setError(result.error);
      } else {
        setSuccessMessage(
          cascadeToEvents
            ? 'Marked as not attending for all events.'
            : 'Main event RSVP updated.',
        );
        clearMessages();
      }

      setPendingNotAttendingEventId(null);
    });
  }

  /**
   * Saves edited attendee details for a given RSVP response.
   *
   * @param rsvpResponseId - The ID of the rsvpResponse to update attendees for.
   * @param eventId - The event ID used to clear editing state.
   */
  function handleSaveAttendees(rsvpResponseId: string, eventId: string) {
    const updatedAttendees = editingAttendees[eventId];

    if (!updatedAttendees) {
      return;
    }

    startTransition(async () => {
      setError(null);

      const result = await updateAttendeeDetails({
        rsvpResponseId,
        attendees: updatedAttendees,
      });

      if (!result.success) {
        setError(result.error);
      } else {
        setSuccessMessage('Attendee details saved.');
        setEditingAttendees((prev) => {
          const next = { ...prev };
          delete next[eventId];

          return next;
        });
        clearMessages();
      }
    });
  }

  /**
   * Initialises attendee editing state for an event.
   *
   * @param eventId - The event to start editing attendees for.
   * @param currentAttendees - Current attendees to pre-populate the form.
   */
  function startEditingAttendees(
    eventId: string,
    currentAttendees: Attendee[],
  ) {
    setEditingAttendees((prev) => ({
      ...prev,
      [eventId]: currentAttendees.map(
        ({ name, mealOption, dietaryRestrictions }) => ({
          name,
          mealOption,
          dietaryRestrictions: dietaryRestrictions ?? '',
        }),
      ),
    }));
  }

  /**
   * Cancels editing attendees for an event without saving.
   *
   * @param eventId - The event to cancel editing for.
   */
  function cancelEditingAttendees(eventId: string) {
    setEditingAttendees((prev) => {
      const next = { ...prev };
      delete next[eventId];

      return next;
    });
  }

  /**
   * Updates a single attendee field within the editing state.
   *
   * @param eventId - The event the attendee belongs to.
   * @param index - The attendee index in the list.
   * @param field - The field to update.
   * @param value - The new value.
   */
  function updateAttendeeField(
    eventId: string,
    index: number,
    field: keyof AttendeeInput,
    value: string,
  ) {
    setEditingAttendees((prev) => {
      const list = prev[eventId];

      if (!list) {
        return prev;
      }

      return {
        ...prev,
        [eventId]: list.map((attendee, i) =>
          i === index ? { ...attendee, [field]: value } : attendee,
        ),
      };
    });
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Feedback messages */}
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      {/* Per-event RSVP edit cards */}
      {guestEvents.map(({ event }) => {
        const rsvp = rsvpByEvent.get(event.id);
        const isEditingAttendees = editingAttendees[event.id] !== undefined;
        const currentAttendees = editingAttendees[event.id] ?? [];

        const borderColor =
          rsvp?.attendanceStatus === 'attending'
            ? 'border-green-500 bg-green-50'
            : rsvp?.attendanceStatus === 'not_attending'
              ? 'border-red-400 bg-red-50'
              : 'border-yellow-400 bg-yellow-50';

        return (
          <div
            key={event.id}
            className={`rounded-lg border-l-4 p-5 shadow ${borderColor}`}
          >
            <div className="mb-3 flex items-start justify-between">
              <h2 className="text-lg font-semibold text-[#9e3f3f]">
                {event.name}
              </h2>
              <span className="text-sm text-[#7a6666]">
                {rsvp
                  ? (ATTENDANCE_LABELS[rsvp.attendanceStatus] ??
                    rsvp.attendanceStatus)
                  : 'No Response'}
              </span>
            </div>

            {/* Attendance status selector */}
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-[#7a6666]">
                Attendance
              </label>
              <div className="flex gap-2">
                {(['attending', 'not_attending'] as const).map((status) => (
                  <button
                    key={status}
                    disabled={isPending}
                    onClick={() => handleAttendanceChange(event.id, status)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      rsvp?.attendanceStatus === status
                        ? status === 'attending'
                          ? 'bg-green-600 text-white'
                          : 'bg-red-500 text-white'
                        : 'bg-white/70 text-[#6a5555] hover:bg-white'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {ATTENDANCE_LABELS[status]}
                  </button>
                ))}
              </div>
            </div>

            {/* Attendee details — only shown when there is an RSVP */}
            {rsvp && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-[#7a6666]">
                    Attendees
                  </p>

                  {!isEditingAttendees && (
                    <button
                      disabled={isPending}
                      onClick={() =>
                        startEditingAttendees(event.id, rsvp.attendees)
                      }
                      className="text-xs text-[#9e3f3f] underline hover:text-[#7a3030] disabled:opacity-50"
                    >
                      Edit attendees
                    </button>
                  )}
                </div>

                {!isEditingAttendees && (
                  <div className="space-y-1.5">
                    {rsvp.attendees.length === 0 && (
                      <p className="text-sm text-[#9a8888]">
                        No attendees listed.
                      </p>
                    )}
                    {rsvp.attendees.map((attendee) => (
                      <div
                        key={attendee.id}
                        className="rounded bg-white/60 px-3 py-2 text-sm text-[#6a5555]"
                      >
                        <span className="font-medium">{attendee.name}</span>
                        {' — '}
                        {attendee.mealOption
                          ? (MEAL_LABELS[attendee.mealOption] ??
                            attendee.mealOption)
                          : null}
                        {attendee.dietaryRestrictions && (
                          <span className="ml-2 text-[#9a8888]">
                            ({attendee.dietaryRestrictions})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {isEditingAttendees && (
                  <div className="space-y-3">
                    {currentAttendees.map((attendee, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-1 gap-2 rounded bg-white/80 p-3 sm:grid-cols-3"
                      >
                        <input
                          type="text"
                          placeholder="Name"
                          value={attendee.name}
                          onChange={(e) =>
                            updateAttendeeField(
                              event.id,
                              index,
                              'name',
                              e.target.value,
                            )
                          }
                          className="rounded border border-[#e5d5d5] px-2 py-1 text-sm text-[#6a5555] focus:ring-1 focus:ring-[#9e3f3f] focus:outline-none"
                        />
                        <select
                          value={attendee.mealOption ?? ''}
                          onChange={(e) =>
                            updateAttendeeField(
                              event.id,
                              index,
                              'mealOption',
                              e.target.value,
                            )
                          }
                          className="rounded border border-[#e5d5d5] px-2 py-1 text-sm text-[#6a5555] focus:ring-1 focus:ring-[#9e3f3f] focus:outline-none"
                        >
                          <option value="option_a">Option A</option>
                          <option value="option_b">Option B</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Dietary restrictions (optional)"
                          value={attendee.dietaryRestrictions ?? ''}
                          onChange={(e) =>
                            updateAttendeeField(
                              event.id,
                              index,
                              'dietaryRestrictions',
                              e.target.value,
                            )
                          }
                          className="rounded border border-[#e5d5d5] px-2 py-1 text-sm text-[#6a5555] focus:ring-1 focus:ring-[#9e3f3f] focus:outline-none"
                        />
                      </div>
                    ))}

                    <div className="flex gap-2">
                      <button
                        disabled={isPending}
                        onClick={() => handleSaveAttendees(rsvp.id, event.id)}
                        className="rounded-md bg-[#9e3f3f] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#7a3030] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        disabled={isPending}
                        onClick={() => cancelEditingAttendees(event.id)}
                        className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-[#6a5555] hover:bg-gray-100 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {guestEvents.length === 0 && (
        <p className="rounded-lg bg-[#fffdfb] p-6 text-center text-[#7a6666] shadow">
          This guest is not invited to any events.
        </p>
      )}

      {/* Cascade confirmation modal */}
      {showCascadeModal && pendingNotAttendingEventId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-[#fffdfb] p-6 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold text-[#9e3f3f]">
              Update per-event RSVPs?
            </h3>
            <p className="mb-5 text-sm text-[#6a5555]">
              This guest has RSVPs for additional events. Would you like to mark
              them as <strong>not attending</strong> all events as well?
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                disabled={isPending}
                onClick={() => handleCascadeConfirm(true)}
                className="flex-1 rounded-md bg-[#9e3f3f] px-4 py-2 text-sm font-medium text-white hover:bg-[#7a3030] disabled:opacity-50"
              >
                Yes, update all events
              </button>
              <button
                disabled={isPending}
                onClick={() => handleCascadeConfirm(false)}
                className="flex-1 rounded-md bg-white px-4 py-2 text-sm font-medium text-[#6a5555] ring-1 ring-[#e5d5d5] hover:bg-gray-50 disabled:opacity-50"
              >
                No, main event only
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
