// @vitest-environment node

import { assert, describe, expect, test } from 'vitest';

import { eventAttendeeInputSchema, setPartyEventRsvpSchema } from './rsvp';

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

describe('setPartyEventRsvpSchema', () => {
  const valid = {
    eventId: 'event-1',
    guestId: 'guest-1',
    expectedUpdatedAt: null,
    statuses: [
      { guestId: 'guest-1', attending: true },
      { guestId: 'guest-2', attending: false },
    ],
  };

  test('should accept a full party status list', () => {
    const result = setPartyEventRsvpSchema.safeParse(valid);

    expect(result.success).toBe(true);
  });

  test('should reject an empty status list', () => {
    const result = setPartyEventRsvpSchema.safeParse({
      ...valid,
      statuses: [],
    });

    expect(result.success).toBe(false);
    assert(!result.success);
    expect(result.error.issues[0].message).toBe(
      'At least one party member is required',
    );
  });

  test('should reject a missing event id', () => {
    const result = setPartyEventRsvpSchema.safeParse({ ...valid, eventId: '' });

    expect(result.success).toBe(false);
    assert(!result.success);
    expect(result.error.issues[0].message).toBe('Event ID is required');
  });

  test('should reject a missing guest id', () => {
    const result = setPartyEventRsvpSchema.safeParse({ ...valid, guestId: '' });

    expect(result.success).toBe(false);
    assert(!result.success);
    expect(result.error.issues[0].message).toBe('Guest ID is required');
  });

  test('should accept a party timestamp when the party has responded', () => {
    const result = setPartyEventRsvpSchema.safeParse({
      ...valid,
      expectedUpdatedAt: '2026-07-01T00:00:00.000Z',
    });

    expect(result.success).toBe(true);
  });

  test('should reject a missing party timestamp', () => {
    const { expectedUpdatedAt: _omitted, ...withoutToken } = valid;
    const result = setPartyEventRsvpSchema.safeParse(withoutToken);

    expect(result.success).toBe(false);
  });

  test('should reject a non-boolean attending flag', () => {
    const result = setPartyEventRsvpSchema.safeParse({
      ...valid,
      statuses: [{ guestId: 'guest-1', attending: 'yes' }],
    });

    expect(result.success).toBe(false);
  });
});
