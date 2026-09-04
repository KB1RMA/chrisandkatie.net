'use client';

import { useMemo } from 'react';
import { DataTable } from '@/components/table/DataTable';
import type { DataTableColumnConfig } from '@/components/table/tableTypes';

export type EventRsvpRow = {
  id: string;
  guestName: string;
  partyName: string;
  contactEmail: string | null;
  rsvpStatus: 'attending' | 'not_attending' | 'no_response';
  numberOfAttending: number;
  specialRequests: string | null;
  notes: string | null;
  searchText: string;
};

const RSVP_STATUS_OPTIONS = [
  { label: 'Attending', value: 'attending' },
  { label: 'Not Attending', value: 'not_attending' },
  { label: 'No Response', value: 'no_response' },
];

/**
 * Converts an RSVP status value to a human-readable label.
 *
 * @param status - Raw RSVP status value from the database.
 * @returns Human-readable RSVP status label.
 */
const formatRsvpStatus = (status: string) => {
  if (status === 'attending') {
    return 'Attending';
  }

  if (status === 'not_attending') {
    return 'Not Attending';
  }

  return 'No Response';
};

/**
 * Event RSVP table for displaying all guest RSVPs for a specific event.
 *
 * Supports client-side name search and RSVP status filtering.
 *
 * @param props - Table data containing RSVP rows for the event.
 * @returns Table listing each invited guest and their RSVP status.
 * @throws {Error} Does not throw.
 */
export function EventRsvpTable({ data }: { data: EventRsvpRow[] }) {
  const columnConfig = useMemo<DataTableColumnConfig<EventRsvpRow>[]>(() => {
    return [
      {
        id: 'guestName',
        header: 'Guest',
        accessor: (row) => row.guestName,
      },
      {
        id: 'partyName',
        header: 'Party',
        accessor: (row) => row.partyName,
      },
      {
        id: 'contactEmail',
        header: 'Email',
        accessor: (row) => row.contactEmail ?? '-',
      },
      {
        id: 'rsvpStatus',
        header: 'RSVP Status',
        accessor: (row) => row.rsvpStatus,
        cell: (value) => formatRsvpStatus(String(value)),
        filterOptions: RSVP_STATUS_OPTIONS,
        filterLabel: 'RSVP Status',
      },
      {
        id: 'numberOfAttending',
        header: '# Attending',
        accessor: (row) => row.numberOfAttending,
      },
      {
        id: 'specialRequests',
        header: 'Notes',
        accessor: (row) => row.specialRequests ?? '-',
      },
    ];
  }, []);

  return (
    <DataTable
      data={data}
      columnConfig={columnConfig}
      searchPlaceholder="Search guests..."
      getRowId={(row) => row.id}
      renderSummary={(filteredRows) => {
        const attendingCount = filteredRows.reduce(
          (total, row) => total + row.numberOfAttending,
          0,
        );

        return (
          <p className="text-sm text-[#6a5555]">
            <span className="font-semibold text-[#9e3f3f]">
              {attendingCount}
            </span>{' '}
            attending
            {filteredRows.length !== data.length && (
              <> (of {filteredRows.length} shown)</>
            )}
          </p>
        );
      }}
    />
  );
}
