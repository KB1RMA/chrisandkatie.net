'use client';

import { useMemo, useState } from 'react';
import { DataTable } from '@/components/table/DataTable';
import type { DataTableColumnConfig } from '@/components/table/tableTypes';
import { EventRsvpEditModal } from './EventRsvpEditModal';

export type EventRsvpRow = {
  id: string;
  guestName: string;
  partyName: string;
  invitationId: string;
  rsvpStatus: 'attending' | 'not_attending' | 'no_response';
  /** Whether this guest's party has any stored response for the event. */
  hasPartyResponse: boolean;
  /** The party's last-seen response timestamp, used to detect a concurrent edit. */
  partyRsvpUpdatedAt: string | null;
  /** Status the edit dialog pre-selects for this guest. */
  defaultAttending: boolean;
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
 * Edit control for a single RSVP row.
 *
 * Owns the dialog open state so each row can be edited independently.
 *
 * @param props - The clicked row, the party it belongs to, and the event id.
 * @returns A button that opens the party RSVP edit dialog.
 */
function EventRsvpEditButton({
  row,
  party,
  eventId,
}: {
  row: EventRsvpRow;
  party: EventRsvpRow[];
  eventId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-md border border-[#e5d5d5] bg-white px-3 py-1 text-xs font-medium text-[#9e3f3f] hover:bg-[#f3dedb]"
      >
        Edit
      </button>

      {isOpen && (
        <EventRsvpEditModal
          eventId={eventId}
          guestId={row.id}
          partyName={row.partyName}
          members={party.map((member) => ({
            id: member.id,
            guestName: member.guestName,
            defaultAttending: member.defaultAttending,
          }))}
          hasPartyResponse={row.hasPartyResponse}
          expectedUpdatedAt={row.partyRsvpUpdatedAt}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Event RSVP table for displaying all guest RSVPs for a specific event.
 *
 * Supports client-side name search and RSVP status filtering, plus an admin
 * edit action per row. RSVPs are stored per party, so the edit dialog is handed
 * every member of the clicked guest's party rather than the single row.
 *
 * @param props - Table data containing RSVP rows for the event, and the event id.
 * @returns Table listing each invited guest and their RSVP status.
 * @throws {Error} Does not throw.
 */
export function EventRsvpTable({
  data,
  eventId,
}: {
  data: EventRsvpRow[];
  eventId: string;
}) {
  const partyByInvitationId = useMemo(() => {
    return data.reduce((acc, row) => {
      acc.set(row.invitationId, [...(acc.get(row.invitationId) ?? []), row]);

      return acc;
    }, new Map<string, EventRsvpRow[]>());
  }, [data]);

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
      {
        id: 'actions',
        header: '',
        accessor: () => '',
        enableSorting: false,
        cell: (_value, row) => (
          <EventRsvpEditButton
            row={row}
            party={partyByInvitationId.get(row.invitationId) ?? [row]}
            eventId={eventId}
          />
        ),
      },
    ];
  }, [eventId, partyByInvitationId]);

  return (
    <DataTable
      data={data}
      columnConfig={columnConfig}
      searchPlaceholder="Search guests..."
      getRowId={(row) => row.id}
    />
  );
}
