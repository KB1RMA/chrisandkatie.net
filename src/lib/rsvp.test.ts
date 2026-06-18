import { describe, expect, test } from 'vitest';
import {
  reconstructEventRsvpStatuses,
  type EventResponseInput,
  type InvitedGuestInput,
} from '@/lib/rsvp';

const guest = (
  guestId: string,
  firstName: string,
  lastName: string,
  invitationId: string,
): InvitedGuestInput => ({ guestId, firstName, lastName, invitationId });

const statusFor = (
  result: ReturnType<typeof reconstructEventRsvpStatuses>,
  guestId: string,
) => result.statuses.find((s) => s.guestId === guestId)?.status;

describe('reconstructEventRsvpStatuses', () => {
  test('should mark named attending attendees as attending', () => {
    const invitedGuests = [
      guest('g1', 'John', 'Smith', 'inv1'),
      guest('g2', 'Jane', 'Smith', 'inv1'),
    ];
    const responses: EventResponseInput[] = [
      {
        invitationId: 'inv1',
        attendanceStatus: 'attending',
        attendeeNames: ['John Smith', 'Jane Smith'],
      },
    ];

    const result = reconstructEventRsvpStatuses(invitedGuests, responses);

    expect(statusFor(result, 'g1')).toBe('attending');
    expect(statusFor(result, 'g2')).toBe('attending');
    expect(result.summary).toEqual({
      attending: 2,
      notAttending: 0,
      noResponse: 0,
      total: 2,
    });
  });

  test('should match attendee names case- and whitespace-insensitively', () => {
    const invitedGuests = [guest('g1', 'John', 'Smith', 'inv1')];
    const responses: EventResponseInput[] = [
      {
        invitationId: 'inv1',
        attendanceStatus: 'attending',
        attendeeNames: ['  john smith '],
      },
    ];

    const result = reconstructEventRsvpStatuses(invitedGuests, responses);

    expect(statusFor(result, 'g1')).toBe('attending');
  });

  test('should mark a party member omitted from an attending response as not_attending', () => {
    const invitedGuests = [
      guest('g1', 'John', 'Smith', 'inv1'),
      guest('g2', 'Jane', 'Smith', 'inv1'),
    ];
    const responses: EventResponseInput[] = [
      {
        invitationId: 'inv1',
        attendanceStatus: 'attending',
        attendeeNames: ['John Smith'],
      },
    ];

    const result = reconstructEventRsvpStatuses(invitedGuests, responses);

    expect(statusFor(result, 'g1')).toBe('attending');
    expect(statusFor(result, 'g2')).toBe('not_attending');
    expect(result.summary).toEqual({
      attending: 1,
      notAttending: 1,
      noResponse: 0,
      total: 2,
    });
  });

  test('should mark the whole invited party as not_attending on a party-level decline', () => {
    const invitedGuests = [
      guest('g1', 'John', 'Smith', 'inv1'),
      guest('g2', 'Jane', 'Smith', 'inv1'),
    ];
    const responses: EventResponseInput[] = [
      {
        invitationId: 'inv1',
        attendanceStatus: 'not_attending',
        attendeeNames: [],
      },
    ];

    const result = reconstructEventRsvpStatuses(invitedGuests, responses);

    expect(statusFor(result, 'g1')).toBe('not_attending');
    expect(statusFor(result, 'g2')).toBe('not_attending');
  });

  test('should mark a party with no response as no_response', () => {
    const invitedGuests = [
      guest('g1', 'John', 'Smith', 'inv1'),
      guest('g2', 'Jane', 'Smith', 'inv1'),
    ];

    const result = reconstructEventRsvpStatuses(invitedGuests, []);

    expect(statusFor(result, 'g1')).toBe('no_response');
    expect(statusFor(result, 'g2')).toBe('no_response');
    expect(result.summary).toEqual({
      attending: 0,
      notAttending: 0,
      noResponse: 2,
      total: 2,
    });
  });

  test('should combine multiple responses within the same party', () => {
    const invitedGuests = [
      guest('g1', 'John', 'Smith', 'inv1'),
      guest('g2', 'Jane', 'Smith', 'inv1'),
      guest('g3', 'Kid', 'Smith', 'inv1'),
    ];
    const responses: EventResponseInput[] = [
      {
        invitationId: 'inv1',
        attendanceStatus: 'attending',
        attendeeNames: ['John Smith'],
      },
      {
        invitationId: 'inv1',
        attendanceStatus: 'attending',
        attendeeNames: ['Jane Smith'],
      },
    ];

    const result = reconstructEventRsvpStatuses(invitedGuests, responses);

    expect(statusFor(result, 'g1')).toBe('attending');
    expect(statusFor(result, 'g2')).toBe('attending');
    expect(statusFor(result, 'g3')).toBe('not_attending');
  });

  test('should scope name matching to each guest party', () => {
    const invitedGuests = [
      guest('g1', 'John', 'Smith', 'inv1'),
      guest('g2', 'John', 'Smith', 'inv2'),
    ];
    const responses: EventResponseInput[] = [
      {
        invitationId: 'inv1',
        attendanceStatus: 'attending',
        attendeeNames: ['John Smith'],
      },
    ];

    const result = reconstructEventRsvpStatuses(invitedGuests, responses);

    expect(statusFor(result, 'g1')).toBe('attending');
    expect(statusFor(result, 'g2')).toBe('no_response');
  });
});
