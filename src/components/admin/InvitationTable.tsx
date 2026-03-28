'use client';

import { useMemo, useState } from 'react';
import type { Row } from '@tanstack/react-table';
import { DataTable } from '@/components/table/DataTable';
import type { DataTableColumnConfig } from '@/components/table/tableTypes';
import { MEAL_CHOICE_LABELS, type MealOption } from '@/lib/constants';
import { EventVisibilityEditor } from '@/components/admin/EventVisibilityEditor';
import InvitationEditModal from '@/components/admin/InvitationEditModal';
import { resetInvitationRSVP } from '@/app/admin/invitations/actions';

export type AvailableEvent = {
  id: string;
  name: string;
  sortOrder: number;
};

export type InvitationGuestRow = {
  id: string;
  firstName: string;
  lastName: string;
  type: 'adult' | 'child';
  attending: boolean | null;
  mealChoice: MealOption | null;
  dietaryRestrictions: string | null;
  notes: string | null;
};

export type InvitationTableRow = {
  id: string;
  invitationName: string;
  relationshipToCouple: string;
  totalInvited: number;
  status: 'submitted' | 'pending';
  attendingCount: number;
  declinedCount: number;
  pendingCount: number;
  guests: InvitationGuestRow[];
  availableEvents: AvailableEvent[];
  initialVisibleEventIds: string[];
  searchText: string;
  /** Two-word invitation code, e.g. "swift-panda". Null for legacy invitations. */
  invitationCode: string | null;
  mailingAddress: string | null;
  address: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
};

export type InvitationTableProps = {
  data: InvitationTableRow[];
};

const STATUS_OPTIONS = [
  { label: 'Submitted', value: 'submitted' },
  { label: 'Pending', value: 'pending' },
];

const formatGuestName = (guest: InvitationGuestRow) => {
  const nameParts = [guest.firstName, guest.lastName].filter(Boolean);

  if (nameParts.length === 0) {
    return 'Guest';
  }

  return nameParts.join(' ');
};

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
 * Invitations admin table with expandable guest rows.
 *
 * @param props - Invitations table data.
 * @returns Table for invitations and guests.
 * @throws {Error} Does not throw.
 */
