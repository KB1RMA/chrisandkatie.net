import type { WeddingEvent } from '@/lib/db/schema';

/**
 * Format an ISO 8601 date as "Month DD • Weekday".
 *
 * @param isoDate - Date string in "YYYY-MM-DD" format.
 * @returns Formatted string, e.g. "September 10 • Thursday".
 */
export function formatEventDate(isoDate: string): string {
  // Use noon UTC to avoid timezone-related day shifts
  const date = new Date(`${isoDate}T12:00:00`);
  const month = date.toLocaleString('en-US', { month: 'long' });
  const day = date.getDate();
  const weekday = date.toLocaleString('en-US', { weekday: 'long' });

  return `${month} ${day} \u2022 ${weekday}`;
}

/**
 * Format a 24-hour "HH:MM" time string as "H:MM AM/PM".
 *
 * @param time - Time string in "HH:MM" format.
 * @returns Formatted string, e.g. "6:00 PM".
 */
export function formatEventTime(time: string): string {
  const [hoursStr, minutesStr] = time.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  const displayMinutes = String(minutes).padStart(2, '0');

  return `${displayHour}:${displayMinutes} ${period}`;
}

/**
 * Determine whether a WeddingEvent is currently in progress.
 *
 * @param event - Database event record.
 * @param now - Current date/time, defaults to new Date().
 * @returns True if current time falls between startTime and endTime on eventDate.
 */
export function isCurrentEvent(
  event: WeddingEvent,
  now: Date = new Date(),
): boolean {
  const startDateTime = new Date(`${event.eventDate}T${event.startTime}:00`);
  const endDateTime = new Date(`${event.eventDate}T${event.endTime}:00`);

  if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
    return false;
  }

  return now >= startDateTime && now <= endDateTime;
}
