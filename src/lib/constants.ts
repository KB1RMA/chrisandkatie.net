import { format } from 'date-fns';

export const WEDDING_DATE = new Date('2026-09-12T16:00:00');

/**
 * RSVP deadline: June 15, 2026 at 11:59 PM UTC.
 * Guests cannot modify their RSVP after this date.
 */
export const RSVP_DEADLINE = new Date('2026-06-15T23:59:59Z');

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
  SHORT_RIB: 'short-rib',
  ROASTED_CHICKEN: 'roasted-chicken',
  PASTA_PRIMAVERA: 'pasta-primavera',
} as const;

export const MEAL_CHOICE_LABELS: Record<
  (typeof MEAL_OPTIONS)[keyof typeof MEAL_OPTIONS],
  string
> = {
  [MEAL_OPTIONS.SHORT_RIB]: 'Short Rib',
  [MEAL_OPTIONS.ROASTED_CHICKEN]: 'Roasted Chicken',
  [MEAL_OPTIONS.PASTA_PRIMAVERA]: 'Pasta Primavera (Vegetarian)',
};

export const MEAL_CHOICE_DESCRIPTIONS: Record<
  (typeof MEAL_OPTIONS)[keyof typeof MEAL_OPTIONS],
  string
> = {
  [MEAL_OPTIONS.SHORT_RIB]:
    'Slow-braised beef short rib in a rich red wine reduction, served with creamy mashed potatoes and roasted seasonal vegetables.',
  [MEAL_OPTIONS.ROASTED_CHICKEN]:
    'Herb-roasted airline chicken breast with a golden pan sauce, served over fragrant coconut rice with sautéed broccolini.',
  [MEAL_OPTIONS.PASTA_PRIMAVERA]:
    'Housemade pappardelle tossed with garden-fresh spring vegetables, cherry tomatoes, and a light lemon-herb olive oil.',
};

export type MealOption = (typeof MEAL_OPTIONS)[keyof typeof MEAL_OPTIONS];

/**
 * Meal options for event-specific RSVPs (option A / option B catering format).
 */
export const EVENT_MEAL_OPTIONS = {
  OPTION_A: 'option_a',
  OPTION_B: 'option_b',
} as const;

export const EVENT_MEAL_OPTION_LABELS: Record<
  (typeof EVENT_MEAL_OPTIONS)[keyof typeof EVENT_MEAL_OPTIONS],
  string
> = {
  [EVENT_MEAL_OPTIONS.OPTION_A]: 'Option A',
  [EVENT_MEAL_OPTIONS.OPTION_B]: 'Option B',
};

export type EventMealOption =
  (typeof EVENT_MEAL_OPTIONS)[keyof typeof EVENT_MEAL_OPTIONS];

/**
 * Human-readable label for the RSVP deadline.
 */
export const RSVP_DEADLINE_DISPLAY = 'June 15, 2026 at 11:59 PM';