export function InvitationTable({ data }: InvitationTableProps) {
  const relationshipOptions = useMemo(() => {
    const uniqueRelationships = Array.from(
      new Set(data.map((row) => row.relationshipToCouple).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));

    return uniqueRelationships.map((relationship) => ({
      label: relationship,
      value: relationship,
    }));
  }, [data]);

  const columnConfig = useMemo<
    DataTableColumnConfig<InvitationTableRow>[]
  >(() => {
    return [
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
        id: 'status',
        header: 'RSVP Status',
        accessor: (row) => row.status,
        cell: (value) => (value === 'submitted' ? 'Submitted' : 'Pending'),
        filterOptions: STATUS_OPTIONS,
        filterLabel: 'Status',
      },
      {
        id: 'totalInvited',
        header: 'Invited',
        accessor: (row) => row.totalInvited,
      },
      {
        id: 'attendingCount',
        header: 'Attending',
        accessor: (row) => row.attendingCount,
      },
      {
        id: 'declinedCount',
        header: 'Declined',
        accessor: (row) => row.declinedCount,
      },
      {
        id: 'pendingCount',
        header: 'Pending',
        accessor: (row) => row.pendingCount,
      },
    ];
  }, [relationshipOptions]);

  const renderGuestsTable = (row: Row<InvitationTableRow>) => {
    const guests = row.original.guests;

    if (guests.length === 0) {
      return <div className="text-sm text-gray-500">No guests found.</div>;
    }

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700">Guests</p>
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">RSVP</th>
                  <th className="px-3 py-2">Meal</th>
                  <th className="px-3 py-2">Dietary</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {guests.map((guest) => {
                  const guestName = formatGuestName(guest);
                  const attendingStatus = formatGuestAttendance(
                    guest.attending,
                  );
                  const mealChoice = guest.mealChoice
                    ? (MEAL_CHOICE_LABELS[guest.mealChoice] ?? guest.mealChoice)
                    : '-';
                  const dietaryRestrictions =
                    guest.dietaryRestrictions?.trim() || '-';
                  const notes = guest.notes?.trim() || '-';

                  return (
                    <tr key={guest.id}>
                      <td className="px-3 py-2 text-gray-700">{guestName}</td>
                      <td className="px-3 py-2 text-gray-700 capitalize">
                        {guest.type}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {attendingStatus}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{mealChoice}</td>
                      <td className="px-3 py-2 text-gray-700">
                        {dietaryRestrictions}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{notes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {row.original.invitationCode && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-700">
              Invitation Code
            </p>
            <div className="rounded-md border border-gray-200 bg-white p-4">
              <InvitationCodePanel
                invitationCode={row.original.invitationCode}
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700">Visible Events</p>
          <div className="rounded-md border border-gray-200 bg-white p-4">
            <EventVisibilityEditor
              invitationId={row.original.id}
              availableEvents={row.original.availableEvents}
              initialVisibleEventIds={row.original.initialVisibleEventIds}
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700">Actions</p>
          <div className="flex flex-wrap gap-2 rounded-md border border-gray-200 bg-white p-4">
            <EditInvitationButton row={row.original} />
            <ResetRSVPButton invitationId={row.original.id} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <DataTable
      data={data}
      columnConfig={columnConfig}
      searchPlaceholder="Search invitations or guests"
      getRowId={(row) => row.id}
      getRowCanExpand={(row) => row.guests.length > 0}
      renderSubComponent={renderGuestsTable}
    />
  );
}

/**
 * Displays the invitation code and a copyable deep-link URL for the invitation.
 */
function InvitationCodePanel({ invitationCode }: { invitationCode: string }) {
  const [copied, setCopied] = useState(false);

  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_BASE_URL ?? '');
  const deepLinkUrl = `${origin}/login?code=${encodeURIComponent(invitationCode)}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(deepLinkUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-gray-500">Code:</span>
        <code className="rounded bg-gray-100 px-2 py-0.5 font-mono text-gray-800">
          {invitationCode}
        </code>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gray-500">Deep-link:</span>
        <span className="font-mono text-xs break-all text-gray-700">
          {deepLinkUrl}
        </span>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

/**
 * Edit Invitation button component.
 *
 * Opens `InvitationEditModal` pre-filled with the current row's data.
 */
function EditInvitationButton({ row }: { row: InvitationTableRow }) {
  const [isOpen, setIsOpen] = useState(false);

  const defaultValues = {
    mailingAddress: row.mailingAddress ?? '',
    relationshipToCouple: row.relationshipToCouple ?? '',
    totalInvited: row.totalInvited,
    invitationCode: row.invitationCode ?? '',
    address: row.address ?? '',
    addressLine2: row.addressLine2 ?? '',
    city: row.city ?? '',
    state: row.state ?? '',
    zipCode: row.zipCode ?? '',
    country: row.country ?? '',
  };

  return (
    <div>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-md bg-[#9e3f3f] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#7a3030]"
      >
        Edit Invitation
      </button>

      {isOpen && (
        <InvitationEditModal
          invitationId={row.id}
          defaultValues={defaultValues}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * Reset RSVP button component.
 */
function ResetRSVPButton({ invitationId }: { invitationId: string }) {
  const [isResetting, setIsResetting] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleReset = async () => {
    if (
      !confirm(
        'Are you sure you want to reset this RSVP? This will clear all responses and cannot be undone.',
      )
    ) {
      return;
    }

    setIsResetting(true);
    setMessage(null);

    const result = await resetInvitationRSVP(invitationId);

    setIsResetting(false);

    if (result.success) {
      setMessage({ type: 'success', text: 'RSVP reset successfully' });
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({
        type: 'error',
        text: result.error || 'Failed to reset RSVP',
      });
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleReset}
        disabled={isResetting}
        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {isResetting ? 'Resetting...' : 'Reset RSVP'}
      </button>

      {message && (
        <p
          className={`text-sm ${
            message.type === 'success' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
