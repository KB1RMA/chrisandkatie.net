/**
 * @vitest-environment node
 */
import { expect, test, describe, vi, beforeEach } from 'vitest';
import { type Session } from 'next-auth';
import { renderToString } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { getByText, queryByText } from '@testing-library/react';

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
import { guests, invitations } from '@/lib/db/schema';
import { type DbClient } from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { redirect } from 'next/navigation';
import { SCHEDULE_EVENTS } from '@/lib/events';

type Guest = InferSelectModel<typeof guests>;
type Invitation = InferSelectModel<typeof invitations>;

/**
 * Creates a mock Drizzle database for testing.
 * Provides only the methods used in SchedulePage tests.
 */
function createMockDb(
  findFirstFn: ReturnType<typeof vi.fn>,
): Partial<DbClient> {
  return {
    query: {
      guests: {
        findFirst: findFirstFn,
      },
    },
  } as unknown as Partial<DbClient>;
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

    const mockDb = createMockDb(vi.fn());
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

    const mockDb = createMockDb(vi.fn());
    mockGetDb.mockReturnValue(mockDb as DbClient);

    await expect(SchedulePage()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/login?callbackUrl=/schedule');
  });

  test('should redirect to login if guest does not exist', async () => {
    const guestId = 'guest-1';

    const mockSession: Session = {
      user: {
        guestId,
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    const mockDb = createMockDb(vi.fn().mockResolvedValue(null));
    mockGetDb.mockReturnValue(mockDb as DbClient);

    await expect(SchedulePage()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/login?callbackUrl=/schedule');
  });

  test('should redirect to login if guest has no invitation', async () => {
    const guestId = 'guest-1';

    const mockSession: Session = {
      user: {
        guestId,
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    const mockGuest: Guest = {
      id: guestId,
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
    };

    const mockDb = createMockDb(
      vi.fn().mockResolvedValue({
        ...mockGuest,
        invitation: null,
      }),
    );

    mockGetDb.mockReturnValue(mockDb as DbClient);

    await expect(SchedulePage()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/login?callbackUrl=/schedule');
  });

  test('should only show events the guest is invited to', async () => {
    const guestId = 'guest-1';
    const visibleEventIds = [0, 2];

    const mockSession: Session = {
      user: {
        guestId,
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    const mockInvitation: Invitation = {
      id: 'invitation-1',
      relationshipToCouple: 'friend',
      totalInvited: 2,
      address: '123 Main St',
      addressLine2: null,
      city: 'Springfield',
      state: 'IL',
      zipCode: '62701',
      country: 'USA',
      mailingAddress: null,
      visibleEvents: JSON.stringify(visibleEventIds),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockGuest: Guest = {
      id: guestId,
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
    };

    const mockDb = createMockDb(
      vi.fn().mockResolvedValue({
        ...mockGuest,
        invitation: mockInvitation,
      }),
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
    // eslint-disable-next-line testing-library/prefer-screen-queries
    expect(getByText(container, /John/)).toBeInTheDocument();
    // eslint-disable-next-line testing-library/prefer-screen-queries
    expect(getByText(container, /personalized schedule/)).toBeInTheDocument();

    // Verify visible events are displayed

    expect(
      // eslint-disable-next-line testing-library/prefer-screen-queries
      getByText(container, SCHEDULE_EVENTS[0].location),
    ).toBeInTheDocument();

    expect(
      // eslint-disable-next-line testing-library/prefer-screen-queries
      getByText(container, SCHEDULE_EVENTS[2].location),
    ).toBeInTheDocument();

    // Verify hidden event location is not displayed
    expect(
      // eslint-disable-next-line testing-library/prefer-screen-queries
      queryByText(container, SCHEDULE_EVENTS[1].location),
    ).not.toBeInTheDocument();
  });

  test('should fetch guest with invitation relationship', async () => {
    const guestId = 'guest-1';

    const mockSession: Session = {
      user: {
        guestId,
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    const mockInvitation: Invitation = {
      id: 'invitation-1',
      relationshipToCouple: 'friend',
      totalInvited: 1,
      address: '123 Main St',
      addressLine2: null,
      city: 'Springfield',
      state: 'IL',
      zipCode: '62701',
      country: 'USA',
      mailingAddress: null,
      visibleEvents: '[0,1,2,3]',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockGuest: Guest = {
      id: guestId,
      invitationId: 'invitation-1',
      firstName: 'Jane',
      lastName: 'Smith',
      userId: null,
      type: 'adult',
      attending: null,
      mealChoice: null,
      dietaryRestrictions: null,
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const findFirstFn = vi.fn().mockResolvedValue({
      ...mockGuest,
      invitation: mockInvitation,
    });

    const mockDb = createMockDb(findFirstFn);

    mockGetDb.mockReturnValue(mockDb as DbClient);

    await SchedulePage();

    expect(findFirstFn).toHaveBeenCalledWith({
      where: expect.any(Function),
      with: {
        invitation: true,
      },
    });
  });
});
