'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import {
  addSeatingTable,
  assignGuestToTable,
  deleteSeatingTable,
  generateSeatingTables,
  unassignGuest,
  updateSeatingTableDetails,
} from '@/app/admin/seating/actions';

export type SeatingGuest = {
  id: string;
  fullName: string;
  partyName: string;
  attending: boolean | null;
};

export type SeatingTableData = {
  id: string;
  name: string;
  capacity: number;
  isHeadTable: boolean;
  sortOrder: number;
  guestIds: string[];
};

type SeatingChartBuilderProps = {
  guests: SeatingGuest[];
  tables: SeatingTableData[];
};

const BUTTON_CLASS =
  'rounded-md bg-[#9e3f3f] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#b76565] disabled:opacity-50';
const SECONDARY_BUTTON_CLASS =
  'rounded-md border border-[#9e3f3f] bg-white px-4 py-2 text-sm font-medium text-[#9e3f3f] transition-colors hover:bg-[#f3dedb]';
const INPUT_CLASS =
  'rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#9e3f3f] focus:outline-none focus:ring-1 focus:ring-[#9e3f3f]';

/**
 * Compact display label for a seat chip: first name plus last initial.
 *
 * @param fullName - The guest's full name.
 * @returns Shortened label, e.g. "Chris S."
 */
function seatLabel(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);

  if (parts.length < 2) {
    return fullName;
  }

  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/**
 * Interactive seating chart builder.
 *
 * Renders unassigned guests in a sidebar and each seating table as a visual
 * table with seats. Guests are placed by drag-and-drop or by clicking a
 * guest then clicking a table. All changes persist immediately via server
 * actions with optimistic local state.
 *
 * @param props.guests - All seatable guests (attending or awaiting response).
 * @param props.tables - Current seating tables with assigned guest ids.
 * @returns The seating chart builder UI.
 */
