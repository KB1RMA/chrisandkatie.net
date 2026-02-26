type RsvpSummaryProps = {
  summary: {
    attending: number;
    notAttending: number;
    noResponse: number;
    total: number;
  };
};

/**
 * Displays RSVP summary counts for a specific event.
 *
 * @param props - Component props.
 * @param props.summary - RSVP counts broken down by response type.
 * @returns A summary of attending, not attending, and no response counts, or an empty state message.
 */
export default function RsvpSummary({ summary }: RsvpSummaryProps) {
  const isEmpty =
    summary.attending === 0 &&
    summary.notAttending === 0 &&
    summary.noResponse === 0;

  if (isEmpty) {
    return (
      <p className="text-sm text-gray-400 italic">
        No RSVPs received for this event yet
      </p>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="rounded-md bg-green-50 px-3 py-2 text-center">
        <p className="text-2xl font-bold text-green-700">{summary.attending}</p>
        <p className="mt-1 text-xs text-gray-500">Attending</p>
      </div>
      <div className="rounded-md bg-red-50 px-3 py-2 text-center">
        <p className="text-2xl font-bold text-red-700">
          {summary.notAttending}
        </p>
        <p className="mt-1 text-xs text-gray-500">Not Attending</p>
      </div>
      <div className="rounded-md bg-gray-50 px-3 py-2 text-center">
        <p className="text-2xl font-bold text-gray-600">{summary.noResponse}</p>
        <p className="mt-1 text-xs text-gray-500">No Response</p>
      </div>
    </div>
  );
}
