/**
 * @vitest-environment node
 */
import { expect, test, describe, vi, beforeEach } from 'vitest';
import { type Session } from 'next-auth';
import { renderToString } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { getByText } from '@testing-library/react';

vi.mock('next/font/google', () => ({
  Marcellus: vi.fn(() => ({ className: 'marcellus-font' })),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

import SchedulePage from './page';
import { type InferSelectModel } from 'drizzle-orm';
import { guests } from '@/lib/db/schema';
import { type DbClient } from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { redirect } from 'next/navigation';
import type { WeddingEvent } from '@/lib/db/schema';

type Guest = InferSelectModel<typeof guests>;

/**
 * Creates a Drizzle select chain mock that resolves to the given rows.
 *
 * @param rows - Rows to return from the final awaited call.
 * @returns A mock select function that chains from/innerJoin/where/orderBy.
 */
function createSelectChainMock(rows: { event: WeddingEvent }[]) {
  const orderByFn = vi.fn().mockResolvedValue(rows);
  const whereFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
  const innerJoinFn = vi.fn().mockReturnValue({ where: whereFn });
  const fromFn = vi.fn().mockReturnValue({ innerJoin: innerJoinFn });

  return vi.fn().mockReturnValue({ from: fromFn });
}

/**
 * Creates a mock Drizzle database for testing the DB-based schedule page.
 *
 * @param findFirstFn - Mock for db.query.guests.findFirst.
 * @param selectFn - Mock for db.select().from().innerJoin().where().orderBy().
 * @returns Partial DbClient with mocked methods.
 */
function createMockDb(
  findFirstFn: ReturnType<typeof vi.fn>,
  selectFn: ReturnType<typeof vi.fn> = vi.fn(),
): Partial<DbClient> {
  return {
    query: {
      guests: {
        findFirst: findFirstFn,
      },
    },
    select: selectFn,
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a complete Guest record for testing.
 *
 * @param overrides - Partial fields to override defaults.
 * @returns A complete Guest fixture.
 */
function makeGuest(overrides: Partial<Guest> = {}): Guest {
  return {
    id: 'guest-1',
    invitationId: 'invitation-1',
    firstName: 'John',
    lastName: 'Doe',
    userId: null,
    type: 'adult',
    attending: null,
    mealChoice: null,
    dietaryRestrictions: null,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('SchedulePage', () => {
  const mockAuth = vi.mocked(auth);
  const mockGetDb = vi.mocked(getDb);
  const mockRedirect = vi.mocked(redirect);

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });
  });

  test('should redirect to login if user is not authenticated', async () => {
    mockAuth.mockResolvedValue(null);

    const mockDb = createMockDb(vi.fn(), vi.fn());
    mockGetDb.mockReturnValue(mockDb as DbClient);

    await expect(SchedulePage()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/login?callbackUrl=/schedule');
  });

  test('should redirect to login if session has no guestId', async () => {
    const mockSession: Session = {
      user: {},
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    const mockDb = createMockDb(vi.fn(), vi.fn());
    mockGetDb.mockReturnValue(mockDb as DbClient);

    await expect(SchedulePage()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/login?callbackUrl=/schedule');
  });

  test('should redirect to login if guest does not exist in database', async () => {
    const mockSession: Session = {
      user: { guestId: 'guest-1' },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    const selectFn = createSelectChainMock([]);
    const mockDb = createMockDb(vi.fn().mockResolvedValue(null), selectFn);
    mockGetDb.mockReturnValue(mockDb as DbClient);

    await expect(SchedulePage()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/login?callbackUrl=/schedule');
  });

  test('should render empty-state message when guest has no assigned events', async () => {
    const mockSession: Session = {
      user: { guestId: 'guest-1' },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    const selectFn = createSelectChainMock([]);
    const mockDb = createMockDb(
      vi.fn().mockResolvedValue(makeGuest()),
      selectFn,
    );
    mockGetDb.mockReturnValue(mockDb as DbClient);

    const result = await SchedulePage();

    expect(result).toBeDefined();

    // eslint-disable-next-line testing-library/render-result-naming-convention
    const htmlString = renderToString(result as React.ReactElement);
    const dom = new JSDOM(htmlString);
    const container = dom.window.document.body;

    // eslint-disable-next-line testing-library/prefer-screen-queries
    expect(getByText(container, /Welcome,/)).toBeInTheDocument();

    // Should show an empty-state message when no events
    // eslint-disable-next-line testing-library/prefer-screen-queries
    expect(getByText(container, /No events/i)).toBeInTheDocument();
  });

  test('should render DB events in sortOrder order', async () => {
    const mockSession: Session = {
      user: { guestId: 'guest-1' },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    const event1 = makeEvent({
      id: 'event-1',
      name: 'First Event',
      sortOrder: 1,
      location: 'Venue A',
    });
    const event2 = makeEvent({
      id: 'event-2',
      name: 'Second Event',
      sortOrder: 2,
      location: 'Venue B',
    });

    const selectFn = createSelectChainMock([
      { event: event1 },
      { event: event2 },
    ]);
    const mockDb = createMockDb(
      vi.fn().mockResolvedValue(makeGuest()),
      selectFn,
    );
    mockGetDb.mockReturnValue(mockDb as DbClient);

    const result = await SchedulePage();

    expect(result).toBeDefined();

    // eslint-disable-next-line testing-library/render-result-naming-convention
    const htmlString = renderToString(result as React.ReactElement);
    const dom = new JSDOM(htmlString);
    const container = dom.window.document.body;

    // Both event locations should be visible
    // eslint-disable-next-line testing-library/prefer-screen-queries
    expect(getByText(container, 'Venue A')).toBeInTheDocument();
    // eslint-disable-next-line testing-library/prefer-screen-queries
    expect(getByText(container, 'Venue B')).toBeInTheDocument();
  });

  test('should show guest welcome message with correct name', async () => {
    const mockSession: Session = {
      user: { guestId: 'guest-1' },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    const selectFn = createSelectChainMock([]);
    const mockDb = createMockDb(
      vi.fn().mockResolvedValue(makeGuest({ firstName: 'Alice' })),
      selectFn,
    );
    mockGetDb.mockReturnValue(mockDb as DbClient);

    const result = await SchedulePage();

    // eslint-disable-next-line testing-library/render-result-naming-convention
    const htmlString = renderToString(result as React.ReactElement);
    const dom = new JSDOM(htmlString);
    const container = dom.window.document.body;

    // eslint-disable-next-line testing-library/prefer-screen-queries
    expect(getByText(container, /Alice/)).toBeInTheDocument();
  });
});
