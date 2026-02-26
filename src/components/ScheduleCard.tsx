/**
 * ScheduleCard component for displaying a single schedule event.
 *
 * Shows event timing, location, and details. Highlights the currently
 * happening event with a special "HAPPENING NOW" badge and gold border.
 */
import type { ScheduleItem } from '@/lib/events';

type ScheduleCardProps = {
  item: ScheduleItem;
  isCurrentEvent?: boolean;
};

/**
 * Card displaying a single event in the wedding schedule.
 *
 * @param item - The schedule event to display.
 * @param isCurrentEvent - Whether this event is currently happening.
 */
export function ScheduleCard({
  item,
  isCurrentEvent = false,
}: ScheduleCardProps) {
  return (
    <div
      className={`rounded-lg p-8 shadow-lg transition-shadow duration-200 hover:shadow-xl ${
        isCurrentEvent
          ? 'border-2 border-[#c4a44a] bg-[#fdfaf0]'
          : 'bg-[#fffdfb]'
      }`}
    >
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold text-[#9e3f3f]">{item.event}</h2>
            {isCurrentEvent && (
              <span className="rounded-full bg-[#c4a44a] px-3 py-0.5 text-xs font-bold tracking-wide text-white uppercase">
                Happening Now
              </span>
            )}
          </div>
          <p className="text-[#7a6666]">
            {item.date} &bull; {item.day}
          </p>
        </div>

        <div className="text-right">
          <p className="text-3xl font-bold text-[#9e3f3f]">
            {item.endTime ? `${item.time} - ${item.endTime}` : item.time}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="font-medium text-gray-700">{item.location}</p>
        <p className="text-gray-600">{item.description}</p>
      </div>
    </div>
  );
}
