'use client';

import { useMemo } from 'react';
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
  notes: string | null;
  searchText: string;
};

export type GuestTableProps = {
  data: GuestTableRow[];
};

const STATUS_OPTIONS = [
  { label: 'Submitted', value: 'submitted' },
  { label: 'Pending', value: 'pending' },
];

const TYPE_OPTIONS = [
  { label: 'Adult', value: 'adult' },
  { label: 'Child', value: 'child' },
];

const formatGuestAttendance = (attending: boolean | null) => {
  if (attending === true) {
    return 'Attending';
  }

  if (attending === false) {
    return 'Declined';
  }

  return 'Pending';
};

/**
 * Guests admin table for individual guest RSVP records.
 *
 * @param props - Guest table data.
 * @returns Table for individual guests.
 * @throws {Error} Does not throw.
 */
export function GuestTable({ data }: GuestTableProps) {
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
        header: 'RSVP Status',
        accessor: (row) => row.status,
        cell: (value) => (value === 'submitted' ? 'Submitted' : 'Pending'),
        filterOptions: STATUS_OPTIONS,
        filterLabel: 'Status',
      },
      {
        id: 'attending',
        header: 'Response',
        accessor: (row) => (row.attending === null ? 'pending' : 'responded'),
        cell: (_value, row) => formatGuestAttendance(row.attending),
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
        id: 'notes',
        header: 'Notes',
        accessor: (row) => row.notes ?? '-',
      },
    ];
  }, [relationshipOptions]);

  return (
    <DataTable
      data={data}
      columnConfig={columnConfig}
      searchPlaceholder="Search guests or invitations"
      getRowId={(row) => row.id}
    />
  );
}
