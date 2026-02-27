import {
  EventSummaryCard,
  type EventSummaryCardProps,
} from '@/components/admin/EventSummaryCard';

export type MealBreakdownItem = {
  mealOption: 'option_a' | 'option_b';
  count: number;
};

export type RsvpDashboardProps = {
  eventSummaries: EventSummaryCardProps[];
  mealBreakdown: MealBreakdownItem[];
};

const MEAL_OPTION_LABELS: Record<string, string> = {
  option_a: 'Option A',
  option_b: 'Option B',
};

/**
 * Checks whether all RSVP counts across all events are zero.
 *
 * @param summaries - List of event summary objects.
 * @returns True if all attending, notAttending, and noResponse counts are zero.
 */
function hasNoRsvps(summaries: EventSummaryCardProps[]): boolean {
  return summaries.every(
    (s) => s.attending === 0 && s.notAttending === 0 && s.noResponse === 0,
  );
}

/**
 * RSVP summary dashboard showing per-event headcounts and meal breakdowns.
 *
 * @param props - Event summaries and meal breakdown data.
 * @returns Dashboard with event cards and a meal option breakdown section.
 * @throws {Error} Does not throw.
 */
export function RsvpDashboard({
  eventSummaries,
  mealBreakdown,
}: RsvpDashboardProps) {
  if (hasNoRsvps(eventSummaries)) {
    return (
      <div className="rounded-lg bg-[#fffdfb] p-8 text-center shadow">
        <p className="text-lg text-[#7a6666]">No RSVPs received yet.</p>
        <p className="mt-2 text-sm text-[#9a8888]">
          Headcounts will appear here once guests begin submitting their RSVPs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Per-event summary cards */}
      <section>
        <h2 className="mb-4 text-xl font-semibold text-[#9e3f3f]">
          Event Headcounts
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {eventSummaries.map((summary) => (
            <EventSummaryCard key={summary.eventId} {...summary} />
          ))}
        </div>
      </section>

      {/* Meal breakdown section */}
      {mealBreakdown.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-semibold text-[#9e3f3f]">
            Meal Preferences
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {mealBreakdown.map((item) => (
              <div
                key={item.mealOption}
                className="rounded-lg border-l-4 border-[#b76565] bg-[#fffdfb] p-4 shadow"
              >
                <p className="text-sm font-medium text-[#7a6666]">
                  {MEAL_OPTION_LABELS[item.mealOption] ?? item.mealOption}
                </p>
                <p className="text-2xl font-bold text-[#9e3f3f]">
                  {item.count}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
