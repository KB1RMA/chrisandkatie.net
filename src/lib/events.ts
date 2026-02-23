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
