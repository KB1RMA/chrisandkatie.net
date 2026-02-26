/**
 * Event configuration and schedule item types.
 *
 * Defines the available celebration events and their metadata.
 */
export interface ScheduleItem {
  id: number;
  date: string;
  day: string;
  time: string;
  endTime?: string;
  event: string;
  location: string;
  description: string;
}

/**
 * All celebration events in chronological order.
 *
 * Used by schedule page and admin event visibility controls.
 */
export const SCHEDULE_EVENTS: ScheduleItem[] = [
  {
    id: 0,
    date: 'September 10',
    day: 'Thursday',
    time: '6:00 PM',
    event: 'Barbecue',
    location: "Dad's House",
    description: 'Casual outdoor gathering with appetizers and refreshments.',
  },
  {
    id: 1,
    date: 'September 11',
    day: 'Friday',
    time: '6:00 PM',
    event: 'Barbecue',
    location: "Chris & Katie's House",
    description:
      'Final gathering with close friends and family before the celebration weekend.',
  },
  {
    id: 2,
    date: 'September 12',
    day: 'Saturday',
    time: '4:00 PM',
    event: 'Cocktail Hour',
    location: 'The Venue',
    description:
      'Pre-celebration gathering with drinks, appetizers, and mingling.',
  },
  {
    id: 3,
    date: 'September 12',
    day: 'Saturday',
    time: '5:00 PM',
    endTime: '10:00 PM',
    event: 'Marriage Celebration',
    location: 'The Venue',
    description:
      'Join us for dinner, dancing, and a celebration of our marriage!',
  },
];

/**
 * Determine if a scheduled event is currently happening.
 *
 * An event is "current" if `now` falls between the event's start time and
 * its calculated end time (start + duration). If no duration is provided,
 * a default of 60 minutes is assumed.
 *
 * @param event - The schedule item to evaluate.
 * @param now - Current date/time (defaults to new Date()).
 * @returns True if the event is currently happening.
 */
export function isCurrentEvent(
  event: ScheduleItem,
  now: Date = new Date(),
): boolean {
  // Parse the date and time into a start Date
  const year = now.getFullYear();
  const dateStr = `${year} ${event.date} ${event.time}`;
  const startTime = new Date(dateStr);

  if (isNaN(startTime.getTime())) {
    return false;
  }

  // Parse end time if provided, otherwise default to 60 minutes
  let endTime: Date;

  if (event.endTime) {
    endTime = new Date(`${year} ${event.date} ${event.endTime}`);
  } else {
    endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
  }

  return now >= startTime && now <= endTime;
}

/**
 * Find the currently active event from a list of schedule items.
 *
 * @param events - Array of schedule items to check.
 * @param now - Current date/time (defaults to new Date()).
 * @returns The active ScheduleItem, or null if no event is currently happening.
 */
export function getCurrentEvent(
  events: ScheduleItem[],
  now: Date = new Date(),
): ScheduleItem | null {
  return events.find((event) => isCurrentEvent(event, now)) ?? null;
}
