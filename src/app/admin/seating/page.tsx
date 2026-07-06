import { Marcellus } from 'next/font/google';
import type { Metadata } from 'next';
import { getDb } from '@/lib/db';
import { findAllEvents } from '@/lib/db/repositories/events';
import { getEventRsvpReconstruction } from '@/lib/db/repositories/rsvpResponses';
import { findAllSeatingTables } from '@/lib/db/repositories/seating';
import { AdminTabs } from '@/components/admin/AdminTabs';
import { SeatingEventSelector } from '@/components/admin/SeatingEventSelector';
import {
  SeatingChartBuilder,
  type SeatingGuest,
  type SeatingTableData,
} from '@/components/admin/SeatingChartBuilder';

export const dynamic = 'force-dynamic';

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

export const metadata: Metadata = {
  title: 'Seating Chart',
  description: 'Admin seating chart builder for wedding events.',
};

type Props = {
  searchParams: Promise<{ eventId?: string }>;
};

/**
 * Admin page for building an event's seating chart.
 *
 * The event is chosen via the `eventId` search param, defaulting to the
 * main event. Guests are scoped to those invited to the selected event.
 * Attendance is derived from the per-event RSVP reconstruction
 * (RsvpResponse/Attendee rows); for the main event only, the guest-level
 * `attending` column written by the main RSVP wizard fills in for parties
 * without per-event responses. Guests who declined are excluded.
 *
 * @param searchParams - URL search params; supports `eventId` selection.
 * @returns The seating chart admin page.
 */
export default async function AdminSeatingPage({ searchParams }: Props) {
  const db = getDb();
  const params = await searchParams;
  const events = await findAllEvents();

  const selectedEvent =
    events.find((event) => event.id === params.eventId) ??
    events.find((event) => event.type === 'main') ??
    events[0];

  if (!selectedEvent) {
    return (
      <SeatingPageShell>
        <p className="text-center text-lg text-[#6a5555]">
          No events found. Create an event before building a seating chart.
        </p>
      </SeatingPageShell>
    );
  }

  const isMainEvent = selectedEvent.type === 'main';

  const [reconstruction, legacyGuests, tables] = await Promise.all([
    getEventRsvpReconstruction(selectedEvent.id),
    isMainEvent
      ? db.query.guests.findMany({
          columns: { id: true, attending: true },
        })
      : Promise.resolve([]),
    findAllSeatingTables(selectedEvent.id),
  ]);

  const legacyAttendingById = new Map(
    legacyGuests.map((guest) => [guest.id, guest.attending]),
  );

  const guests: SeatingGuest[] = reconstruction.rows
    .map((row) => ({
      id: row.guestId,
      fullName: `${row.firstName} ${row.lastName}`.trim(),
      partyName: row.partyName,
      // Per-event status wins; for the main event, wizard-written
      // guest.attending fills in for parties without per-event responses.
      attending:
        row.status === 'attending'
          ? true
          : row.status === 'not_attending'
            ? false
            : (legacyAttendingById.get(row.guestId) ?? null),
    }))
    .filter((guest) => guest.attending !== false);

  const seatableGuestIds = new Set(guests.map((guest) => guest.id));

  const tableData: SeatingTableData[] = tables.map((table) => ({
    id: table.id,
    name: table.name,
    capacity: table.capacity,
    isHeadTable: table.isHeadTable,
    sortOrder: table.sortOrder,
    // Drop assignments for guests who have since declined or been removed
    guestIds: table.assignments
      .map((assignment) => assignment.guestId)
      .filter((guestId) => seatableGuestIds.has(guestId)),
  }));

  return (
    <SeatingPageShell
      selector={
        <SeatingEventSelector
          events={events.map((event) => ({ id: event.id, name: event.name }))}
          selectedEventId={selectedEvent.id}
        />
      }
    >
      <SeatingChartBuilder
        eventId={selectedEvent.id}
        guests={guests}
        tables={tableData}
      />
    </SeatingPageShell>
  );
}

/**
 * Shared page chrome for the seating admin page: heading, tabs, and intro.
 *
 * @param children - The page body (builder or empty-state message).
 * @param selector - Optional event selector rendered above the body.
 * @returns The page layout wrapper.
 */
function SeatingPageShell({
  children,
  selector,
}: {
  children: React.ReactNode;
  selector?: React.ReactNode;
}) {
  return (
    <div className="font-roboto flex min-h-screen flex-col items-center justify-start bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-4 sm:p-8 print:bg-none print:p-0">
      <div className="w-full max-w-7xl">
        <h1
          className={`${marcellus.className} mb-4 text-center text-4xl font-bold text-[#9e3f3f] sm:text-5xl print:mb-2 print:text-3xl print:text-black`}
        >
          Seating Chart
        </h1>
        <div className="print:hidden">
          <AdminTabs />
          <p className="mt-6 mb-4 text-center text-lg text-[#6a5555]">
            Arrange tables and seat your guests.
          </p>
          {selector && <div className="mb-4">{selector}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}
