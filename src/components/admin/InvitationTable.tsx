'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Row } from '@tanstack/react-table';
import { DataTable } from '@/components/table/DataTable';
import type { DataTableColumnConfig } from '@/components/table/tableTypes';
import { MEAL_CHOICE_LABELS, type MealOption } from '@/lib/constants';
import { addGuestSchema, type AddGuestInput } from '@/lib/schemas/guest';
import { EventVisibilityEditor } from '@/components/admin/EventVisibilityEditor';
import InvitationEditModal from '@/components/admin/InvitationEditModal';
import {
  resetInvitationRSVP,
  updateGuestType,
  addGuestToInvitation,
  removeGuestFromInvitation,
} from '@/app/admin/invitations/actions';

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
  contactEmail: string | null;
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
                  <th className="px-3 py-2">Actions</th>
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
                      <td className="px-3 py-2">
                        <GuestTypeSelect
                          guestId={guest.id}
                          guestName={formatGuestName(guest)}
                          initialType={guest.type}
                        />
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {attendingStatus}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{mealChoice}</td>
                      <td className="px-3 py-2 text-gray-700">
                        {dietaryRestrictions}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{notes}</td>
                      <td className="px-3 py-2">
                        <RemoveGuestButton
                          guestId={guest.id}
                          invitationId={row.original.id}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <AddGuestForm invitationId={row.original.id} />
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
          <p className="text-sm font-semibold text-gray-700">Contact Email</p>
          <div className="rounded-md border border-gray-200 bg-white p-4">
            <ContactEmailPanel contactEmail={row.original.contactEmail} />
          </div>
        </div>

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
 * Displays the invitee-provided contact email, with a copy-to-clipboard
 * button when one is on file.
 */
function ContactEmailPanel({ contactEmail }: { contactEmail: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!contactEmail) {
    return <p className="text-sm text-gray-500">Not provided</p>;
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(contactEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="font-mono text-gray-700">{contactEmail}</span>
      <button
        onClick={handleCopy}
        className="shrink-0 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
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

/**
 * Inline select that lets admins toggle a guest between Adult and Child.
 */
function GuestTypeSelect({
  guestId,
  guestName,
  initialType,
}: {
  guestId: string;
  guestName: string;
  initialType: 'adult' | 'child';
}) {
  const [type, setType] = useState<'adult' | 'child'>(initialType);
  const [saving, setSaving] = useState(false);

  const handleChange = async (next: 'adult' | 'child') => {
    const previous = type;

    setType(next);
    setSaving(true);

    try {
      const result = await updateGuestType(guestId, next);

      if (!result.success) {
        setType(previous);
      }
    } catch {
      setType(previous);
    } finally {
      setSaving(false);
    }
  };

  return (
    <select
      value={type}
      disabled={saving}
      aria-label={`Guest type for ${guestName}`}
      onChange={(e) => handleChange(e.target.value as 'adult' | 'child')}
      className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 capitalize focus:border-[#9e3f3f] focus:ring-1 focus:ring-[#9e3f3f] focus:outline-none disabled:cursor-wait disabled:opacity-60"
    >
      <option value="adult">Adult</option>
      <option value="child">Child</option>
    </select>
  );
}

/**
 * Inline form for adding a new guest to an invitation.
 *
 * Renders an "Add Guest" toggle button that reveals a controlled form with
 * First Name, Last Name, and Type fields. Collapses on success.
 */
function AddGuestForm({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddGuestInput>({
    resolver: zodResolver(addGuestSchema),
    defaultValues: { invitationId, type: 'adult' },
  });

  const onSubmit = async (data: AddGuestInput) => {
    setServerError(null);

    const result = await addGuestToInvitation(data);

    if (!result.success) {
      setServerError(result.error ?? 'Failed to add guest');

      return;
    }

    reset({ invitationId, type: 'adult' });
    setIsOpen(false);
    router.refresh();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="mt-1 text-sm font-medium text-[#9e3f3f] hover:underline"
      >
        + Add Guest
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mt-2 flex flex-wrap items-start gap-3 rounded-md border border-gray-200 bg-gray-50 p-3"
    >
      <input type="hidden" {...register('invitationId')} />

      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${invitationId}-firstName`}
          className="text-xs font-medium text-gray-600"
        >
          First Name
        </label>
        <input
          id={`${invitationId}-firstName`}
          {...register('firstName')}
          placeholder="First name"
          aria-describedby={
            errors.firstName ? `${invitationId}-firstName-error` : undefined
          }
          className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#9e3f3f] focus:ring-1 focus:ring-[#9e3f3f] focus:outline-none"
        />
        {errors.firstName && (
          <p
            id={`${invitationId}-firstName-error`}
            className="text-xs text-red-600"
          >
            {errors.firstName.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${invitationId}-lastName`}
          className="text-xs font-medium text-gray-600"
        >
          Last Name
        </label>
        <input
          id={`${invitationId}-lastName`}
          {...register('lastName')}
          placeholder="Last name"
          aria-describedby={
            errors.lastName ? `${invitationId}-lastName-error` : undefined
          }
          className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#9e3f3f] focus:ring-1 focus:ring-[#9e3f3f] focus:outline-none"
        />
        {errors.lastName && (
          <p
            id={`${invitationId}-lastName-error`}
            className="text-xs text-red-600"
          >
            {errors.lastName.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${invitationId}-type`}
          className="text-xs font-medium text-gray-600"
        >
          Type
        </label>
        <select
          id={`${invitationId}-type`}
          {...register('type')}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 focus:border-[#9e3f3f] focus:ring-1 focus:ring-[#9e3f3f] focus:outline-none"
        >
          <option value="adult">Adult</option>
          <option value="child">Child</option>
        </select>
      </div>

      <div className="flex items-end gap-2 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-[#9e3f3f] px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-[#7a3030] disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {isSubmitting ? 'Adding...' : 'Add Guest'}
        </button>
        <button
          type="button"
          onClick={() => {
            reset({ invitationId, type: 'adult' });
            setIsOpen(false);
            setServerError(null);
          }}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>

      {serverError && (
        <p className="w-full text-sm text-red-600">{serverError}</p>
      )}
    </form>
  );
}

/**
 * Two-click inline confirm button for removing a guest from an invitation.
 *
 * State machine: idle → confirming → idle.
 * Renders "Remove" in idle state; "Confirm?" + "Cancel" in confirming state.
 */
function RemoveGuestButton({
  guestId,
  invitationId,
}: {
  guestId: string;
  invitationId: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'confirming'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleConfirm = async () => {
    setIsRemoving(true);
    setError(null);

    const result = await removeGuestFromInvitation({ guestId, invitationId });

    setIsRemoving(false);

    if (!result.success) {
      setError(result.error ?? 'Failed to remove guest');
      setState('idle');

      return;
    }

    setState('idle');
    router.refresh();
  };

  if (state === 'confirming') {
    return (
      <span className="flex flex-col items-start gap-1">
        <span className="flex gap-2">
          <button
            onClick={handleConfirm}
            disabled={isRemoving}
            className="rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isRemoving ? 'Removing...' : 'Confirm?'}
          </button>
          <button
            onClick={() => {
              setState('idle');
              setError(null);
            }}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </span>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </span>
    );
  }

  return (
    <span className="flex flex-col items-start gap-1">
      <button
        onClick={() => setState('confirming')}
        className="text-xs text-red-600 hover:underline"
      >
        Remove
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
