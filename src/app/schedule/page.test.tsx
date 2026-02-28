/**
 * @vitest-environment node
 */
import { expect, test, describe, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { getByText } from '@testing-library/react';

vi.mock('next/font/google', () => ({
  Marcellus: vi.fn(() => ({ className: 'marcellus-font' })),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  getAuthIdentity: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

import SchedulePage from './page';
import { type DbClient } from '@/lib/db';
import { auth, getAuthIdentity } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { redirect } from 'next/navigation';
import type { WeddingEvent } from '@/lib/db/schema';

/**
 * Creates a Drizzle select chain mock that resolves to the given event rows.
 * Used for the admin path: db.select().from(events).orderBy() → WeddingEvent[]
 *
 * @param events - Event rows to return from the final awaited call.
 * @returns A mock select function that chains from/orderBy.
 */
function createAdminSelectChainMock(events: WeddingEvent[]) {
  const orderByFn = vi.fn().mockResolvedValue(events);
  const fromFn = vi.fn().mockReturnValue({ orderBy: orderByFn });

  return vi.fn().mockReturnValue({ from: fromFn });
}

/**
 * Creates a Drizzle selectDistinct chain mock that resolves to the given rows.
 * Used for the guest path: db.selectDistinct().from().innerJoin().where().orderBy()
 *
 * @param rows - Rows to return from the final awaited call.
 * @returns A mock selectDistinct function that chains from/innerJoin/where/orderBy.
 */
function createGuestSelectDistinctChainMock(rows: { event: WeddingEvent }[]) {
  const orderByFn = vi.fn().mockResolvedValue(rows);
  const whereFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
  const innerJoinFn = vi.fn().mockReturnValue({ where: whereFn });
  const fromFn = vi.fn().mockReturnValue({ innerJoin: innerJoinFn });

  return vi.fn().mockReturnValue({ from: fromFn });
}

/**
 * Creates a mock DbClient for testing the admin schedule branch.
 *
 * @param selectFn - Mock for db.select().from().orderBy() chain.
 * @returns Partial DbClient with mocked methods.
 */
function createAdminMockDb(
  selectFn: ReturnType<typeof vi.fn>,
): Partial<DbClient> {
  return {
    select: selectFn,
  } as unknown as Partial<DbClient>;
}

/**
 * Creates a mock DbClient for testing the guest schedule branch.
 *
 * @param invitationFindFirstFn - Mock for db.query.invitations.findFirst.
 * @param selectDistinctFn - Mock for db.selectDistinct().from().innerJoin().where().orderBy() chain.
 * @returns Partial DbClient with mocked methods.
 */
function createGuestMockDb(
  invitationFindFirstFn: ReturnType<typeof vi.fn>,
  selectDistinctFn: ReturnType<typeof vi.fn> = vi.fn(),
): Partial<DbClient> {
  return {
    query: {
      invitations: {
        findFirst: invitationFindFirstFn,
      },
    },
    selectDistinct: selectDistinctFn,
  } as unknown as Partial<DbClient>;
}

/**
 * Creates a complete WeddingEvent record for testing.
 *
 * @param overrides - Partial fields to override defaults.
 * @returns A complete WeddingEvent fixture.
 */
function makeEvent(overrides: Partial<WeddingEvent> = {}): WeddingEvent {
  return {
    id: 'event-1',
    name: 'Test Event',
    description: null,
    location: 'Test Location',
    eventDate: '2025-09-13',
    startTime: '16:00',
    endTime: '22:00',
    type: 'main',
    dressCode: null,
    parkingInfo: null,
    sortOrder: 0,
    rsvpRequired: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a minimal invitation fixture with embedded guests.
 *
 * @param guests - Guest records to include in the invitation.
 * @returns An invitation fixture.
 */
function makeInvitation(
  guests: Array<{ id: string; firstName: string; lastName: string }>,
) {
  return {
    id: 'invitation-1',
    code: 'swift-panda',
    guests: guests.map((g) => ({
      ...g,
      invitationId: 'invitation-1',
      userId: null,
      type: 'adult' as const,
      attending: null,
      mealChoice: null,
      dietaryRestrictions: null,
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
  };
}

describe('SchedulePage', () => {
  const mockAuth = vi.mocked(auth);
  const mockGetAuthIdentity = vi.mocked(getAuthIdentity);
  const mockGetDb = vi.mocked(getDb);
  const mockRedirect = vi.mocked(redirect);

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(null);
    mockRedirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });
  });

  // ---------------------------------------------------------------------------
  // Unauthenticated
  // ---------------------------------------------------------------------------

  test('should redirect to login if user is not authenticated', async () => {
    mockGetAuthIdentity.mockReturnValue(null);

    await expect(SchedulePage()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/login?callbackUrl=/schedule');
  });

  // ---------------------------------------------------------------------------
  // Admin identity branch
  // ---------------------------------------------------------------------------

  describe('admin identity', () => {
    beforeEach(() => {
      mockGetAuthIdentity.mockReturnValue({
        type: 'admin',
        username: 'adminuser',
      });
    });

    test('should render all events for admin identity', async () => {
      const event1 = makeEvent({
        id: 'event-1',
        name: 'Ceremony',
        location: 'Chapel',
      });
      const event2 = makeEvent({
        id: 'event-2',
        name: 'Reception',
        location: 'Hall',
      });

      const mockDb = createAdminMockDb(
        createAdminSelectChainMock([event1, event2]),
      );
      mockGetDb.mockReturnValue(mockDb as DbClient);

      const result = await SchedulePage();

      expect(result).toBeDefined();

      // eslint-disable-next-line testing-library/render-result-naming-convention
      const htmlString = renderToString(result as React.ReactElement);
      const dom = new JSDOM(htmlString);
      const container = dom.window.document.body;

      // eslint-disable-next-line testing-library/prefer-screen-queries
      expect(getByText(container, 'Chapel')).toBeInTheDocument();
      // eslint-disable-next-line testing-library/prefer-screen-queries
      expect(getByText(container, 'Hall')).toBeInTheDocument();
    });

    test('should show admin username in welcome message', async () => {
      const mockDb = createAdminMockDb(createAdminSelectChainMock([]));
      mockGetDb.mockReturnValue(mockDb as DbClient);

      const result = await SchedulePage();

      // eslint-disable-next-line testing-library/render-result-naming-convention
      const htmlString = renderToString(result as React.ReactElement);
      const dom = new JSDOM(htmlString);
      const container = dom.window.document.body;

      // eslint-disable-next-line testing-library/prefer-screen-queries
      expect(getByText(container, /adminuser/)).toBeInTheDocument();
    });

    test('should show empty state when admin has no events in DB', async () => {
      const mockDb = createAdminMockDb(createAdminSelectChainMock([]));
      mockGetDb.mockReturnValue(mockDb as DbClient);

      const result = await SchedulePage();

      // eslint-disable-next-line testing-library/render-result-naming-convention
      const htmlString = renderToString(result as React.ReactElement);
      const dom = new JSDOM(htmlString);
      const container = dom.window.document.body;

      // eslint-disable-next-line testing-library/prefer-screen-queries
      expect(getByText(container, /No events/i)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Guest identity branch
  // ---------------------------------------------------------------------------

  describe('guest identity', () => {
    beforeEach(() => {
      mockGetAuthIdentity.mockReturnValue({
        type: 'guest',
        invitationId: 'invitation-1',
      });
    });

    test('should redirect to login if invitation is not found', async () => {
      const mockDb = createGuestMockDb(vi.fn().mockResolvedValue(null));
      mockGetDb.mockReturnValue(mockDb as DbClient);

      await expect(SchedulePage()).rejects.toThrow('NEXT_REDIRECT');
      expect(mockRedirect).toHaveBeenCalledWith('/login?callbackUrl=/schedule');
    });

    test('should redirect to login if invitation has no guests', async () => {
      const mockDb = createGuestMockDb(
        vi.fn().mockResolvedValue(makeInvitation([])),
      );
      mockGetDb.mockReturnValue(mockDb as DbClient);

      await expect(SchedulePage()).rejects.toThrow('NEXT_REDIRECT');
      expect(mockRedirect).toHaveBeenCalledWith('/login?callbackUrl=/schedule');
    });

    test('should render filtered events for guest identity', async () => {
      const event1 = makeEvent({
        id: 'event-1',
        location: 'Venue A',
        sortOrder: 1,
      });
      const event2 = makeEvent({
        id: 'event-2',
        location: 'Venue B',
        sortOrder: 2,
      });

      const invitation = makeInvitation([
        { id: 'guest-1', firstName: 'Alice', lastName: 'Smith' },
      ]);
      const selectDistinctFn = createGuestSelectDistinctChainMock([
        { event: event1 },
        { event: event2 },
      ]);
      const mockDb = createGuestMockDb(
        vi.fn().mockResolvedValue(invitation),
        selectDistinctFn,
      );
      mockGetDb.mockReturnValue(mockDb as DbClient);

      const result = await SchedulePage();

      expect(result).toBeDefined();

      // eslint-disable-next-line testing-library/render-result-naming-convention
      const htmlString = renderToString(result as React.ReactElement);
      const dom = new JSDOM(htmlString);
      const container = dom.window.document.body;

      // eslint-disable-next-line testing-library/prefer-screen-queries
      expect(getByText(container, 'Venue A')).toBeInTheDocument();
      // eslint-disable-next-line testing-library/prefer-screen-queries
      expect(getByText(container, 'Venue B')).toBeInTheDocument();
    });

    test('should show guest first names in welcome message', async () => {
      const invitation = makeInvitation([
        { id: 'guest-1', firstName: 'Alice', lastName: 'Smith' },
        { id: 'guest-2', firstName: 'Bob', lastName: 'Smith' },
      ]);
      const mockDb = createGuestMockDb(
        vi.fn().mockResolvedValue(invitation),
        createGuestSelectDistinctChainMock([]),
      );
      mockGetDb.mockReturnValue(mockDb as DbClient);

      const result = await SchedulePage();

      // eslint-disable-next-line testing-library/render-result-naming-convention
      const htmlString = renderToString(result as React.ReactElement);
      const dom = new JSDOM(htmlString);
      const container = dom.window.document.body;

      // eslint-disable-next-line testing-library/prefer-screen-queries
      expect(getByText(container, /Alice & Bob/)).toBeInTheDocument();
    });

    test('should show empty state when guest has no assigned events', async () => {
      const invitation = makeInvitation([
        { id: 'guest-1', firstName: 'Alice', lastName: 'Smith' },
      ]);
      const mockDb = createGuestMockDb(
        vi.fn().mockResolvedValue(invitation),
        createGuestSelectDistinctChainMock([]),
      );
      mockGetDb.mockReturnValue(mockDb as DbClient);

      const result = await SchedulePage();

      // eslint-disable-next-line testing-library/render-result-naming-convention
      const htmlString = renderToString(result as React.ReactElement);
      const dom = new JSDOM(htmlString);
      const container = dom.window.document.body;

      // eslint-disable-next-line testing-library/prefer-screen-queries
      expect(getByText(container, /No events/i)).toBeInTheDocument();
    });
  });
});
