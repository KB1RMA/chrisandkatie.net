import { format } from 'date-fns';

export const WEDDING_DATE = new Date('2026-09-12T17:00:00');

// ISO date format (YYYY-MM-DD)
export const WEDDING_DATE_ISO = format(WEDDING_DATE, 'yyyy-MM-dd');

// Display time in 12-hour format
export const WEDDING_TIME = format(WEDDING_DATE, 'h:mm a');

// Display date with ordinal (September 12th, 2026)
export const WEDDING_DATE_DISPLAY = format(WEDDING_DATE, 'MMMM do, yyyy');

// Full display text
export const WEDDING_DISPLAY_TEXT = format(
  WEDDING_DATE,
  'MMMM do, yyyy @ h:mm a',
);
