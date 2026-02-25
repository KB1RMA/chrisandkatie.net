/**
 * @vitest-environment node
 */
import { expect, test, describe, beforeEach, vi } from 'vitest';
import { type InferSelectModel } from 'drizzle-orm';

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

import { findDuplicateGuests, type DuplicateGuest } from './actions';
import { guests, invitations } from '@/lib/db/schema';
import { type DbClient } from '@/lib/db';
import { getDb } from '@/lib/db';

type Guest = InferSelectModel<typeof guests>;
type Invitation = InferSelectModel<typeof invitations>;

type GuestWithInvitation = Guest & { invitation: Invitation };

const mockInvitation = (overrides: Partial<Invitation> = {}): Invitation => ({
  id: 'invitation-1',
  relationshipToCouple: null,
  totalInvited: 2,
  address: '123 Main St',
  addressLine2: null,
  city: 'Springfield',
  state: 'IL',
  zipCode: '62701',
  country: null,
  mailingAddress: null,
  visibleEvents: '[0,1,2,3]',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const mockGuest = (
  overrides: Partial<GuestWithInvitation> = {},
): GuestWithInvitation => ({
  id: 'guest-1',
  invitationId: 'invitation-1',
  userId: null,
  firstName: 'John',
  lastName: 'Doe',
  type: 'adult',
  attending: null,
  mealChoice: null,
  dietaryRestrictions: null,
  notes: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  invitation: mockInvitation(),
  ...overrides,
});

function createMockDb(findManyFn: ReturnType<typeof vi.fn>): Partial<DbClient> {
  return {
    query: {
      guests: {
        findMany: findManyFn,
      },
    },
  } as unknown as Partial<DbClient>;
}

describe('findDuplicateGuests', () => {
  const mockGetDb = vi.mocked(getDb);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should return null when only one guest matches', async () => {
    const mockDb = createMockDb(vi.fn().mockResolvedValue([mockGuest()]));

    mockGetDb.mockReturnValue(mockDb as DbClient);

    const result = await findDuplicateGuests('John', 'Doe');

    expect(result).toBeNull();
  });

  test('should return null when no guests match', async () => {
    const mockDb = createMockDb(vi.fn().mockResolvedValue([]));

    mockGetDb.mockReturnValue(mockDb as DbClient);

    const result = await findDuplicateGuests('Unknown', 'Person');

    expect(result).toBeNull();
  });

  test('should return duplicate guests with formatted addresses', async () => {
    const guest1 = mockGuest({
      id: 'guest-1',
      invitationId: 'invitation-1',
      invitation: mockInvitation({
        id: 'invitation-1',
        address: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zipCode: '62701',
      }),
    });

    const guest2 = mockGuest({
      id: 'guest-2',
      invitationId: 'invitation-2',
      invitation: mockInvitation({
        id: 'invitation-2',
        address: '456 Oak Ave',
        city: 'Shelbyville',
        state: 'IL',
        zipCode: '62565',
      }),
    });

    const mockDb = createMockDb(vi.fn().mockResolvedValue([guest1, guest2]));

    mockGetDb.mockReturnValue(mockDb as DbClient);

    const result = await findDuplicateGuests('John', 'Doe');

    expect(result).toHaveLength(2);
    expect((result as DuplicateGuest[])[0]).toEqual({
      guestId: 'guest-1',
      address: '123 Main St, Springfield, IL 62701',
    });
    expect((result as DuplicateGuest[])[1]).toEqual({
      guestId: 'guest-2',
      address: '456 Oak Ave, Shelbyville, IL 62565',
    });
  });

  test('should prefer mailingAddress over individual address fields', async () => {
    const guest1 = mockGuest({
      id: 'guest-1',
      invitation: mockInvitation({
        mailingAddress: 'The Doe Family, 123 Main St, Springfield, IL 62701',
        address: '123 Main St',
        city: 'Springfield',
        state: 'IL',
      }),
    });

    const guest2 = mockGuest({
      id: 'guest-2',
      invitationId: 'invitation-2',
      invitation: mockInvitation({
        id: 'invitation-2',
        mailingAddress: 'John & Jane Doe, 456 Oak Ave, Shelbyville, IL 62565',
      }),
    });

    const mockDb = createMockDb(vi.fn().mockResolvedValue([guest1, guest2]));

    mockGetDb.mockReturnValue(mockDb as DbClient);

    const result = await findDuplicateGuests('John', 'Doe');

    expect((result as DuplicateGuest[])[0].address).toBe(
      'The Doe Family, 123 Main St, Springfield, IL 62701',
    );
    expect((result as DuplicateGuest[])[1].address).toBe(
      'John & Jane Doe, 456 Oak Ave, Shelbyville, IL 62565',
    );
  });

  test('should return empty address string when no address data exists', async () => {
    const guest1 = mockGuest({
      id: 'guest-1',
      invitation: mockInvitation({
        mailingAddress: null,
        address: null,
        city: null,
        state: null,
        zipCode: null,
      }),
    });

    const guest2 = mockGuest({
      id: 'guest-2',
      invitationId: 'invitation-2',
      invitation: mockInvitation({
        id: 'invitation-2',
        mailingAddress: null,
        address: null,
        city: null,
        state: null,
        zipCode: null,
      }),
    });

    const mockDb = createMockDb(vi.fn().mockResolvedValue([guest1, guest2]));

    mockGetDb.mockReturnValue(mockDb as DbClient);

    const result = await findDuplicateGuests('John', 'Doe');

    expect(result).toHaveLength(2);
    expect((result as DuplicateGuest[])[0].address).toBe('');
    expect((result as DuplicateGuest[])[1].address).toBe('');
  });

  test('should include addressLine2 in formatted address when present', async () => {
    const guest1 = mockGuest({
      id: 'guest-1',
      invitation: mockInvitation({
        address: '123 Main St',
        addressLine2: 'Apt 4B',
        city: 'Springfield',
        state: 'IL',
        zipCode: '62701',
      }),
    });

    const guest2 = mockGuest({
      id: 'guest-2',
      invitationId: 'invitation-2',
      invitation: mockInvitation({
        id: 'invitation-2',
        address: '456 Oak Ave',
        addressLine2: null,
        city: 'Shelbyville',
        state: 'IL',
        zipCode: '62565',
      }),
    });

    const mockDb = createMockDb(vi.fn().mockResolvedValue([guest1, guest2]));

    mockGetDb.mockReturnValue(mockDb as DbClient);

    const result = await findDuplicateGuests('John', 'Doe');

    expect((result as DuplicateGuest[])[0].address).toBe(
      '123 Main St, Apt 4B, Springfield, IL 62701',
    );
  });
});
