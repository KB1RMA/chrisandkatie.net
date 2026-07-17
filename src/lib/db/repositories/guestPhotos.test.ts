/**
 * @vitest-environment node
 */

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/photo-url', () => ({
  buildPublicUrl: vi.fn((r2Key: string) => `https://cdn.example.com/${r2Key}`),
}));

import { expect, test, describe, beforeEach, vi } from 'vitest';
import { getDb } from '@/lib/db';
import type { DbClient } from '@/lib/db';
import {
  insertGuestPhoto,
  findVisiblePhotos,
  findAllPhotos,
  findGuestPhotoById,
  softDeletePhoto,
  restorePhoto,
} from './guestPhotos';
import type { NewGuestPhotoData } from './guestPhotos';
import type { GuestPhoto } from '@/lib/db/schema';

const mockGetDb = vi.mocked(getDb);

// Derives the expected publicUrl for a photo based on the mock buildPublicUrl.
const withUrl = (photo: GuestPhoto) => ({
  ...photo,
  publicUrl: `https://cdn.example.com/${photo.r2Key}`,
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Creates a minimal GuestPhoto fixture. */
function makeGuestPhoto(overrides: Partial<GuestPhoto> = {}): GuestPhoto {
  return {
    id: 'photo-uuid-1',
    r2Key: 'photos/photo-uuid-1.jpg',
    guestId: 'guest-uuid-1',
    eventId: null,
    status: 'visible',
    width: 1920,
    height: 1080,
    takenAt: null,
    uploadedAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    removedAt: null,
    removedBy: null,
    ...overrides,
  };
}

/** Creates a minimal NewGuestPhotoData fixture. */
function makeNewGuestPhotoData(
  overrides: Partial<NewGuestPhotoData> = {},
): NewGuestPhotoData {
  return {
    id: 'photo-uuid-1',
    r2Key: 'photos/photo-uuid-1.jpg',
    guestId: 'guest-uuid-1',
    eventId: 'event-uuid-1',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

/**
 * Creates a mock Drizzle database for testing guestPhotos repository functions.
 *
 * @param overrides - Methods to override on the mock database.
 * @returns Partial DbClient with mocked methods.
 */
function createMockDb(
  overrides: Partial<{
    insertReturning: ReturnType<typeof vi.fn>;
    updateSetWhereReturning: ReturnType<typeof vi.fn>;
    selectResult: Array<
      GuestPhoto & { takenBy?: string | null; eventName?: string | null }
    >;
    findFirstResult: GuestPhoto | undefined;
  }> = {},
): DbClient {
  const photo = makeGuestPhoto();

  const insertReturningFn =
    overrides.insertReturning ?? vi.fn().mockResolvedValue([photo]);
  const insertFn = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({ returning: insertReturningFn }),
  });

  const updateSetFn = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning:
        overrides.updateSetWhereReturning ?? vi.fn().mockResolvedValue([photo]),
    }),
  });
  const updateFn = vi.fn().mockReturnValue({ set: updateSetFn });

  const selectResult = overrides.selectResult ?? [photo];
  const queryChain: {
    leftJoin?: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
  } = {
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(selectResult),
      }),
    }),
    orderBy: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue(selectResult),
    }),
  };
  queryChain.leftJoin = vi.fn().mockReturnValue(queryChain);
  const selectFromFn = vi.fn().mockReturnValue(queryChain);
  const selectFn = vi.fn().mockReturnValue({ from: selectFromFn });

  const findFirstResult =
    'findFirstResult' in overrides ? overrides.findFirstResult : photo;
  const queryGuestPhotosFindFirst = vi.fn().mockResolvedValue(findFirstResult);

  return {
    insert: insertFn,
    update: updateFn,
    select: selectFn,
    query: {
      guestPhotos: {
        findFirst: queryGuestPhotosFindFirst,
      },
    },
  } as unknown as DbClient;
}

// ---------------------------------------------------------------------------
// insertGuestPhoto
// ---------------------------------------------------------------------------

