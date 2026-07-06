'use client';

import { useRouter } from 'next/navigation';

export type SeatingEventOption = {
  id: string;
  name: string;
};

type SeatingEventSelectorProps = {
  events: SeatingEventOption[];
  selectedEventId: string;
};

/**
 * Dropdown for switching which event's seating chart is shown. Changing
 * the selection navigates to the same page with the chosen event id.
 *
 * @param props.events - Selectable events (id and display name).
 * @param props.selectedEventId - The currently displayed event's id.
 * @returns The event selector control.
 */
export function SeatingEventSelector({
  events,
  selectedEventId,
}: SeatingEventSelectorProps) {
  const router = useRouter();

  return (
    <label className="flex items-center justify-center gap-2 text-sm font-medium text-[#6a5555]">
      Event
      <select
        value={selectedEventId}
        onChange={(event) =>
          router.push(`/admin/seating?eventId=${event.target.value}`)
        }
        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-[#4a3a3a] focus:border-[#9e3f3f] focus:ring-1 focus:ring-[#9e3f3f] focus:outline-none"
      >
        {events.map((eventOption) => (
          <option key={eventOption.id} value={eventOption.id}>
            {eventOption.name}
          </option>
        ))}
      </select>
    </label>
  );
}
