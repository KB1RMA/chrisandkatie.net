'use client';

/**
 * EventCard component for displaying a single wedding event in the admin dashboard.
 *
 * Shows event name, date, times, location, type badge, and RSVP attendance summary.
 * Includes Edit and Delete buttons that open dialog modals.
 */
import { useState } from 'react';
import type { WeddingEvent } from '@/lib/db/schema';
import RsvpSummary from './RsvpSummary';
import EventEditModal from './EventEditModal';
import EventDeleteDialog from './EventDeleteDialog';

export type RsvpSummaryData = {
  attending: number;
  notAttending: number;
  noResponse: number;
  total: number;
};

type EventCardProps = {
  event: WeddingEvent;
  rsvpSummary: RsvpSummaryData;
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  main: 'Main',
  rehearsal: 'Rehearsal',
  brunch: 'Brunch',
  other: 'Other',
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  main: 'bg-[#9e3f3f] text-white',
  rehearsal: 'bg-[#b76565] text-white',
  brunch: 'bg-[#d4956a] text-white',
  other: 'bg-gray-500 text-white',
};

/**
 * Format an ISO date string for display (e.g. "September 11, 2026").
 *
 * @param dateStr - ISO 8601 date string (YYYY-MM-DD).
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
 * Format a 24-hour time string for display (e.g. "6:30 PM").
 *
 * @param timeStr - Time string in HH:MM format.
 * @returns Formatted 12-hour time string.
 */
function formatTime(timeStr: string): string {
  const [hoursStr, minutesStr] = timeStr.split(':');
  const hours = parseInt(hoursStr ?? '0', 10);
  const minutes = minutesStr ?? '00';
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${minutes} ${period}`;
}

/**
 * Admin card displaying a single event with its RSVP summary and action buttons.
 *
 * @param event - The wedding event record to display.
 * @param rsvpSummary - RSVP count summary for this event.
 * @returns Event card with details, RSVP summary, and edit/delete buttons.
 */
export function EventCard({ event, rsvpSummary }: EventCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const typeBadgeClass =
    EVENT_TYPE_COLORS[event.type] ?? EVENT_TYPE_COLORS['other'];
  const typeLabel = EVENT_TYPE_LABELS[event.type] ?? event.type;

  return (
    <>
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-[#9e3f3f]">
                {event.name}
              </h2>

              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClass}`}
              >
                {typeLabel}
              </span>
            </div>

            <div className="space-y-1 text-sm text-gray-600">
              <p>{formatEventDate(event.eventDate)}</p>
              <p>
                {formatTime(event.startTime)} – {formatTime(event.endTime)}
              </p>

              {event.location && <p>{event.location}</p>}
            </div>

            <div className="mt-4">
              <RsvpSummary summary={rsvpSummary} />
            </div>
          </div>

          <div className="flex flex-shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setIsEditOpen(true)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Edit
            </button>

            <button
              type="button"
              onClick={() => setIsDeleteOpen(true)}
              className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {isEditOpen && (
        <EventEditModal event={event} onClose={() => setIsEditOpen(false)} />
      )}

      {isDeleteOpen && (
        <EventDeleteDialog
          event={{ id: event.id, name: event.name }}
          rsvpCount={rsvpSummary.attending + rsvpSummary.notAttending}
          onClose={() => setIsDeleteOpen(false)}
        />
      )}
    </>
  );
}
