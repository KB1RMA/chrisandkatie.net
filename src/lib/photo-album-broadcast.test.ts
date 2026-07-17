/**
 * @vitest-environment node
 */

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(),
}));

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { broadcastPhotoAlbumMessage } from './photo-album-broadcast';

const mockGetCloudflareContext = vi.mocked(getCloudflareContext);

const photoAddedMessage = {
  type: 'photo-added',
  photo: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    publicUrl: 'https://photos.example.com/a.jpg',
    width: 1920,
    height: 1080,
    uploadedAt: '2026-07-16T12:00:00.000Z',
  },
} as const;

/**
 * Creates a mock CloudflareEnv with a PHOTO_ALBUM_ROOM namespace whose stub
 * records fetch calls, plus an ExecutionContext capturing waitUntil promises.
 */
function makeContext() {
  const stubFetch = vi.fn(async () => ({ ok: true }));
  const get = vi.fn(() => ({ fetch: stubFetch }));
  const idFromName = vi.fn((name: string) => `id:${name}`);

  const env = {
    PHOTO_ALBUM_ROOM: { idFromName, get },
  } as unknown as CloudflareEnv;

  const waitUntilPromises: Promise<unknown>[] = [];
  const waitUntil = vi.fn((promise: Promise<unknown>) => {
    waitUntilPromises.push(promise);
  });

  mockGetCloudflareContext.mockReturnValue({
    env,
    ctx: { waitUntil },
  } as unknown as ReturnType<typeof getCloudflareContext>);

  /** Awaits every promise handed to waitUntil, as the runtime would. */
  const flush = () => Promise.all(waitUntilPromises);

  return { env, stubFetch, idFromName, waitUntil, flush };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('broadcastPhotoAlbumMessage', () => {
  test('registers the delivery with ctx.waitUntil so it survives the response', () => {
    const { waitUntil } = makeContext();

    broadcastPhotoAlbumMessage(photoAddedMessage);

    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  test('broadcasts to the named room via the DO binding', async () => {
    const { stubFetch, idFromName, flush } = makeContext();

    const message = { type: 'photo-removed', photoId: 'abc' } as const;

    broadcastPhotoAlbumMessage(message, 'wedding-album');
    await flush();

    expect(idFromName).toHaveBeenCalledWith('wedding-album');
    expect(stubFetch).toHaveBeenCalledTimes(1);

    const [, init] = stubFetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];

    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify(message));
  });

  test('defaults to the wedding-album room', async () => {
    const { idFromName, flush } = makeContext();

    broadcastPhotoAlbumMessage(photoAddedMessage);
    await flush();

    expect(idFromName).toHaveBeenCalledTimes(1);
    expect(idFromName).toHaveBeenCalledWith('wedding-album');
  });

  test('mirrors event-scoped messages to the wedding-album room', async () => {
    const { stubFetch, idFromName, flush } = makeContext();

    broadcastPhotoAlbumMessage(photoAddedMessage, 'event-123');
    await flush();

    expect(idFromName).toHaveBeenCalledWith('event-123');
    expect(idFromName).toHaveBeenCalledWith('wedding-album');
    expect(stubFetch).toHaveBeenCalledTimes(2);
  });

  test('does not throw when the Cloudflare context is unavailable', () => {
    mockGetCloudflareContext.mockImplementation(() => {
      throw new Error('not in a worker');
    });

    expect(() => broadcastPhotoAlbumMessage(photoAddedMessage)).not.toThrow();
  });

  test('delivery resolves even when one room stub fetch rejects', async () => {
    const { stubFetch, flush } = makeContext();

    stubFetch.mockRejectedValueOnce(new Error('room unavailable'));

    broadcastPhotoAlbumMessage(photoAddedMessage, 'event-123');

    await expect(flush()).resolves.toBeDefined();
    expect(stubFetch).toHaveBeenCalledTimes(2);
  });
});
