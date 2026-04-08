// @vitest-environment node

import { assert, describe, expect, test } from 'vitest';

import { eventAttendeeInputSchema } from './rsvp';

describe('eventAttendeeInputSchema', () => {
  describe('valid data', () => {
    test('should accept a complete attendee with meal option', () => {
      const result = eventAttendeeInputSchema.safeParse({
        name: 'Alice E2E',
        mealOption: 'option_a',
        dietaryRestrictions: null,
      });

      expect(result.success).toBe(true);
    });

    test('should accept mealOption as null for non-main events', () => {
      const result = eventAttendeeInputSchema.safeParse({
        name: 'Alice E2E',
        mealOption: null,
        dietaryRestrictions: null,
      });

      expect(result.success).toBe(true);
    });

    test('should accept mealOption as omitted for non-main events', () => {
      const result = eventAttendeeInputSchema.safeParse({
        name: 'Alice E2E',
        dietaryRestrictions: null,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('invalid data', () => {
    test('should reject missing name', () => {
      const result = eventAttendeeInputSchema.safeParse({
        mealOption: null,
        dietaryRestrictions: null,
      });

      expect(result.success).toBe(false);
    });

    test('should reject empty name', () => {
      const result = eventAttendeeInputSchema.safeParse({
        name: '',
        mealOption: null,
        dietaryRestrictions: null,
      });

      expect(result.success).toBe(false);
      assert(!result.success);
      expect(result.error.issues[0].message).toBe('Attendee name is required');
    });

    test('should reject invalid mealOption value', () => {
      const result = eventAttendeeInputSchema.safeParse({
        name: 'Alice E2E',
        mealOption: 'option_c',
        dietaryRestrictions: null,
      });

      expect(result.success).toBe(false);
    });
  });
});