describe('insertGuestPhoto', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should insert a guest photo row and return the inserted record', async () => {
    const photo = makeGuestPhoto();
    const insertReturningFn = vi.fn().mockResolvedValue([photo]);
    const mockDb = createMockDb({ insertReturning: insertReturningFn });

    mockGetDb.mockReturnValue(mockDb);

    const result = await insertGuestPhoto(makeNewGuestPhotoData());

    expect(result).toEqual(withUrl(photo));
    expect(mockDb.insert).toHaveBeenCalledOnce();
  });

  test('should set uploadedAt and updatedAt timestamps on insert', async () => {
    const photo = makeGuestPhoto();
    const insertValuesFn = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([photo]),
    });
    const insertFn = vi.fn().mockReturnValue({ values: insertValuesFn });
    const mockDb = {
      ...createMockDb(),
      insert: insertFn,
    } as unknown as DbClient;

    mockGetDb.mockReturnValue(mockDb);

    await insertGuestPhoto(makeNewGuestPhotoData());

    const inserted = insertValuesFn.mock.calls[0][0];

    expect(inserted).toHaveProperty('uploadedAt');
    expect(inserted).toHaveProperty('updatedAt');
  });

  test('should call getDb once', async () => {
    const mockDb = createMockDb();

    mockGetDb.mockReturnValue(mockDb);

    await insertGuestPhoto(makeNewGuestPhotoData());

    expect(mockGetDb).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// findVisiblePhotos
// ---------------------------------------------------------------------------

describe('findVisiblePhotos', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should return an array of visible photos', async () => {
    const photos = [makeGuestPhoto(), makeGuestPhoto({ id: 'photo-uuid-2' })];
    const mockDb = createMockDb({ selectResult: photos });

    mockGetDb.mockReturnValue(mockDb);

    const result = await findVisiblePhotos({ limit: 20 });

    expect(result).toEqual(photos.map(withUrl));
  });

  test('should accept an optional cursor for pagination', async () => {
    const mockDb = createMockDb();

    mockGetDb.mockReturnValue(mockDb);

    await findVisiblePhotos({ limit: 20, cursor: '2024-01-01T00:00:00.000Z' });

    expect(mockGetDb).toHaveBeenCalledOnce();
  });

  test('should call getDb once', async () => {
    const mockDb = createMockDb();

    mockGetDb.mockReturnValue(mockDb);

    await findVisiblePhotos({ limit: 10 });

    expect(mockGetDb).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// findAllPhotos
// ---------------------------------------------------------------------------

describe('findAllPhotos', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should return all photos regardless of status', async () => {
    const photos = [
      makeGuestPhoto(),
      makeGuestPhoto({ id: 'photo-uuid-2', status: 'removed' }),
    ];
    const mockDb = createMockDb({ selectResult: photos });

    mockGetDb.mockReturnValue(mockDb);

    const result = await findAllPhotos({ limit: 20 });

    expect(result).toEqual(photos.map(withUrl));
  });

  test('should accept an optional cursor for pagination', async () => {
    const mockDb = createMockDb();

    mockGetDb.mockReturnValue(mockDb);

    await findAllPhotos({ limit: 20, cursor: '2024-01-01T00:00:00.000Z' });

    expect(mockGetDb).toHaveBeenCalledOnce();
  });

  test('should include takenBy and eventName from the joined tables', async () => {
    const photos = [
      { ...makeGuestPhoto(), takenBy: 'Alice', eventName: 'Reception' },
      {
        ...makeGuestPhoto({ id: 'photo-uuid-2' }),
        takenBy: null,
        eventName: null,
      },
    ];
    const mockDb = createMockDb({ selectResult: photos });

    mockGetDb.mockReturnValue(mockDb);

    const result = await findAllPhotos({ limit: 20 });

    expect(result).toEqual(photos.map(withUrl));
  });

  test('should filter by eventId when provided', async () => {
    const whereFn = vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    });
    const queryChain: Record<string, unknown> = { where: whereFn };
    queryChain['leftJoin'] = vi.fn().mockReturnValue(queryChain);
    const mockDb = {
      ...createMockDb(),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue(queryChain),
      }),
    } as unknown as DbClient;

    mockGetDb.mockReturnValue(mockDb);

    await findAllPhotos({ limit: 20, eventId: 'event-uuid-1' });

    expect(whereFn).toHaveBeenCalledOnce();
    expect(whereFn.mock.calls[0][0]).toBeDefined();
  });

  test('should call getDb once', async () => {
    const mockDb = createMockDb();

    mockGetDb.mockReturnValue(mockDb);

    await findAllPhotos({ limit: 10 });

    expect(mockGetDb).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// findGuestPhotoById
// ---------------------------------------------------------------------------

describe('findGuestPhotoById', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should return a photo when found', async () => {
    const photo = makeGuestPhoto();
    const mockDb = createMockDb({ findFirstResult: photo });

    mockGetDb.mockReturnValue(mockDb);

    const result = await findGuestPhotoById('photo-uuid-1');

    expect(result).toEqual(withUrl(photo));
  });

  test('should return undefined when not found', async () => {
    const mockDb = createMockDb({ findFirstResult: undefined });

    mockGetDb.mockReturnValue(mockDb);

    const result = await findGuestPhotoById('nonexistent-id');

    expect(result).toBeUndefined();
  });

  test('should call getDb once', async () => {
    const mockDb = createMockDb();

    mockGetDb.mockReturnValue(mockDb);

    await findGuestPhotoById('photo-uuid-1');

    expect(mockGetDb).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// softDeletePhoto
// ---------------------------------------------------------------------------

describe('softDeletePhoto', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should return the updated photo with removed status', async () => {
    const removedPhoto = makeGuestPhoto({
      status: 'removed',
      removedBy: 'admin',
    });
    const updateSetWhereReturningFn = vi.fn().mockResolvedValue([removedPhoto]);
    const mockDb = createMockDb({
      updateSetWhereReturning: updateSetWhereReturningFn,
    });

    mockGetDb.mockReturnValue(mockDb);

    const result = await softDeletePhoto('photo-uuid-1', 'admin');

    expect(result).toEqual(withUrl(removedPhoto));
    expect(mockDb.update).toHaveBeenCalledOnce();
  });

  test('should call getDb once', async () => {
    const mockDb = createMockDb();

    mockGetDb.mockReturnValue(mockDb);

    await softDeletePhoto('photo-uuid-1', 'admin');

    expect(mockGetDb).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// restorePhoto
// ---------------------------------------------------------------------------

describe('restorePhoto', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should return the restored photo with visible status', async () => {
    const restoredPhoto = makeGuestPhoto({ status: 'visible' });
    const updateSetWhereReturningFn = vi
      .fn()
      .mockResolvedValue([restoredPhoto]);
    const mockDb = createMockDb({
      updateSetWhereReturning: updateSetWhereReturningFn,
    });

    mockGetDb.mockReturnValue(mockDb);

    const result = await restorePhoto('photo-uuid-1');

    expect(result).toEqual(withUrl(restoredPhoto));
    expect(mockDb.update).toHaveBeenCalledOnce();
  });

  test('should call getDb once', async () => {
    const mockDb = createMockDb();

    mockGetDb.mockReturnValue(mockDb);

    await restorePhoto('photo-uuid-1');

    expect(mockGetDb).toHaveBeenCalledOnce();
  });
});
