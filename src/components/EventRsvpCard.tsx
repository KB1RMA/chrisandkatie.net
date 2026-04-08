/**
 * EventRsvpCard component for displaying a single additional event's RSVP status.
 *
 * Shows event details, current RSVP status badge, and a link to the RSVP form.
 * Renders as locked (no link) once the RSVP deadline has passed.
 */
import Link from 'next/link';
import type { Route } from 'next';
import { isDeadlinePassed } from '@/lib/rsvp';
import type { WeddingEvent, RsvpResponse } from '@/lib/db/schema';

type EventRsvpCardProps = {
  event: WeddingEvent;
  rsvp: RsvpResponse | null;
};

/**
 * Format an ISO date string for display (e.g. "September 10, 2026").
 *
 * @param dateStr - ISO 8601 date string (e.g. "2026-09-10").
 * @returns Formatted date string for display.
 */
function formatEventDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a 24-hour time string for display (e.g. "6:00 PM").
 *
 * @param timeStr - Time string in HH:MM format.
 * @returns Formatted 12-hour time string.
 */
function formatEventTime(timeStr: string): string {
  const [hoursStr, minutesStr] = timeStr.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = minutesStr ?? '00';
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${minutes} ${period}`;
}

/**
 * Status badge for the guest's current RSVP state.
 *
 * @param param0 - The attendance status or null.
 * @returns Colored badge indicating RSVP status.
 */
function RsvpStatusBadge({
  attendanceStatus,
}: {
  attendanceStatus: 'attending' | 'not_attending' | null;
}) {
  if (attendanceStatus === 'attending') {
    return (
      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        Attending
      </span>
    );
  }

  if (attendanceStatus === 'not_attending') {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        Not Attending
      </span>
    );
  }

  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
      Not Responded
    </span>
  );
}

/**
 * Card component showing event summary and RSVP status for additional events.
 *
 * @param event - The wedding event to display.
 * @param rsvp - The guest's existing RSVP response, or null if not yet submitted.
 */
export function EventRsvpCard({ event, rsvp }: EventRsvpCardProps) {
  const deadlinePassed = isDeadlinePassed();

  return (
    <div
      data-testid="event-rsvp-card"
      className="rounded-lg border border-gray-200 bg-[#fffdfb] p-4 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-medium text-[#9e3f3f]">{event.name}</h3>
            <RsvpStatusBadge
              attendanceStatus={rsvp?.attendanceStatus ?? null}
            />
          </div>

          <div className="space-y-0.5 text-sm text-gray-600">
            <p>{formatEventDate(event.eventDate)}</p>
            <p>{formatEventTime(event.startTime)}</p>
            {event.location && <p>{event.location}</p>}
          </div>
        </div>

        <div className="flex-shrink-0">
          {deadlinePassed ? (
            <span className="inline-block rounded-md border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-500">
              RSVP Closed
            </span>
          ) : (
            <Link
              href={`/rsvp/${event.id}` as Route}
              className="inline-block rounded-md bg-[#9e3f3f] px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#b76565]"
            >
              {rsvp ? 'Update RSVP' : 'RSVP Now'}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
