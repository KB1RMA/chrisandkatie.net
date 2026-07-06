import { Marcellus } from 'next/font/google';
import type { Metadata } from 'next';
import { getDb } from '@/lib/db';
import { findAllSeatingTables } from '@/lib/db/repositories/seating';
import { AdminTabs } from '@/components/admin/AdminTabs';
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
  description: 'Admin seating chart builder for the reception.',
};

/**
 * Admin page for building the reception seating chart.
 *
 * Loads all guests (excluding those who declined) and the current seating
 * tables with assignments, then renders the interactive builder.
 *
 * @returns The seating chart admin page.
 */
export default async function AdminSeatingPage() {
  const db = getDb();

  const [invitations, tables] = await Promise.all([
    db.query.invitations.findMany({
      with: { guests: true },
    }),
    findAllSeatingTables(),
  ]);

  const guests: SeatingGuest[] = invitations.flatMap((invitation) =>
    invitation.guests
      .filter((guest) => guest.attending !== false)
      .map((guest) => ({
        id: guest.id,
        fullName: `${guest.firstName} ${guest.lastName}`.trim(),
        partyName:
          invitation.mailingAddress?.trim() ||
          `${guest.firstName} ${guest.lastName}`.trim(),
        attending: guest.attending,
      })),
  );

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
            Arrange tables and seat your guests for the reception.
          </p>
        </div>
        <SeatingChartBuilder guests={guests} tables={tableData} />
      </div>
    </div>
  );
}
