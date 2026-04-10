/**
 * @vitest-environment node
 */

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  getAuthIdentity: vi.fn(),
}));

vi.mock('@/lib/db/repositories/guestPhotos', () => ({
  findVisiblePhotos: vi.fn(),
}));

import { describe, expect, test, beforeEach, vi } from 'vitest';
import { auth, getAuthIdentity } from '@/lib/auth';
import * as GuestPhotosRepository from '@/lib/db/repositories/guestPhotos';
import { GET } from './route';
import { makeSession } from '@/tests/helpers';
import type { GuestPhoto } from '@/lib/db/schema';

const mockAuth = vi.mocked(auth);
const mockGetAuthIdentity = vi.mocked(getAuthIdentity);
const mockFindVisiblePhotos = vi.mocked(
  GuestPhotosRepository.findVisiblePhotos,
);

/** Builds a minimal GuestPhoto fixture. */
function makePhoto(overrides: Partial<GuestPhoto> = {}): GuestPhoto {
  return {
    id: 'photo-1',
    r2Key: 'photos/photo-1.jpg',
    publicUrl: 'https://cdn.example.com/photos/photo-1.jpg',
    guestId: 'guest-1',
    status: 'visible',
    width: 1200,
    height: 1600,
    takenAt: null,
    uploadedAt: '2024-06-01T12:00:00.000Z',
    updatedAt: '2024-06-01T12:00:00.000Z',
    removedAt: null,
    removedBy: null,
    ...overrides,
  };
}

/** Builds a GET request to the photos route. */
function buildRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost/api/photo-booth/photos');

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return new Request(url.toString());
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/photo-booth/photos', () => {
  test('should return 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    mockGetAuthIdentity.mockReturnValue(null);

    const response = await GET(buildRequest());

    expect(response.status).toBe(401);
  });

  test('should return 200 with photos array for authenticated guest', async () => {
    mockAuth.mockResolvedValue(makeSession({ invitationId: 'inv-1' }));
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'inv-1',
    });
    mockFindVisiblePhotos.mockResolvedValue([makePhoto()]);

    const response = await GET(buildRequest());

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.photos).toHaveLength(1);
  });

  test('should return 200 with photos array for authenticated admin', async () => {
    mockAuth.mockResolvedValue(makeSession({ username: 'admin' }));
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    mockFindVisiblePhotos.mockResolvedValue([makePhoto()]);

    const response = await GET(buildRequest());

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.photos).toHaveLength(1);
  });

  test('should call findVisiblePhotos (not findAllPhotos) to filter visible photos', async () => {
    mockAuth.mockResolvedValue(makeSession({ invitationId: 'inv-1' }));
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'inv-1',
    });
    mockFindVisiblePhotos.mockResolvedValue([]);

    await GET(buildRequest());

    expect(mockFindVisiblePhotos).toHaveBeenCalled();
    expect(GuestPhotosRepository.findVisiblePhotos).toHaveBeenCalled();
  });

  test('should use default limit of 24 when no limit param provided', async () => {
    mockAuth.mockResolvedValue(makeSession({ invitationId: 'inv-1' }));
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'inv-1',
    });
    mockFindVisiblePhotos.mockResolvedValue([]);

    await GET(buildRequest());

    // Called with limit+1 = 25 to determine hasMore
    expect(mockFindVisiblePhotos).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 25 }),
    );
  });

  test('should pass cursor query param to repository', async () => {
    mockAuth.mockResolvedValue(makeSession({ invitationId: 'inv-1' }));
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'inv-1',
    });
    mockFindVisiblePhotos.mockResolvedValue([]);

    await GET(buildRequest({ cursor: '2024-06-01T12:00:00.000Z' }));

    expect(mockFindVisiblePhotos).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: '2024-06-01T12:00:00.000Z' }),
    );
  });

  test('should return 400 for non-integer limit', async () => {
    mockAuth.mockResolvedValue(makeSession({ invitationId: 'inv-1' }));
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'inv-1',
    });

    const response = await GET(buildRequest({ limit: 'abc' }));

    expect(response.status).toBe(400);
  });

  test('should return 400 for limit greater than 100', async () => {
    mockAuth.mockResolvedValue(makeSession({ invitationId: 'inv-1' }));
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'inv-1',
    });

    const response = await GET(buildRequest({ limit: '101' }));

    expect(response.status).toBe(400);
  });

  test('should return correct response shape with photos, nextCursor, and hasMore', async () => {
    const photo = makePhoto();

    mockAuth.mockResolvedValue(makeSession({ invitationId: 'inv-1' }));
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'inv-1',
    });
    mockFindVisiblePhotos.mockResolvedValue([photo]);

    const response = await GET(buildRequest());

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('photos');
    expect(body).toHaveProperty('nextCursor');
    expect(body).toHaveProperty('hasMore');
  });

  test('should set nextCursor to uploadedAt of last photo when hasMore is true', async () => {
    // With limit=2, request limit+1=3 photos; return 3 to signal hasMore
    const photos = [
      makePhoto({ id: 'photo-1', uploadedAt: '2024-06-03T10:00:00.000Z' }),
      makePhoto({ id: 'photo-2', uploadedAt: '2024-06-02T10:00:00.000Z' }),
      makePhoto({ id: 'photo-3', uploadedAt: '2024-06-01T10:00:00.000Z' }),
    ];

    mockAuth.mockResolvedValue(makeSession({ invitationId: 'inv-1' }));
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'inv-1',
    });
    mockFindVisiblePhotos.mockResolvedValue(photos);

    const response = await GET(buildRequest({ limit: '2' }));
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.hasMore).toBe(true);
    // nextCursor is the uploadedAt of the last photo in the trimmed result
    expect(body.nextCursor).toBe('2024-06-02T10:00:00.000Z');
    expect(body.photos).toHaveLength(2);
  });
});
