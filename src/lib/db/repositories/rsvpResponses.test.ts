/**
 * @vitest-environment node
 */

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

import { expect, test, describe, beforeEach, vi } from 'vitest';
import { getDb } from '@/lib/db';
import type { DbClient } from '@/lib/db';
import {
  findEventRsvpRowsForExport,
  findMealBreakdownForEvent,
} from './rsvpResponses';

const mockGetDb = vi.mocked(getDb);

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

/**
 * Creates a mock Drizzle database whose select builder chain resolves to the
 * given rows. Every chain method returns the same chain object so any join /
 * where / ordering combination can be exercised; the terminal `orderBy` and
 * `groupBy` calls resolve with `rows`.
 *
 * @param rows - The rows the query chain should resolve with.
 * @returns The mock DbClient plus the chain spies for assertions.
 */
function createSelectChainDb(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn().mockResolvedValue(rows),
    groupBy: vi.fn().mockResolvedValue(rows),
  };

  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.leftJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);

  const selectFn = vi.fn().mockReturnValue(chain);
  const db = { select: selectFn } as unknown as DbClient;

  return { db, selectFn, chain };
}

/**
 * Creates a mock Drizzle database whose `query.guestEvents.findMany` and
 * `query.rsvpResponses.findMany` resolve with the given rows, matching the
 * shape `getEventRsvpReconstruction` (and therefore `findEventRsvpRowsForExport`)
 * queries against.
 *
 * @param invitedGuestRows - Rows resolved by `query.guestEvents.findMany`.
 * @param responseRows - Rows resolved by `query.rsvpResponses.findMany`.
 * @returns The mock DbClient.
 */
function createReconstructionDb(
  invitedGuestRows: unknown[],
  responseRows: unknown[],
) {
  const db = {
    query: {
      guestEvents: {
        findMany: vi.fn().mockResolvedValue(invitedGuestRows),
      },
      rsvpResponses: {
        findMany: vi.fn().mockResolvedValue(responseRows),
      },
    },
  } as unknown as DbClient;

  return { db };
}

/** Builds a minimal invited-guest row as returned by `query.guestEvents.findMany`. */
function makeInvitedGuestRow(overrides: {
  id: string;
  firstName: string;
  lastName: string;
  invitationId: string;
  notes?: string | null;
  mailingAddress?: string | null;
}) {
  return {
    guest: {
      id: overrides.id,
      firstName: overrides.firstName,
      lastName: overrides.lastName,
      invitationId: overrides.invitationId,
      notes: overrides.notes ?? null,
      invitation: { mailingAddress: overrides.mailingAddress ?? null },
    },
  };
}

/** Builds a minimal response row as returned by `query.rsvpResponses.findMany`. */
function makeResponseRow(overrides: {
  invitationId: string;
  attendanceStatus: 'attending' | 'not_attending';
  specialRequests?: string | null;
  attendees?: Array<{
    name: string;
    mealOption?: string | null;
    dietaryRestrictions?: string | null;
  }>;
}) {
  return {
    specialRequests: overrides.specialRequests ?? null,
    attendanceStatus: overrides.attendanceStatus,
    guest: { invitationId: overrides.invitationId },
    attendees: overrides.attendees ?? [],
  };
}

describe('findEventRsvpRowsForExport', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should reconstruct attending status and meal details from the matched attendee', async () => {
    const { db } = createReconstructionDb(
      [
        makeInvitedGuestRow({
          id: 'guest-1',
          firstName: 'Jane',
          lastName: 'Doe',
          invitationId: 'inv-1',
          mailingAddress: 'Doe Family',
        }),
      ],
      [
        makeResponseRow({
          invitationId: 'inv-1',
          attendanceStatus: 'attending',
          specialRequests: 'High chair please',
          attendees: [
            {
              name: 'Jane Doe',
              mealOption: 'option_a',
              dietaryRestrictions: 'Gluten free',
            },
          ],
        }),
      ],
    );

    mockGetDb.mockReturnValue(db);

    await expect(findEventRsvpRowsForExport('event-1')).resolves.toEqual([
      {
        guestId: 'guest-1',
        guestFirstName: 'Jane',
        guestLastName: 'Doe',
        partyName: 'Doe Family',
        attendanceStatus: 'attending',
        specialRequests: 'High chair please',
        guestNotes: null,
        mealOption: 'option_a',
        dietaryRestrictions: 'Gluten free',
      },
    ]);
  });

  test('should produce a no_response row with null fields for a guest without a response', async () => {
    const { db } = createReconstructionDb(
      [
        makeInvitedGuestRow({
          id: 'guest-2',
          firstName: 'John',
          lastName: 'Smith',
          invitationId: 'inv-2',
        }),
      ],
      [],
    );

    mockGetDb.mockReturnValue(db);

    await expect(findEventRsvpRowsForExport('event-1')).resolves.toEqual([
      {
        guestId: 'guest-2',
        guestFirstName: 'John',
        guestLastName: 'Smith',
        partyName: 'John Smith',
        attendanceStatus: 'no_response',
        specialRequests: null,
        guestNotes: null,
        mealOption: null,
        dietaryRestrictions: null,
      },
    ]);
  });

  test('should sort rows by last name then first name', async () => {
    const { db } = createReconstructionDb(
      [
        makeInvitedGuestRow({
          id: 'guest-3',
          firstName: 'Zed',
          lastName: 'Adams',
          invitationId: 'inv-3',
        }),
        makeInvitedGuestRow({
          id: 'guest-4',
          firstName: 'Amy',
          lastName: 'Adams',
          invitationId: 'inv-4',
        }),
        makeInvitedGuestRow({
          id: 'guest-5',
          firstName: 'Bob',
          lastName: 'Baker',
          invitationId: 'inv-5',
        }),
      ],
      [],
    );

    mockGetDb.mockReturnValue(db);

    const rows = await findEventRsvpRowsForExport('event-1');

    expect(rows.map((r) => r.guestId)).toEqual([
      'guest-4',
      'guest-3',
      'guest-5',
    ]);
  });
});

describe('findMealBreakdownForEvent', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should resolve with per-option counts as numbers', async () => {
    const { db } = createSelectChainDb([
      { mealOption: 'option_a', count: 4 },
      { mealOption: 'option_b', count: '2' },
    ]);

    mockGetDb.mockReturnValue(db);

    await expect(findMealBreakdownForEvent('event-1')).resolves.toEqual([
      { mealOption: 'option_a', count: 4 },
      { mealOption: 'option_b', count: 2 },
    ]);
  });

  test('should exclude attendees without a selected meal option', async () => {
    const { db } = createSelectChainDb([
      { mealOption: null, count: 3 },
      { mealOption: 'option_a', count: 1 },
    ]);

    mockGetDb.mockReturnValue(db);

    await expect(findMealBreakdownForEvent('event-1')).resolves.toEqual([
      { mealOption: 'option_a', count: 1 },
    ]);
  });

  test('should filter to attending responses and group by meal option', async () => {
    const { db, chain } = createSelectChainDb([]);

    mockGetDb.mockReturnValue(db);

    await findMealBreakdownForEvent('event-1');

    expect(chain.innerJoin).toHaveBeenCalledOnce();
    expect(chain.where).toHaveBeenCalledOnce();
    expect(chain.groupBy).toHaveBeenCalledOnce();
  });
});
