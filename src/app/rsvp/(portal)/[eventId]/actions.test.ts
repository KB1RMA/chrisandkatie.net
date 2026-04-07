/**
 * @vitest-environment node
 */

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/rsvp', () => ({
  isDeadlinePassed: vi.fn().mockReturnValue(false),
  validateAttendeeAgainstInvitation: vi.fn().mockReturnValue([]),
}));

import { expect, test, describe, beforeEach, vi } from 'vitest';
import { makeSession } from '@/tests/helpers';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import type { DbClient } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { retrieveEventRsvp } from './actions';

const mockAuth = vi.mocked(auth);
const mockGetDb = vi.mocked(getDb);

describe('retrieveEventRsvp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Creates a minimal WeddingEvent fixture.
   *
   * @param id - Event identifier.
   * @param rsvpRequired - Whether RSVP is required for this event.
   * @returns Minimal WeddingEvent object.
   */
  function makeEvent(
    id: string,
    rsvpRequired: boolean,
  ): typeof events.$inferSelect {
    return {
      id,
      name: 'Test Event',
      description: null,
      location: null,
      eventDate: '2026-09-12',
      startTime: '10:00',
      endTime: '11:00',
      type: 'other' as const,
      dressCode: null,
      parkingInfo: null,
      locationLat: null,
      locationLng: null,
      sortOrder: 0,
      rsvpRequired,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Creates a mock DB for retrieveEventRsvp tests.
   *
   * @param guestEventRows - Rows returned by guestEvents.findMany.
   * @param event - The event returned by events.findFirst (or null).
   * @returns Partial DbClient with all required methods mocked.
   */
  function createMockDb(
    guestEventRows: Array<{ guest: { id: string; invitationId: string } }>,
    event: typeof events.$inferSelect | null,
  ): DbClient {
    return {
      query: {
        guestEvents: {
          findMany: vi.fn().mockResolvedValue(guestEventRows),
        },
        events: {
          findFirst: vi.fn().mockResolvedValue(event),
        },
        rsvpResponses: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        attendees: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        guests: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    } as unknown as DbClient;
  }

  test('should throw "Not invited to this event" when event.rsvpRequired is false', async () => {
    const invitationId = 'invite-1';

    mockAuth.mockResolvedValue(makeSession({ invitationId }));

    const mockDb = createMockDb(
      [{ guest: { id: 'guest-1', invitationId } }],
      makeEvent('event-1', false),
    );

    mockGetDb.mockReturnValue(mockDb);

    await expect(retrieveEventRsvp('event-1')).rejects.toThrow(
      'Not invited to this event',
    );
  });
});
