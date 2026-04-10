/**
 * @vitest-environment node
 */

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  getAuthIdentity: vi.fn(),
}));

vi.mock('@/lib/db/repositories/guestPhotos', () => ({
  softDeletePhoto: vi.fn(),
  restorePhoto: vi.fn(),
  findGuestPhotoById: vi.fn(),
}));

vi.mock('@/lib/partykit', () => ({
  notifyPartyKit: vi.fn(),
}));

import { expect, test, describe, beforeEach, vi } from 'vitest';
import { auth, getAuthIdentity } from '@/lib/auth';
import {
  softDeletePhoto as repoSoftDelete,
  restorePhoto as repoRestore,
  findGuestPhotoById,
} from '@/lib/db/repositories/guestPhotos';
import { notifyPartyKit } from '@/lib/partykit';
import { makeSession } from '@/tests/helpers';
import { softDeletePhoto, restorePhoto } from './actions';

const mockAuth = vi.mocked(auth);
const mockGetAuthIdentity = vi.mocked(getAuthIdentity);
const mockRepoSoftDelete = vi.mocked(repoSoftDelete);
const mockRepoRestore = vi.mocked(repoRestore);
const mockFindGuestPhotoById = vi.mocked(findGuestPhotoById);
const mockNotifyPartyKit = vi.mocked(notifyPartyKit);

const VALID_PHOTO_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const adminSession = makeSession({ name: 'admin' });
const guestSession = makeSession({ name: 'guest-user' });

beforeEach(() => {
  vi.clearAllMocks();
  mockNotifyPartyKit.mockResolvedValue(undefined);
});

describe('softDeletePhoto', () => {
  test('should throw Unauthorized when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);
    mockGetAuthIdentity.mockReturnValue(null);

    await expect(softDeletePhoto({ photoId: VALID_PHOTO_ID })).rejects.toThrow(
      'Unauthorized',
    );
  });

  test('should throw Unauthorized when called by guest (not admin)', async () => {
    mockAuth.mockResolvedValue(guestSession);
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'some-invitation',
    });

    await expect(softDeletePhoto({ photoId: VALID_PHOTO_ID })).rejects.toThrow(
      'Unauthorized',
    );
  });

  test('should throw Zod validation error when photoId is not a UUID', async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });

    await expect(softDeletePhoto({ photoId: 'not-a-uuid' })).rejects.toThrow();
  });

  test('should call softDeletePhoto repository function with photoId and adminUsername', async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockGetAuthIdentity.mockReturnValue({
      type: 'admin',
      username: 'admin-user',
    });
    mockRepoSoftDelete.mockResolvedValue({
      id: VALID_PHOTO_ID,
      status: 'removed',
      r2Key: 'key',
      publicUrl: 'https://example.com/photo.jpg',
      guestId: 'guest-1',
      width: null,
      height: null,
      takenAt: null,
      uploadedAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      removedAt: '2024-01-02T00:00:00.000Z',
      removedBy: 'admin-user',
    });

    await softDeletePhoto({ photoId: VALID_PHOTO_ID });

    expect(mockRepoSoftDelete).toHaveBeenCalledWith(
      VALID_PHOTO_ID,
      'admin-user',
    );
  });

  test('should call notifyPartyKit with { type: photo-removed, photoId } after soft delete', async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockGetAuthIdentity.mockReturnValue({
      type: 'admin',
      username: 'admin-user',
    });
    mockRepoSoftDelete.mockResolvedValue({
      id: VALID_PHOTO_ID,
      status: 'removed',
      r2Key: 'key',
      publicUrl: 'https://example.com/photo.jpg',
      guestId: 'guest-1',
      width: null,
      height: null,
      takenAt: null,
      uploadedAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      removedAt: '2024-01-02T00:00:00.000Z',
      removedBy: 'admin-user',
    });

    await softDeletePhoto({ photoId: VALID_PHOTO_ID });

    expect(mockNotifyPartyKit).toHaveBeenCalledWith({
      type: 'photo-removed',
      photoId: VALID_PHOTO_ID,
    });
  });
});

describe('restorePhoto', () => {
  test('should throw Unauthorized when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);
    mockGetAuthIdentity.mockReturnValue(null);

    await expect(restorePhoto({ photoId: VALID_PHOTO_ID })).rejects.toThrow(
      'Unauthorized',
    );
  });

  test('should throw Unauthorized when called by guest', async () => {
    mockAuth.mockResolvedValue(guestSession);
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'some-invitation',
    });

    await expect(restorePhoto({ photoId: VALID_PHOTO_ID })).rejects.toThrow(
      'Unauthorized',
    );
  });

  test('should validate photoId is UUID', async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });

    await expect(restorePhoto({ photoId: 'not-a-uuid' })).rejects.toThrow();
  });

  test('should call restorePhoto repository function with photoId', async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockGetAuthIdentity.mockReturnValue({
      type: 'admin',
      username: 'admin-user',
    });
    mockRepoRestore.mockResolvedValue({
      id: VALID_PHOTO_ID,
      status: 'visible',
      r2Key: 'key',
      publicUrl: 'https://example.com/photo.jpg',
      guestId: 'guest-1',
      width: null,
      height: null,
      takenAt: null,
      uploadedAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
      removedAt: null,
      removedBy: null,
    });
    mockFindGuestPhotoById.mockResolvedValue({
      id: VALID_PHOTO_ID,
      status: 'visible',
      r2Key: 'key',
      publicUrl: 'https://example.com/photo.jpg',
      guestId: 'guest-1',
      width: null,
      height: null,
      takenAt: null,
      uploadedAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
      removedAt: null,
      removedBy: null,
    });

    await restorePhoto({ photoId: VALID_PHOTO_ID });

    expect(mockRepoRestore).toHaveBeenCalledWith(VALID_PHOTO_ID);
  });

  test('should call notifyPartyKit with { type: photo-added, photo: ... } after restore', async () => {
    const photoUrl = 'https://example.com/photo.jpg';
    const uploadedAt = '2024-01-01T00:00:00.000Z';

    mockAuth.mockResolvedValue(adminSession);
    mockGetAuthIdentity.mockReturnValue({
      type: 'admin',
      username: 'admin-user',
    });
    mockRepoRestore.mockResolvedValue({
      id: VALID_PHOTO_ID,
      status: 'visible',
      r2Key: 'key',
      publicUrl: photoUrl,
      guestId: 'guest-1',
      width: null,
      height: null,
      takenAt: null,
      uploadedAt,
      updatedAt: '2024-01-02T00:00:00.000Z',
      removedAt: null,
      removedBy: null,
    });
    mockFindGuestPhotoById.mockResolvedValue({
      id: VALID_PHOTO_ID,
      status: 'visible',
      r2Key: 'key',
      publicUrl: photoUrl,
      guestId: 'guest-1',
      width: null,
      height: null,
      takenAt: null,
      uploadedAt,
      updatedAt: '2024-01-02T00:00:00.000Z',
      removedAt: null,
      removedBy: null,
    });

    await restorePhoto({ photoId: VALID_PHOTO_ID });

    expect(mockNotifyPartyKit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'photo-added' }),
    );
  });
});
