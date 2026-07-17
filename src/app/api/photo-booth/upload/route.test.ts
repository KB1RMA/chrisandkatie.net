/**
 * @vitest-environment node
 */

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  getAuthIdentity: vi.fn(),
}));

vi.mock('@/lib/db/repositories/guestPhotos', () => ({
  insertGuestPhoto: vi.fn(),
}));

vi.mock('@/lib/db/repositories/invitations', () => ({
  findInvitationWithGuests: vi.fn(),
}));

vi.mock('@/lib/db/repositories/events', () => ({
  findEventsByInvitationId: vi.fn(),
}));

vi.mock('@/lib/photo-album-broadcast', () => ({
  broadcastPhotoAlbumMessage: vi.fn(),
}));

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(),
}));

import { describe, expect, test, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { auth, getAuthIdentity } from '@/lib/auth';
import { insertGuestPhoto } from '@/lib/db/repositories/guestPhotos';
import { findInvitationWithGuests } from '@/lib/db/repositories/invitations';
import { findEventsByInvitationId } from '@/lib/db/repositories/events';
import { broadcastPhotoAlbumMessage } from '@/lib/photo-album-broadcast';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { POST } from './route';

const mockAuth = vi.mocked(auth);
const mockGetAuthIdentity = vi.mocked(getAuthIdentity);
const mockInsertGuestPhoto = vi.mocked(insertGuestPhoto);
const mockFindInvitationWithGuests = vi.mocked(findInvitationWithGuests);
const mockFindEventsByInvitationId = vi.mocked(findEventsByInvitationId);
const mockBroadcast = vi.mocked(broadcastPhotoAlbumMessage);
const mockGetCloudflareContext = vi.mocked(getCloudflareContext);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_INVITATION_ID = 'inv-00000000-0000-0000-0000-000000000001';
const MOCK_GUEST_ID = 'gst-00000000-0000-0000-0000-000000000001';
const MOCK_R2_PUBLIC_DOMAIN = 'test.example.com';

const mockR2Bucket = {
  put: vi.fn().mockResolvedValue(undefined),
};

const guestSession = {
  user: { invitationId: MOCK_INVITATION_ID },
  expires: new Date(Date.now() + 86400_000).toISOString(),
};

const guestIdentity = {
  type: 'guest' as const,
  invitationId: MOCK_INVITATION_ID,
};
const adminIdentity = { type: 'admin' as const, username: 'admin' };

const mockInvitation = {
  id: MOCK_INVITATION_ID,
  guests: [
    {
      id: MOCK_GUEST_ID,
      invitationId: MOCK_INVITATION_ID,
      firstName: 'Alice',
      lastName: 'Test',
    },
  ],
};

const MOCK_EVENT_ID = 'event-wedding-main';

const insertedPhoto = {
  id: 'photo-uuid-1234',
  r2Key: `guest-photos/2024-01-01T00:00:00.000Z/photo-uuid-1234.jpg`,
  publicUrl: `https://${MOCK_R2_PUBLIC_DOMAIN}/guest-photos/2024-01-01T00:00:00.000Z/photo-uuid-1234.jpg`,
  guestId: MOCK_GUEST_ID,
  eventId: null,
  status: 'visible' as const,
  uploadedAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  width: null,
  height: null,
  takenAt: null,
  removedAt: null,
  removedBy: null,
};

/**
 * Creates a NextRequest with multipart form data for upload tests.
 *
 * @param file - Optional file to include in the form data.
 * @param extraFields - Additional form fields to append.
 * @returns A configured NextRequest.
 */
function makeUploadRequest(
  file?: File,
  extraFields: Record<string, string> = {},
): NextRequest {
  const formData = new FormData();

  if (file) {
    formData.append('photo', file);
  }

  for (const [key, value] of Object.entries(extraFields)) {
    formData.append(key, value);
  }

  return new NextRequest('http://localhost/api/photo-booth/upload', {
    method: 'POST',
    body: formData,
  });
}

/**
 * Creates a minimal JPEG-like File for testing purposes.
 *
 * @param sizeBytes - Approximate file size in bytes.
 * @param mimeType - MIME type for the file.
 * @returns A File object with the specified size and type.
 */
function makeImageFile(sizeBytes = 1024, mimeType = 'image/jpeg'): File {
  const buffer = new Uint8Array(sizeBytes).fill(0xff);

  return new File([buffer], 'test-photo.jpg', { type: mimeType });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/photo-booth/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set R2 base URL for public URL construction in the route
    process.env.R2_PUBLIC_BASE_URL = `https://${MOCK_R2_PUBLIC_DOMAIN}`;

    mockGetCloudflareContext.mockReturnValue({
      env: {
        GUEST_PHOTOS_BUCKET: mockR2Bucket,
      },
    } as unknown as ReturnType<typeof getCloudflareContext>);

    mockFindInvitationWithGuests.mockResolvedValue(mockInvitation as never);
    mockFindEventsByInvitationId.mockResolvedValue([
      { id: MOCK_EVENT_ID } as never,
    ]);
    mockInsertGuestPhoto.mockResolvedValue(insertedPhoto);
  });

  test('should return 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    mockGetAuthIdentity.mockReturnValue(null);

    const request = makeUploadRequest(makeImageFile());
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  test('should return 401 when session is admin (not guest)', async () => {
    mockAuth.mockResolvedValue(guestSession as never);
    mockGetAuthIdentity.mockReturnValue(adminIdentity);

    const request = makeUploadRequest(makeImageFile());
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  test('should return 400 with MISSING_FILE when no photo field', async () => {
    mockAuth.mockResolvedValue(guestSession as never);
    mockGetAuthIdentity.mockReturnValue(guestIdentity);

    const request = makeUploadRequest(); // No file
    const response = await POST(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(body.error).toBe('MISSING_FILE');
  });

  test('should return 400 with INVALID_MIME when file is not image/*', async () => {
    mockAuth.mockResolvedValue(guestSession as never);
    mockGetAuthIdentity.mockReturnValue(guestIdentity);

    const nonImageFile = new File(['text content'], 'file.txt', {
      type: 'text/plain',
    });
    const request = makeUploadRequest(nonImageFile);
    const response = await POST(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(body.error).toBe('INVALID_MIME');
  });

  test('should return 413 when file exceeds 10 MB', async () => {
    mockAuth.mockResolvedValue(guestSession as never);
    mockGetAuthIdentity.mockReturnValue(guestIdentity);

    const largeFile = makeImageFile(11 * 1024 * 1024);
    const request = makeUploadRequest(largeFile);
    const response = await POST(request);

    expect(response.status).toBe(413);
  });

  test('should return 201 with id, publicUrl, and uploadedAt on valid upload', async () => {
    mockAuth.mockResolvedValue(guestSession as never);
    mockGetAuthIdentity.mockReturnValue(guestIdentity);

    const request = makeUploadRequest(makeImageFile(), {
      eventId: MOCK_EVENT_ID,
    });
    const response = await POST(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      id: expect.any(String),
      publicUrl: expect.stringContaining(MOCK_R2_PUBLIC_DOMAIN),
      uploadedAt: expect.any(String),
    });
  });

  test('should call R2 put with correct key format (guest-photos/{timestamp}/{uuid}.jpg)', async () => {
    mockAuth.mockResolvedValue(guestSession as never);
    mockGetAuthIdentity.mockReturnValue(guestIdentity);

    const request = makeUploadRequest(makeImageFile(), {
      eventId: MOCK_EVENT_ID,
    });
    await POST(request);

    expect(mockR2Bucket.put).toHaveBeenCalledOnce();

    const [r2Key] = mockR2Bucket.put.mock.calls[0];

    expect(r2Key).toMatch(/^guest-photos\/[^/]+\/[a-f0-9-]+\.jpg$/);
  });

  test('should call insertGuestPhoto after R2 write', async () => {
    mockAuth.mockResolvedValue(guestSession as never);
    mockGetAuthIdentity.mockReturnValue(guestIdentity);

    const request = makeUploadRequest(makeImageFile(), {
      eventId: MOCK_EVENT_ID,
    });
    await POST(request);

    expect(mockInsertGuestPhoto).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        id: expect.any(String),
        r2Key: expect.stringMatching(/^guest-photos\//),
        guestId: MOCK_GUEST_ID,
      }),
    );
  });

  test('should call broadcastPhotoAlbumMessage with photo-added message after insert', async () => {
    mockAuth.mockResolvedValue(guestSession as never);
    mockGetAuthIdentity.mockReturnValue(guestIdentity);

    const request = makeUploadRequest(makeImageFile(), {
      eventId: MOCK_EVENT_ID,
    });
    await POST(request);

    // Allow fire-and-forget to execute
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'photo-added' }),
      MOCK_EVENT_ID,
    );
  });
});
