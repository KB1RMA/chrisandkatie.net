'use client';

import { useMemo, useState } from 'react';
import { DataTable } from '@/components/table/DataTable';
import type { DataTableColumnConfig } from '@/components/table/tableTypes';
import { MEAL_CHOICE_LABELS, type MealOption } from '@/lib/constants';

export type GuestTableRow = {
  id: string;
  fullName: string;
  invitationName: string;
  relationshipToCouple: string;
  type: 'adult' | 'child';
  status: 'submitted' | 'pending';
  attending: boolean | null;
  mealChoice: MealOption | null;
  dietaryRestrictions: string | null;
  notes: string | null;
  searchText: string;
  invitedEventIds: string[];
};

export type GuestTableProps = {
  data: GuestTableRow[];
  availableEvents?: { id: string; name: string }[];
};

const RSVP_STATUS_OPTIONS = [
  { label: 'Attending', value: 'attending' },
  { label: 'Not Attending', value: 'not_attending' },
  { label: 'No Response', value: 'no_response' },
];

const STATUS_OPTIONS = [
  { label: 'Submitted', value: 'submitted' },
  { label: 'Pending', value: 'pending' },
];

const TYPE_OPTIONS = [
  { label: 'Adult', value: 'adult' },
  { label: 'Child', value: 'child' },
];

/**
 * Maps an attending boolean to an RSVP status string for filtering.
 *
 * @param attending - Guest's attendance value from the database.
 * @returns RSVP status string: 'attending', 'not_attending', or 'no_response'.
 */
const toRsvpStatusValue = (attending: boolean | null) => {
  if (attending === true) {
    return 'attending';
  }

  if (attending === false) {
    return 'not_attending';
  }

  return 'no_response';
};

const formatGuestAttendance = (attending: boolean | null) => {
  if (attending === true) {
    return 'Attending';
  }

  if (attending === false) {
    return 'Declined';
  }

  return 'No Response';
};

/**
 * Guests admin table for individual guest RSVP records.
 *
 * Supports client-side name search, RSVP status filter, and event filter.
 *
 * @param props - Guest table data and optional available events for filtering.
 * @returns Table for individual guests.
 * @throws {Error} Does not throw.
 */
export function GuestTable({ data, availableEvents = [] }: GuestTableProps) {
  const [rsvpStatusFilter, setRsvpStatusFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      const matchesRsvpStatus =
        !rsvpStatusFilter ||
        toRsvpStatusValue(row.attending) === rsvpStatusFilter;
      const matchesEvent =
        !eventFilter || row.invitedEventIds.includes(eventFilter);

      return matchesRsvpStatus && matchesEvent;
    });
  }, [data, rsvpStatusFilter, eventFilter]);

  const relationshipOptions = useMemo(() => {
    const uniqueRelationships = Array.from(
      new Set(data.map((row) => row.relationshipToCouple).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));

    return uniqueRelationships.map((relationship) => ({
      label: relationship,
      value: relationship,
    }));
  }, [data]);

  const columnConfig = useMemo<DataTableColumnConfig<GuestTableRow>[]>(() => {
    return [
      {
        id: 'fullName',
        header: 'Guest',
        accessor: (row) => row.fullName,
      },
      {
        id: 'invitationName',
        header: 'Invitation',
        accessor: (row) => row.invitationName,
      },
      {
        id: 'relationshipToCouple',
        header: 'Relationship',
        accessor: (row) => row.relationshipToCouple,
        filterOptions: relationshipOptions,
        filterLabel: 'Relationship',
      },
      {
        id: 'type',
        header: 'Type',
        accessor: (row) => row.type,
        filterOptions: TYPE_OPTIONS,
        filterLabel: 'Type',
      },
      {
        id: 'status',
        header: 'Invite Status',
        accessor: (row) => row.status,
        cell: (value) => (value === 'submitted' ? 'Submitted' : 'Pending'),
        filterOptions: STATUS_OPTIONS,
        filterLabel: 'Invite Status',
      },
      {
        id: 'attending',
        header: 'RSVP',
        accessor: (row) => toRsvpStatusValue(row.attending),
        cell: (_value, row) => formatGuestAttendance(row.attending),
        filterOptions: RSVP_STATUS_OPTIONS,
        filterLabel: 'RSVP Status',
      },
      {
        id: 'mealChoice',
        header: 'Meal',
        accessor: (row) => row.mealChoice ?? '-',
        cell: (value) =>
          value && value !== '-'
            ? (MEAL_CHOICE_LABELS[value as MealOption] ?? String(value))
            : '-',
      },
      {
        id: 'dietaryRestrictions',
        header: 'Dietary',
        accessor: (row) => row.dietaryRestrictions ?? '-',
      },
      {
        id: 'notes',
        header: 'Notes',
        accessor: (row) => row.notes ?? '-',
      },
    ];
  }, [relationshipOptions]);

  return (
    <div className="space-y-4">
      {availableEvents.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor="event-filter"
            className="text-sm font-medium text-[#6a5555]"
          >
            Filter by event:
          </label>
          <select
            id="event-filter"
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-[#6a5555] focus:border-[#9e3f3f] focus:outline-none"
          >
            <option value="">All events</option>
            {availableEvents.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
          <label
            htmlFor="rsvp-filter"
            className="text-sm font-medium text-[#6a5555]"
          >
            RSVP status:
          </label>
          <select
            id="rsvp-filter"
            value={rsvpStatusFilter}
            onChange={(e) => setRsvpStatusFilter(e.target.value)}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-[#6a5555] focus:border-[#9e3f3f] focus:outline-none"
          >
            <option value="">All statuses</option>
            {RSVP_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <DataTable
        data={filteredData}
        columnConfig={columnConfig}
        searchPlaceholder="Search guests or invitations"
        getRowId={(row) => row.id}
      />
    </div>
  );
}
