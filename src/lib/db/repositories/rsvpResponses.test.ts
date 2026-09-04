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
  findEventResponsesForGuestIds,
  findEventRsvpRowsForExport,
  findMealBreakdownForEvent,
  getEventRsvpReconstruction,
  replacePartyEventRsvp,
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
  attending?: boolean | null;
}) {
  return {
    guest: {
      id: overrides.id,
      firstName: overrides.firstName,
      lastName: overrides.lastName,
      invitationId: overrides.invitationId,
      notes: overrides.notes ?? null,
      attending: overrides.attending ?? null,
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

describe('getEventRsvpReconstruction party fields', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should report hasPartyResponse false and carry the legacy attending flag', async () => {
    const { db } = createReconstructionDb(
      [
        makeInvitedGuestRow({
          id: 'guest-1',
          firstName: 'Jane',
          lastName: 'Doe',
          invitationId: 'inv-1',
          attending: true,
        }),
      ],
      [],
    );

    mockGetDb.mockReturnValue(db);

    const { rows } = await getEventRsvpReconstruction('event-1');

    expect(rows[0]).toMatchObject({
      guestId: 'guest-1',
      status: 'no_response',
      legacyAttending: true,
      hasPartyResponse: false,
    });
  });

  test('should report hasPartyResponse true for every member of a party that responded', async () => {
    const { db } = createReconstructionDb(
      [
        makeInvitedGuestRow({
          id: 'guest-1',
          firstName: 'Jane',
          lastName: 'Doe',
          invitationId: 'inv-1',
        }),
        makeInvitedGuestRow({
          id: 'guest-2',
          firstName: 'John',
          lastName: 'Doe',
          invitationId: 'inv-1',
        }),
        makeInvitedGuestRow({
          id: 'guest-3',
          firstName: 'Sam',
          lastName: 'Roe',
          invitationId: 'inv-2',
        }),
      ],
      [
        makeResponseRow({
          invitationId: 'inv-1',
          attendanceStatus: 'attending',
          attendees: [{ name: 'Jane Doe' }],
        }),
      ],
    );

    mockGetDb.mockReturnValue(db);

    const { rows } = await getEventRsvpReconstruction('event-1');
    const hasResponseById = new Map(
      rows.map((row) => [row.guestId, row.hasPartyResponse]),
    );

    expect(hasResponseById.get('guest-1')).toBe(true);
    expect(hasResponseById.get('guest-2')).toBe(true);
    expect(hasResponseById.get('guest-3')).toBe(false);
  });
});

describe('findEventResponsesForGuestIds', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should resolve with the responses returned by the query', async () => {
    const responseRows = [{ id: 'rsvp-1', attendees: [] }];
    const findMany = vi.fn().mockResolvedValue(responseRows);
    const db = {
      query: { rsvpResponses: { findMany } },
    } as unknown as DbClient;

    mockGetDb.mockReturnValue(db);

    await expect(
      findEventResponsesForGuestIds('event-1', ['guest-1', 'guest-2']),
    ).resolves.toEqual(responseRows);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  test('should not query when there are no guest ids', async () => {
    const findMany = vi.fn();
    const db = {
      query: { rsvpResponses: { findMany } },
    } as unknown as DbClient;

    mockGetDb.mockReturnValue(db);

    await expect(findEventResponsesForGuestIds('event-1', [])).resolves.toEqual(
      [],
    );
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('replacePartyEventRsvp', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Creates a mock db that records the statements handed to `db.batch`,
   * tagging each one by the builder that produced it.
   *
   * @returns The mock DbClient plus the batch spy.
   */
  function createBatchDb() {
    const batch = vi.fn().mockResolvedValue([]);

    const insertChain = {
      values: vi.fn(),
      onConflictDoUpdate: vi.fn(),
    };

    const deleteChain = { where: vi.fn() };

    const db = {
      batch,
      insert: vi.fn(() => {
        const chain = {
          values: vi.fn(() => {
            const withConflict = {
              kind: 'insert',
              onConflictDoUpdate: vi.fn(() => ({ kind: 'upsert' })),
            };

            return withConflict;
          }),
        };

        return chain;
      }),
      delete: vi.fn(() => ({
        where: vi.fn(() => ({ kind: 'delete' })),
      })),
    } as unknown as DbClient & { batch: ReturnType<typeof vi.fn> };

    void insertChain;
    void deleteChain;

    return { db, batch };
  }

  const baseInput = {
    response: {
      id: 'rsvp-1',
      guestId: 'guest-1',
      eventId: 'event-1',
      attendanceStatus: 'attending' as const,
      numberOfAttending: 1,
      submittedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    responseUpdate: {
      attendanceStatus: 'attending' as const,
      numberOfAttending: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    attendeeRows: [
      {
        id: 'att-1',
        rsvpResponseId: 'rsvp-1',
        name: 'Jane Doe',
        mealOption: 'option_a' as const,
        dietaryRestrictions: null,
        sortOrder: 0,
      },
    ],
    staleAttendeeIds: [],
  };

  test('should write the upsert, the attendee clear, and the attendee insert in one batch', async () => {
    const { db, batch } = createBatchDb();

    mockGetDb.mockReturnValue(db);

    await replacePartyEventRsvp(baseInput);

    expect(batch).toHaveBeenCalledTimes(1);

    const statements = batch.mock.calls[0][0] as Array<{ kind: string }>;

    expect(statements.map((statement) => statement.kind)).toEqual([
      'upsert',
      'delete',
      'insert',
    ]);
  });

  test('should add a delete for stale attendee rows under other party responses', async () => {
    const { db, batch } = createBatchDb();

    mockGetDb.mockReturnValue(db);

    await replacePartyEventRsvp({
      ...baseInput,
      staleAttendeeIds: ['att-old'],
    });

    const statements = batch.mock.calls[0][0] as Array<{ kind: string }>;

    expect(statements.map((statement) => statement.kind)).toEqual([
      'upsert',
      'delete',
      'delete',
      'insert',
    ]);
  });

  test('should omit the attendee insert when the party declines', async () => {
    const { db, batch } = createBatchDb();

    mockGetDb.mockReturnValue(db);

    await replacePartyEventRsvp({
      ...baseInput,
      response: {
        ...baseInput.response,
        attendanceStatus: 'not_attending',
        numberOfAttending: 0,
      },
      responseUpdate: {
        attendanceStatus: 'not_attending',
        numberOfAttending: 0,
        updatedAt: baseInput.responseUpdate.updatedAt,
      },
      attendeeRows: [],
    });

    const statements = batch.mock.calls[0][0] as Array<{ kind: string }>;

    expect(statements.map((statement) => statement.kind)).toEqual([
      'upsert',
      'delete',
    ]);
  });
});
