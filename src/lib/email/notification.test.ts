/**
 * @vitest-environment node
 */

import { expect, test, describe } from 'vitest';
import {
  buildNotificationPayload,
  type RsvpNotificationPayload,
} from './notification';
import type { EventRsvpResponse } from '@/lib/schemas/rsvp';

/**
 * Creates a minimal EventRsvpResponse fixture.
 */
function makeRsvpResponse(
  overrides: Partial<EventRsvpResponse> = {},
): EventRsvpResponse {
  return {
    id: 'rsvp-1',
    guestId: 'guest-1',
    eventId: 'event-1',
    eventName: 'Wedding Reception',
    eventType: 'main',
    attendanceStatus: 'attending',
    numberOfAttending: 2,
    specialRequests: null,
    attendees: [
      {
        id: 'att-1',
        name: 'Chris Smith',
        mealOption: 'option_a',
        dietaryRestrictions: null,
        sortOrder: 0,
      },
      {
        id: 'att-2',
        name: 'Katie Jones',
        mealOption: 'option_b',
        dietaryRestrictions: 'Vegetarian',
        sortOrder: 1,
      },
    ],
    submittedAt: '2026-09-12T10:00:00.000Z',
    updatedAt: '2026-09-12T10:00:00.000Z',
    ...overrides,
  };
}

describe('buildNotificationPayload', () => {
  test('should build a new RSVP payload when isUpdate is false', () => {
    const rsvp = makeRsvpResponse();
    const result = buildNotificationPayload(rsvp, 'Chris Smith', false);

    const expected: RsvpNotificationPayload = {
      isUpdate: false,
      guestName: 'Chris Smith',
      eventName: 'Wedding Reception',
      attendanceStatus: 'attending',
      numberOfAttending: 2,
      specialRequests: null,
      attendees: [
        {
          name: 'Chris Smith',
          mealOption: 'option_a',
          dietaryRestrictions: null,
        },
        {
          name: 'Katie Jones',
          mealOption: 'option_b',
          dietaryRestrictions: 'Vegetarian',
        },
      ],
    };

    expect(result).toEqual(expected);
  });

  test('should build an update payload when isUpdate is true', () => {
    const rsvp = makeRsvpResponse({
      attendanceStatus: 'not_attending',
      numberOfAttending: 0,
      attendees: [],
    });
    const result = buildNotificationPayload(rsvp, 'Chris Smith', true);

    expect(result.isUpdate).toBe(true);
    expect(result.attendanceStatus).toBe('not_attending');
    expect(result.numberOfAttending).toBe(0);
    expect(result.attendees).toHaveLength(0);
  });

  test('should map null attendee optionals as null', () => {
    const rsvp = makeRsvpResponse({
      attendees: [
        {
          id: 'att-1',
          name: 'Chris Smith',
          mealOption: 'option_a',
          dietaryRestrictions: null,
          sortOrder: 0,
        },
      ],
    });

    const result = buildNotificationPayload(rsvp, 'Chris Smith', false);

    expect(result.attendees[0].dietaryRestrictions).toBeNull();
  });

  test('should include specialRequests when present', () => {
    const rsvp = makeRsvpResponse({
      specialRequests: 'Please seat near the window',
    });
    const result = buildNotificationPayload(rsvp, 'Chris Smith', false);

    expect(result.specialRequests).toBe('Please seat near the window');
  });

  test('should have null specialRequests when not provided', () => {
    const rsvp = makeRsvpResponse({ specialRequests: null });
    const result = buildNotificationPayload(rsvp, 'Chris Smith', false);

    expect(result.specialRequests).toBeNull();
  });
});
