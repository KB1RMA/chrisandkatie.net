type AttendanceStatus = 'attending' | 'not_attending' | 'no_response';

type EventRsvpRow = {
  guestName: string;
  attendanceStatus: AttendanceStatus;
};

type Props = {
  rows: EventRsvpRow[];
};

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  attending: 'Attending',
  not_attending: 'Not Attending',
  no_response: 'Pending',
};

const STATUS_BADGE_CLASSES: Record<AttendanceStatus, string> = {
  attending: 'bg-green-100 text-green-800',
  not_attending: 'bg-red-100 text-red-800',
  no_response: 'bg-yellow-100 text-yellow-800',
};

/**
 * Renders the complete guest list for a single event sorted by RSVP status.
 *
 * Attending guests are shown first, followed by not attending, then pending
 * (no response). Each row displays the guest name and their status badge.
 *
 * @param props - rows array with guestName and attendanceStatus per guest.
 * @returns A table of guests and their individual RSVP statuses.
 */
export function EventRsvpTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg bg-[#fffdfb] p-6 text-center text-[#7a6666] shadow">
        No guests are invited to this event.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg shadow">
      <table className="w-full border-collapse bg-[#fffdfb] text-sm">
        <thead>
          <tr className="border-b border-[#e5d5d5] bg-[#fff3ef]">
            <th className="px-4 py-3 text-left font-semibold text-[#9e3f3f]">
              Guest
            </th>
            <th className="px-4 py-3 text-left font-semibold text-[#9e3f3f]">
              RSVP Status
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              className="border-b border-[#f0e4e4] last:border-0 hover:bg-[#fff7f4]"
            >
              <td className="px-4 py-3 text-[#6a5555]">{row.guestName}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASSES[row.attendanceStatus]}`}
                >
                  {STATUS_LABELS[row.attendanceStatus]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
