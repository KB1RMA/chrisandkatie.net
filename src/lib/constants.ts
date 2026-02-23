import { format } from 'date-fns';

export const WEDDING_DATE = new Date('2026-09-12T16:00:00');

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

/**
 * Meal options for RSVP
 */
export const MEAL_OPTIONS = {
  PRIME_RIB: 'prime-rib',
  CHICKEN: 'chicken',
  VEGETARIAN: 'vegetarian',
} as const;

export const MEAL_CHOICE_LABELS: Record<
  (typeof MEAL_OPTIONS)[keyof typeof MEAL_OPTIONS],
  string
> = {
  [MEAL_OPTIONS.PRIME_RIB]: 'Prime Rib',
  [MEAL_OPTIONS.CHICKEN]: 'Chicken',
  [MEAL_OPTIONS.VEGETARIAN]: 'Vegetarian',
};

export type MealOption = (typeof MEAL_OPTIONS)[keyof typeof MEAL_OPTIONS];
