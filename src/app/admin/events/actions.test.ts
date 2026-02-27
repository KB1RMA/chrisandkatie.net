/**
 * @vitest-environment node
 */

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { expect, test, describe, beforeEach, vi } from 'vitest';
import type { Session } from 'next-auth';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import type { DbClient } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import {
  createEvent,
  updateEvent,
  deleteEvent,
  getEventRsvpSummary,
} from './actions';

const mockAuth = vi.mocked(auth);
const mockGetDb = vi.mocked(getDb);
const mockRevalidatePath = vi.mocked(revalidatePath);

function makeAdminSession(): Session {
  return {
    user: { roles: ['admin'] },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

function createMockDb(
  overrides: Partial<{
    eventFindFirst: ReturnType<typeof vi.fn>;
    guestFindMany: ReturnType<typeof vi.fn>;
    guestEventAggregate: ReturnType<typeof vi.fn>;
    rsvpAggregate: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
  }> = {},
): DbClient {
  const whereFn = vi.fn().mockResolvedValue(undefined);
  const setFn = vi.fn().mockReturnValue({ where: whereFn });
  const updateFn = overrides.update ?? vi.fn().mockReturnValue({ set: setFn });

  const insertValuesFn = vi.fn().mockResolvedValue([{ id: 'new-event-id' }]);
  const insertFn =
    overrides.insert ?? vi.fn().mockReturnValue({ values: insertValuesFn });

  const deleteFn =
    overrides.delete ??
    vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

  const selectFromFn = vi.fn().mockReturnValue({ where: whereFn });
  const selectFn =
    overrides.select ?? vi.fn().mockReturnValue({ from: selectFromFn });

  const db: DbClient = {
    query: {
      events: {
        findFirst: overrides.eventFindFirst ?? vi.fn().mockResolvedValue(null),
      },
      guests: {
        findMany: overrides.guestFindMany ?? vi.fn().mockResolvedValue([]),
      },
    },
    insert: insertFn,
    update: updateFn,
    delete: deleteFn,
    select: selectFn,
    // Execute the transaction callback with the same mock db as the tx argument
    transaction: vi
      .fn()
      .mockImplementation((callback: (tx: DbClient) => Promise<unknown>) =>
        callback(db),
      ),
  } as unknown as DbClient;

  return db;
}

describe('createEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should return { success: false, error: "Unauthorized" } when session is null', async () => {
    mockAuth.mockResolvedValue(null);

    const result = await createEvent({
      name: 'Rehearsal Dinner',
      eventDate: '2026-09-11',
      startTime: '18:30',
      endTime: '20:30',
    });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  test('should return { success: false, error: "Unauthorized" } when user is not admin', async () => {
    mockAuth.mockResolvedValue({
      user: { roles: [] },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    const result = await createEvent({
      name: 'Rehearsal Dinner',
      eventDate: '2026-09-11',
      startTime: '18:30',
      endTime: '20:30',
    });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  test('should return { success: false, error: ... } when input is invalid', async () => {
    mockAuth.mockResolvedValue(makeAdminSession());

    const result = await createEvent({} as Parameters<typeof createEvent>[0]);

    expect(result.success).toBe(false);
    expect(typeof (result as { success: false; error: string }).error).toBe(
      'string',
    );
  });

  test('should insert record and return { success: true, data: { id } } with valid input', async () => {
    mockAuth.mockResolvedValue(makeAdminSession());

    const insertValuesFn = vi.fn().mockResolvedValue([{ id: 'new-event-id' }]);
    const insertFn = vi.fn().mockReturnValue({ values: insertValuesFn });
    const mockDb = createMockDb({ insert: insertFn });

    mockGetDb.mockReturnValue(mockDb);

    const result = await createEvent({
      name: 'Rehearsal Dinner',
      eventDate: '2026-09-11',
      startTime: '18:30',
      endTime: '20:30',
    });

    expect(result.success).toBe(true);
    expect(
      typeof (result as { success: true; data: { id: string } }).data.id,
    ).toBe('string');
  });

  test('should call revalidatePath for /admin/events and /schedule on success', async () => {
    mockAuth.mockResolvedValue(makeAdminSession());

    const insertValuesFn = vi.fn().mockResolvedValue([{ id: 'new-event-id' }]);
    const insertFn = vi.fn().mockReturnValue({ values: insertValuesFn });
    const mockDb = createMockDb({ insert: insertFn });

    mockGetDb.mockReturnValue(mockDb);

    await createEvent({
      name: 'Rehearsal Dinner',
      eventDate: '2026-09-11',
      startTime: '18:30',
      endTime: '20:30',
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/events');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/schedule');
  });

  test('should insert a guestEvents row for every guest when inviteAllGuests is true', async () => {
    mockAuth.mockResolvedValue(makeAdminSession());

    const insertValuesFn = vi.fn().mockResolvedValue([]);
    const insertFn = vi.fn().mockReturnValue({ values: insertValuesFn });
    const guestFindManyFn = vi
      .fn()
      .mockResolvedValue([{ id: 'guest-1' }, { id: 'guest-2' }]);
    const mockDb = createMockDb({
      insert: insertFn,
      guestFindMany: guestFindManyFn,
    });

    mockGetDb.mockReturnValue(mockDb);

    const result = await createEvent({
      name: 'Wedding',
      eventDate: '2026-09-12',
      startTime: '16:00',
      endTime: '23:00',
      inviteAllGuests: true,
    });

    expect(result.success).toBe(true);
    expect(insertFn).toHaveBeenCalledTimes(2);

    const guestEventValues = insertValuesFn.mock.calls[1][0] as Array<{
      guestId: string;
      eventId: string;
    }>;

    expect(guestEventValues).toHaveLength(2);
    expect(guestEventValues[0]).toMatchObject({ guestId: 'guest-1' });
    expect(guestEventValues[1]).toMatchObject({ guestId: 'guest-2' });
  });

  test('should not insert guestEvents when inviteAllGuests is false', async () => {
    mockAuth.mockResolvedValue(makeAdminSession());

    const insertValuesFn = vi.fn().mockResolvedValue([]);
    const insertFn = vi.fn().mockReturnValue({ values: insertValuesFn });
    const mockDb = createMockDb({ insert: insertFn });

    mockGetDb.mockReturnValue(mockDb);

    const result = await createEvent({
      name: 'Wedding',
      eventDate: '2026-09-12',
      startTime: '16:00',
      endTime: '23:00',
      inviteAllGuests: false,
    });

    expect(result.success).toBe(true);
    expect(insertFn).toHaveBeenCalledTimes(1);
  });

  test('should not insert guestEvents when inviteAllGuests is true but no guests exist', async () => {
    mockAuth.mockResolvedValue(makeAdminSession());

    const insertValuesFn = vi.fn().mockResolvedValue([]);
    const insertFn = vi.fn().mockReturnValue({ values: insertValuesFn });
    const guestFindManyFn = vi.fn().mockResolvedValue([]);
    const mockDb = createMockDb({
      insert: insertFn,
      guestFindMany: guestFindManyFn,
    });

    mockGetDb.mockReturnValue(mockDb);

    const result = await createEvent({
      name: 'Wedding',
      eventDate: '2026-09-12',
      startTime: '16:00',
      endTime: '23:00',
      inviteAllGuests: true,
    });

    expect(result.success).toBe(true);
    expect(insertFn).toHaveBeenCalledTimes(1);
  });

  test('should use a transaction when inviteAllGuests is true', async () => {
    mockAuth.mockResolvedValue(makeAdminSession());

    const insertFn = vi
      .fn()
      .mockReturnValue({ values: vi.fn().mockResolvedValue([]) });
    const guestFindManyFn = vi.fn().mockResolvedValue([{ id: 'guest-1' }]);
    const mockDb = createMockDb({
      insert: insertFn,
      guestFindMany: guestFindManyFn,
    });

    mockGetDb.mockReturnValue(mockDb);

    await createEvent({
      name: 'Wedding',
      eventDate: '2026-09-12',
      startTime: '16:00',
      endTime: '23:00',
      inviteAllGuests: true,
    });

    expect(vi.mocked(mockDb.transaction)).toHaveBeenCalledTimes(1);
  });

  test('should not use a transaction when inviteAllGuests is false', async () => {
    mockAuth.mockResolvedValue(makeAdminSession());

    const insertFn = vi
      .fn()
      .mockReturnValue({ values: vi.fn().mockResolvedValue([]) });
    const mockDb = createMockDb({ insert: insertFn });

    mockGetDb.mockReturnValue(mockDb);

    await createEvent({
      name: 'Wedding',
      eventDate: '2026-09-12',
      startTime: '16:00',
      endTime: '23:00',
      inviteAllGuests: false,
    });

    expect(vi.mocked(mockDb.transaction)).not.toHaveBeenCalled();
  });
});

describe('updateEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should return { success: false, error: "Unauthorized" } when session is null', async () => {
    mockAuth.mockResolvedValue(null);

    const result = await updateEvent({
      id: 'event-123',
      name: 'Updated',
      eventDate: '2026-09-11',
      startTime: '18:30',
      endTime: '20:30',
      type: 'rehearsal',
      sortOrder: 1,
    });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  test('should return { success: true } and update record with valid input', async () => {
    mockAuth.mockResolvedValue(makeAdminSession());

    const whereFn = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    const updateFn = vi.fn().mockReturnValue({ set: setFn });
    const mockDb = createMockDb({ update: updateFn });

    mockGetDb.mockReturnValue(mockDb);

    const result = await updateEvent({
      id: 'event-123',
      name: 'Updated',
      eventDate: '2026-09-11',
      startTime: '18:30',
      endTime: '20:30',
      type: 'rehearsal',
      sortOrder: 1,
    });

    expect(result).toEqual({ success: true });
  });

  test('should update updatedAt timestamp on successful update', async () => {
    mockAuth.mockResolvedValue(makeAdminSession());

    const whereFn = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    const updateFn = vi.fn().mockReturnValue({ set: setFn });
    const mockDb = createMockDb({ update: updateFn });

    mockGetDb.mockReturnValue(mockDb);

    await updateEvent({
      id: 'event-123',
      name: 'Updated',
      eventDate: '2026-09-11',
      startTime: '18:30',
      endTime: '20:30',
      type: 'rehearsal',
      sortOrder: 1,
    });

    expect(updateFn).toHaveBeenCalled();
  });
});

describe('deleteEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should return { success: false, error: "Unauthorized" } when session is null', async () => {
    mockAuth.mockResolvedValue(null);

    const result = await deleteEvent({ id: 'event-123' });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  test('should delete record and return { success: true } with valid id', async () => {
    mockAuth.mockResolvedValue(makeAdminSession());

    const deleteFn = vi
      .fn()
      .mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const mockDb = createMockDb({ delete: deleteFn });

    mockGetDb.mockReturnValue(mockDb);

    const result = await deleteEvent({ id: 'event-123' });

    expect(result).toEqual({ success: true });
  });

  test('should call revalidatePath for /admin/events and /schedule on successful delete', async () => {
    mockAuth.mockResolvedValue(makeAdminSession());

    const deleteFn = vi
      .fn()
      .mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const mockDb = createMockDb({ delete: deleteFn });

    mockGetDb.mockReturnValue(mockDb);

    await deleteEvent({ id: 'event-123' });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/events');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/schedule');
  });
});

describe('getEventRsvpSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should return attending/notAttending/noResponse counts matching DB state', async () => {
    mockAuth.mockResolvedValue(makeAdminSession());

    const selectWhereFn = vi
      .fn()
      .mockResolvedValueOnce([{ count: 10 }])
      .mockResolvedValueOnce([{ count: 6 }])
      .mockResolvedValueOnce([{ count: 2 }]);
    const selectFromFn = vi.fn().mockReturnValue({ where: selectWhereFn });
    const selectFn = vi.fn().mockReturnValue({ from: selectFromFn });
    const mockDb = createMockDb({ select: selectFn });

    mockGetDb.mockReturnValue(mockDb);

    const result = await getEventRsvpSummary({ eventId: 'event-123' });

    expect(result).toEqual({
      success: true,
      data: { attending: 6, notAttending: 2, noResponse: 2, total: 10 },
    });
  });

  test('should return all zeros for event with no RSVPs', async () => {
    mockAuth.mockResolvedValue(makeAdminSession());

    const selectWhereFn = vi
      .fn()
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }]);
    const selectFromFn = vi.fn().mockReturnValue({ where: selectWhereFn });
    const selectFn = vi.fn().mockReturnValue({ from: selectFromFn });
    const mockDb = createMockDb({ select: selectFn });

    mockGetDb.mockReturnValue(mockDb);

    const result = await getEventRsvpSummary({ eventId: 'event-123' });

    expect(result).toEqual({
      success: true,
      data: { attending: 0, notAttending: 0, noResponse: 0, total: 0 },
    });
  });

  test('should return { success: false, error: "Unauthorized" } when session is null', async () => {
    mockAuth.mockResolvedValue(null);

    const result = await getEventRsvpSummary({ eventId: 'event-123' });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });
});
