import { describe, expect, test } from 'vitest';
import {
  buildPartyEventRsvpWrite,
  reconstructEventRsvpStatuses,
  type EventResponseInput,
  type InvitedGuestInput,
  type PartyMemberInput,
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

describe('buildPartyEventRsvpWrite', () => {
  const member = (
    guestId: string,
    firstName: string,
    lastName: string,
  ): PartyMemberInput => ({ guestId, firstName, lastName });

  test('should mark the party attending and list every selected member', () => {
    const result = buildPartyEventRsvpWrite({
      members: [member('g1', 'John', 'Smith'), member('g2', 'Jane', 'Smith')],
      attendingGuestIds: ['g1', 'g2'],
      existingAttendees: [],
    });

    expect(result.attendanceStatus).toBe('attending');
    expect(result.numberOfAttending).toBe(2);
    expect(result.attendees.map((a) => a.name)).toEqual([
      'John Smith',
      'Jane Smith',
    ]);
  });

  test('should mark the party not attending with zero attendees when nobody is selected', () => {
    const result = buildPartyEventRsvpWrite({
      members: [member('g1', 'John', 'Smith'), member('g2', 'Jane', 'Smith')],
      attendingGuestIds: [],
      existingAttendees: [],
    });

    expect(result.attendanceStatus).toBe('not_attending');
    expect(result.numberOfAttending).toBe(0);
    expect(result.attendees).toEqual([]);
  });

  test('should keep the party attending when only some members are selected', () => {
    const result = buildPartyEventRsvpWrite({
      members: [
        member('g1', 'John', 'Smith'),
        member('g2', 'Jane', 'Smith'),
        member('g3', 'Kid', 'Smith'),
      ],
      attendingGuestIds: ['g2'],
      existingAttendees: [],
    });

    expect(result.attendanceStatus).toBe('attending');
    expect(result.numberOfAttending).toBe(1);
    expect(result.attendees.map((a) => a.name)).toEqual(['Jane Smith']);
  });

  test('should carry over meal and dietary details for a retained attendee', () => {
    const result = buildPartyEventRsvpWrite({
      members: [member('g1', 'John', 'Smith'), member('g2', 'Jane', 'Smith')],
      attendingGuestIds: ['g1'],
      existingAttendees: [
        {
          name: 'John Smith',
          mealOption: 'option_b',
          dietaryRestrictions: 'No shellfish',
        },
        {
          name: 'Jane Smith',
          mealOption: 'option_a',
          dietaryRestrictions: null,
        },
      ],
    });

    expect(result.attendees).toEqual([
      {
        name: 'John Smith',
        mealOption: 'option_b',
        dietaryRestrictions: 'No shellfish',
        sortOrder: 0,
      },
    ]);
  });

  test('should match existing attendee details ignoring case and extra whitespace', () => {
    const result = buildPartyEventRsvpWrite({
      members: [member('g1', 'John', 'Smith')],
      attendingGuestIds: ['g1'],
      existingAttendees: [
        {
          name: '  john   SMITH ',
          mealOption: 'option_a',
          dietaryRestrictions: 'Vegan',
        },
      ],
    });

    expect(result.attendees[0]?.mealOption).toBe('option_a');
    expect(result.attendees[0]?.dietaryRestrictions).toBe('Vegan');
  });

  test('should give a newly added attendee no meal option', () => {
    const result = buildPartyEventRsvpWrite({
      members: [member('g1', 'John', 'Smith'), member('g2', 'Jane', 'Smith')],
      attendingGuestIds: ['g1', 'g2'],
      existingAttendees: [
        {
          name: 'John Smith',
          mealOption: 'option_a',
          dietaryRestrictions: null,
        },
      ],
    });

    expect(result.attendees[1]).toEqual({
      name: 'Jane Smith',
      mealOption: null,
      dietaryRestrictions: null,
      sortOrder: 1,
    });
  });

  test('should number sortOrder sequentially from zero', () => {
    const result = buildPartyEventRsvpWrite({
      members: [
        member('g1', 'John', 'Smith'),
        member('g2', 'Jane', 'Smith'),
        member('g3', 'Kid', 'Smith'),
      ],
      attendingGuestIds: ['g1', 'g3'],
      existingAttendees: [],
    });

    expect(result.attendees.map((a) => a.sortOrder)).toEqual([0, 1]);
  });

  test('should ignore selected ids that are not party members', () => {
    const result = buildPartyEventRsvpWrite({
      members: [member('g1', 'John', 'Smith')],
      attendingGuestIds: ['g1', 'outsider'],
      existingAttendees: [],
    });

    expect(result.numberOfAttending).toBe(1);
    expect(result.attendees.map((a) => a.name)).toEqual(['John Smith']);
  });
});