export function SeatingChartBuilder({
  guests,
  tables: initialTables,
}: SeatingChartBuilderProps) {
  const [tables, setTables] = useState<SeatingTableData[]>(initialTables);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showPending, setShowPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);

  const guestById = useMemo(
    () => new Map(guests.map((guest) => [guest.id, guest])),
    [guests],
  );

  const assignedGuestIds = useMemo(
    () => new Set(tables.flatMap((table) => table.guestIds)),
    [tables],
  );

  const unassignedGuests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return guests
      .filter((guest) => !assignedGuestIds.has(guest.id))
      .filter((guest) => showPending || guest.attending === true)
      .filter(
        (guest) =>
          !query ||
          `${guest.fullName} ${guest.partyName}`.toLowerCase().includes(query),
      )
      .sort((a, b) => a.partyName.localeCompare(b.partyName));
  }, [guests, assignedGuestIds, search, showPending]);

  const seatedCount = assignedGuestIds.size;
  const totalCapacity = tables.reduce((sum, table) => sum + table.capacity, 0);

  /**
   * Run a server action with optimistic state, reverting on failure.
   *
   * @param optimistic - The next local tables state to show immediately.
   * @param action - The server action to persist the change.
   */
  async function runAction(
    optimistic: SeatingTableData[],
    action: () => Promise<{ success: boolean; error?: string }>,
  ) {
    const previous = tables;

    setError(null);
    setTables(optimistic);
    setPending(true);

    try {
      const result = await action();

      if (!result.success) {
        setTables(previous);
        setError(result.error ?? 'Something went wrong.');
      }
    } catch {
      setTables(previous);
      setError('Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  }

  /** Seat a guest at a table (optimistically), enforcing capacity locally. */
  function placeGuest(guestId: string, tableId: string) {
    const target = tables.find((table) => table.id === tableId);

    if (!target || target.guestIds.includes(guestId)) {
      setSelectedGuestId(null);

      return;
    }

    if (target.guestIds.length >= target.capacity) {
      setError(`${target.name} is full.`);

      return;
    }

    setSelectedGuestId(null);

    const optimistic = tables.map((table) => {
      if (table.id === tableId) {
        return { ...table, guestIds: [...table.guestIds, guestId] };
      }

      return {
        ...table,
        guestIds: table.guestIds.filter((id) => id !== guestId),
      };
    });

    void runAction(optimistic, () => assignGuestToTable({ guestId, tableId }));
  }

  /** Return a seated guest to the unassigned list. */
  function removeGuest(guestId: string) {
    setSelectedGuestId(null);

    const optimistic = tables.map((table) => ({
      ...table,
      guestIds: table.guestIds.filter((id) => id !== guestId),
    }));

    void runAction(optimistic, () => unassignGuest({ guestId }));
  }

  /** Handle a drop event onto a table (or the unassigned sidebar). */
  function handleDrop(event: React.DragEvent, tableId: string | null) {
    event.preventDefault();

    const guestId = event.dataTransfer.getData('text/plain');

    if (!guestId || !guestById.has(guestId)) {
      return;
    }

    if (tableId) {
      placeGuest(guestId, tableId);
    } else {
      removeGuest(guestId);
    }
  }

  if (tables.length === 0) {
    return <SetupForm onError={setError} error={error} />;
  }

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <a
          href="/api/admin/export/seating?format=coordinator"
          className={SECONDARY_BUTTON_CLASS}
        >
          Export CSV
        </a>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={() => window.print()}
        >
          Print Layout
        </button>
        <AddTableButton onError={setError} />
        <span className="ml-auto text-sm text-[#6a5555]">
          {seatedCount} of {totalCapacity} seats filled
          {pending ? ' · saving…' : ''}
        </span>
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700 print:hidden">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Unassigned guests sidebar */}
        <aside
          className="w-full shrink-0 rounded-lg bg-[#fffdfb] p-4 shadow lg:w-72 print:hidden"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => handleDrop(event, null)}
        >
          <h2 className="mb-2 text-lg font-semibold text-[#9e3f3f]">
            Unassigned ({unassignedGuests.length})
          </h2>
          <p className="mb-3 text-xs text-[#7a6666]">
            Drag a guest onto a table, or click a guest then a table. Drop a
            seated guest here to unassign.
          </p>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search guests…"
            className={cn(INPUT_CLASS, 'mb-2 w-full')}
          />
          <label className="mb-3 flex items-center gap-2 text-xs text-[#6a5555]">
            <input
              type="checkbox"
              checked={showPending}
              onChange={(event) => setShowPending(event.target.checked)}
            />
            Include guests who haven&apos;t responded
          </label>
          <ul className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto lg:max-h-[70vh]">
            {unassignedGuests.map((guest) => (
              <li key={guest.id}>
                <button
                  type="button"
                  draggable
                  onDragStart={(event) =>
                    event.dataTransfer.setData('text/plain', guest.id)
                  }
                  onClick={() =>
                    setSelectedGuestId(
                      selectedGuestId === guest.id ? null : guest.id,
                    )
                  }
                  className={cn(
                    'w-full cursor-grab rounded-md border px-3 py-1.5 text-left text-sm transition-colors',
                    selectedGuestId === guest.id
                      ? 'border-[#9e3f3f] bg-[#f3dedb] text-[#9e3f3f]'
                      : 'border-gray-200 bg-white text-[#4a3a3a] hover:border-[#b76565]',
                  )}
                >
                  <span className="block truncate font-medium">
                    {guest.fullName}
                    {guest.attending !== true && (
                      <span className="ml-1 text-xs text-yellow-700">
                        (no response)
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-[#7a6666]">
                    {guest.partyName}
                  </span>
                </button>
              </li>
            ))}
            {unassignedGuests.length === 0 && (
              <li className="py-2 text-sm text-[#7a6666]">
                Everyone is seated 🎉
              </li>
            )}
          </ul>
        </aside>

        {/* Table layout */}
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 print:grid-cols-3 print:gap-4">
            {tables.map((table) => (
              <TableCard
                key={table.id}
                table={table}
                guestById={guestById}
                selectedGuestId={selectedGuestId}
                isEditing={editingTableId === table.id}
                onStartEdit={() => setEditingTableId(table.id)}
                onStopEdit={() => setEditingTableId(null)}
                onClickTable={() => {
                  if (selectedGuestId) {
                    placeGuest(selectedGuestId, table.id);
                  }
                }}
                onDrop={(event) => handleDrop(event, table.id)}
                onRemoveGuest={removeGuest}
                onUpdated={(updated) =>
                  setTables((current) =>
                    current.map((existing) =>
                      existing.id === updated.id
                        ? { ...existing, ...updated }
                        : existing,
                    ),
                  )
                }
                onDeleted={() =>
                  setTables((current) =>
                    current.filter((existing) => existing.id !== table.id),
                  )
                }
                onError={setError}
              />
            ))}
          </div>

          {/* Print-only roster: one list per table for the coordinator */}
          <div className="mt-8 hidden print:block">
            <h2 className="mb-2 text-lg font-semibold">Seating Roster</h2>
            <div className="grid grid-cols-2 gap-4">
              {tables.map((table) => (
                <div key={table.id} className="break-inside-avoid">
                  <h3 className="font-semibold">
                    {table.name} ({table.guestIds.length}/{table.capacity})
                  </h3>
                  <ol className="list-decimal pl-5 text-sm">
                    {table.guestIds.map((guestId) => (
                      <li key={guestId}>
                        {guestById.get(guestId)?.fullName ?? 'Unknown guest'}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type TableCardProps = {
  table: SeatingTableData;
  guestById: Map<string, SeatingGuest>;
  selectedGuestId: string | null;
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onClickTable: () => void;
  onDrop: (event: React.DragEvent) => void;
  onRemoveGuest: (guestId: string) => void;
  onUpdated: (
    table: Pick<SeatingTableData, 'id' | 'name' | 'capacity'>,
  ) => void;
  onDeleted: () => void;
  onError: (message: string | null) => void;
};

/**
 * A single seating table: a visual table shape with seats arranged around
 * it, plus inline name/capacity editing and delete.
 *
 * @param props - Table data, lookup map, and interaction callbacks.
 * @returns The table card.
 */
function TableCard({
  table,
  guestById,
  selectedGuestId,
  isEditing,
  onStartEdit,
  onStopEdit,
  onClickTable,
  onDrop,
  onRemoveGuest,
  onUpdated,
  onDeleted,
  onError,
}: TableCardProps) {
  const [name, setName] = useState(table.name);
  const [capacity, setCapacity] = useState(table.capacity);
  const seats: (string | null)[] = [
    ...table.guestIds,
    ...Array<null>(Math.max(0, table.capacity - table.guestIds.length)).fill(
      null,
    ),
  ];
  const isFull = table.guestIds.length >= table.capacity;

  /** Persist name/capacity edits via the server action. */
  async function saveEdits() {
    const result = await updateSeatingTableDetails({
      id: table.id,
      name,
      capacity,
    });

    if (!result.success) {
      onError(result.error);

      return;
    }

    onError(null);
    onUpdated({ id: table.id, name: name.trim(), capacity });
    onStopEdit();
  }

  /** Delete this table after confirmation. */
  async function handleDelete() {
    if (
      !window.confirm(
        `Delete ${table.name}? Seated guests will become unassigned.`,
      )
    ) {
      return;
    }

    const result = await deleteSeatingTable({ id: table.id });

    if (!result.success) {
      onError(result.error);

      return;
    }

    onError(null);
    onDeleted();
  }

  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      onClick={onClickTable}
      className={cn(
        'rounded-lg bg-[#fffdfb] p-4 shadow transition-shadow print:break-inside-avoid print:shadow-none print:ring-1 print:ring-gray-300',
        table.isHeadTable && 'sm:col-span-2 xl:col-span-3 print:col-span-3',
        selectedGuestId && !isFull && 'cursor-pointer ring-2 ring-[#b76565]',
      )}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        {isEditing ? (
          <div
            className="flex flex-wrap items-center gap-2"
            onClick={(event) => event.stopPropagation()}
          >
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={cn(INPUT_CLASS, 'w-32')}
              aria-label="Table name"
            />
            <input
              type="number"
              min={1}
              max={30}
              value={capacity}
              onChange={(event) => setCapacity(Number(event.target.value))}
              className={cn(INPUT_CLASS, 'w-16')}
              aria-label="Seats"
            />
            <button
              type="button"
              onClick={() => void saveEdits()}
              className="text-sm font-medium text-[#9e3f3f] hover:underline"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setName(table.name);
                setCapacity(table.capacity);
                onStopEdit();
              }}
              className="text-sm text-[#7a6666] hover:underline"
            >
              Cancel
            </button>
          </div>
        ) : (
          <h3 className="truncate font-semibold text-[#9e3f3f]">
            {table.name}
            <span className="ml-2 text-xs font-normal text-[#7a6666]">
              {table.guestIds.length}/{table.capacity}
            </span>
          </h3>
        )}
        {!isEditing && (
          <div
            className="flex shrink-0 gap-2 print:hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={onStartEdit}
              className="text-xs text-[#7a6666] hover:text-[#9e3f3f] hover:underline"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="text-xs text-[#7a6666] hover:text-red-700 hover:underline"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Table visual */}
      {table.isHeadTable ? (
        <div className="rounded-md border-2 border-[#d9b8a8] bg-[#f9efe9] p-3">
          <div className="flex flex-wrap justify-center gap-2">
            {seats.map((guestId, index) => (
              <SeatChip
                key={guestId ?? `empty-${index}`}
                guest={guestId ? guestById.get(guestId) : undefined}
                seatNumber={index + 1}
                onRemove={guestId ? () => onRemoveGuest(guestId) : undefined}
              />
            ))}
          </div>
        </div>
      ) : (
        <RoundTable
          seats={seats}
          guestById={guestById}
          onRemoveGuest={onRemoveGuest}
        />
      )}
    </div>
  );
}

type RoundTableProps = {
  seats: (string | null)[];
  guestById: Map<string, SeatingGuest>;
  onRemoveGuest: (guestId: string) => void;
};

/**
 * Circular table visual with seat chips arranged around the perimeter.
 *
 * @param props.seats - Guest id per seat position; null means empty.
 * @param props.guestById - Guest lookup for names.
 * @param props.onRemoveGuest - Called when a seated guest's remove button is clicked.
 * @returns The round table visual.
 */
function RoundTable({ seats, guestById, onRemoveGuest }: RoundTableProps) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[260px]">
      {/* Table surface */}
      <div className="absolute inset-[22%] flex items-center justify-center rounded-full border-2 border-[#d9b8a8] bg-[#f9efe9]" />
      {seats.map((guestId, index) => {
        const angle = (index / seats.length) * 2 * Math.PI - Math.PI / 2;
        const x = 50 + 46 * Math.cos(angle);
        const y = 50 + 46 * Math.sin(angle);

        return (
          <div
            key={guestId ?? `empty-${index}`}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <SeatChip
              guest={guestId ? guestById.get(guestId) : undefined}
              seatNumber={index + 1}
              onRemove={guestId ? () => onRemoveGuest(guestId) : undefined}
              compact
            />
          </div>
        );
      })}
    </div>
  );
}

type SeatChipProps = {
  guest: SeatingGuest | undefined;
  seatNumber: number;
  onRemove?: () => void;
  compact?: boolean;
};

/**
 * A single seat: a named, draggable chip when occupied, or a dashed empty
 * placeholder.
 *
 * @param props.guest - The seated guest, or undefined for an empty seat.
 * @param props.seatNumber - 1-based seat position, shown on empty seats.
 * @param props.onRemove - Unassign handler shown on occupied seats.
 * @param props.compact - Tighter styling for round-table perimeter chips.
 * @returns The seat chip element.
 */
function SeatChip({ guest, seatNumber, onRemove, compact }: SeatChipProps) {
  if (!guest) {
    return (
      <span
        className={cn(
          'flex items-center justify-center rounded-full border border-dashed border-gray-300 text-[10px] text-gray-400',
          compact ? 'h-7 w-7' : 'h-8 w-8',
        )}
      >
        {seatNumber}
      </span>
    );
  }

  return (
    <span
      draggable
      onDragStart={(event) =>
        event.dataTransfer.setData('text/plain', guest.id)
      }
      onClick={(event) => event.stopPropagation()}
      title={guest.fullName}
      className={cn(
        'group inline-flex max-w-[92px] cursor-grab items-center gap-1 rounded-full bg-[#9e3f3f] px-2 py-0.5 text-[11px] text-white',
        compact && 'max-w-[80px]',
      )}
    >
      <span className="truncate">{seatLabel(guest.fullName)}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Unassign ${guest.fullName}`}
          className="hidden shrink-0 rounded-full leading-none text-white/80 group-hover:inline hover:text-white print:hidden"
        >
          ×
        </button>
      )}
    </span>
  );
}

type SetupFormProps = {
  error: string | null;
  onError: (message: string | null) => void;
};

/**
 * Initial setup form shown when no seating tables exist yet. Collects the
 * total table count, seats per table, and head table options, then
 * generates the tables via a server action and reloads.
 *
 * @param props.error - Current error message to display, if any.
 * @param props.onError - Setter for the shared error message.
 * @returns The setup form.
 */
function SetupForm({ error, onError }: SetupFormProps) {
  const [tableCount, setTableCount] = useState(10);
  const [seatsPerTable, setSeatsPerTable] = useState(8);
  const [includeHeadTable, setIncludeHeadTable] = useState(true);
  const [headTableSeats, setHeadTableSeats] = useState(8);
  const [submitting, setSubmitting] = useState(false);

  /** Generate the initial tables and reload to pick up server state. */
  async function handleGenerate() {
    setSubmitting(true);
    onError(null);

    try {
      const result = await generateSeatingTables({
        tableCount,
        seatsPerTable,
        includeHeadTable,
        headTableSeats,
      });

      if (!result.success) {
        onError(result.error);

        return;
      }

      window.location.reload();
    } catch {
      onError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-lg bg-[#fffdfb] p-6 shadow-lg">
      <h2 className="mb-2 text-xl font-semibold text-[#9e3f3f]">
        Set Up Your Seating Chart
      </h2>
      <p className="mb-4 text-sm text-[#6a5555]">
        Choose how many tables you need and how many seats each has. You can
        rename tables, adjust capacities, and add or remove tables later.
      </p>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-4">
        <label className="text-sm font-medium text-gray-700">
          Total tables (including head table)
          <input
            type="number"
            min={1}
            max={50}
            value={tableCount}
            onChange={(event) => setTableCount(Number(event.target.value))}
            className={cn(INPUT_CLASS, 'mt-1 block w-full')}
          />
        </label>
        <label className="text-sm font-medium text-gray-700">
          Seats per table
          <input
            type="number"
            min={1}
            max={30}
            value={seatsPerTable}
            onChange={(event) => setSeatsPerTable(Number(event.target.value))}
            className={cn(INPUT_CLASS, 'mt-1 block w-full')}
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={includeHeadTable}
            onChange={(event) => setIncludeHeadTable(event.target.checked)}
          />
          Include a head table
        </label>
        {includeHeadTable && (
          <label className="text-sm font-medium text-gray-700">
            Head table seats
            <input
              type="number"
              min={1}
              max={30}
              value={headTableSeats}
              onChange={(event) =>
                setHeadTableSeats(Number(event.target.value))
              }
              className={cn(INPUT_CLASS, 'mt-1 block w-full')}
            />
          </label>
        )}
        <button
          type="button"
          disabled={submitting}
          onClick={() => void handleGenerate()}
          className={BUTTON_CLASS}
        >
          {submitting ? 'Creating…' : 'Create Tables'}
        </button>
      </div>
    </div>
  );
}

type AddTableButtonProps = {
  onError: (message: string | null) => void;
};

/**
 * Button plus inline mini-form for adding one more table to the chart.
 * Reloads the page after a successful add to pick up the server-assigned id.
 *
 * @param props.onError - Setter for the shared error message.
 * @returns The add-table control.
 */
function AddTableButton({ onError }: AddTableButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(8);
  const [submitting, setSubmitting] = useState(false);

  /** Create the table via the server action, then reload. */
  async function handleAdd() {
    setSubmitting(true);
    onError(null);

    try {
      const result = await addSeatingTable({ name, capacity });

      if (!result.success) {
        onError(result.error);

        return;
      }

      window.location.reload();
    } catch {
      onError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className={SECONDARY_BUTTON_CLASS}
        onClick={() => setOpen(true)}
      >
        + Add Table
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Table name"
        className={cn(INPUT_CLASS, 'w-32')}
      />
      <input
        type="number"
        min={1}
        max={30}
        value={capacity}
        onChange={(event) => setCapacity(Number(event.target.value))}
        className={cn(INPUT_CLASS, 'w-16')}
        aria-label="Seats"
      />
      <button
        type="button"
        disabled={submitting}
        onClick={() => void handleAdd()}
        className={BUTTON_CLASS}
      >
        {submitting ? 'Adding…' : 'Add'}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-sm text-[#7a6666] hover:underline"
      >
        Cancel
      </button>
    </span>
  );
}
