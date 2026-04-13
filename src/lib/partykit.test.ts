/**
 * @vitest-environment node
 */

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(),
}));

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { notifyPartyKit } from './partykit';

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
 * records fetch calls.
 */
function makeEnv() {
  const stubFetch = vi.fn(async () => ({ ok: true }));
  const get = vi.fn(() => ({ fetch: stubFetch }));
  const idFromName = vi.fn((name: string) => `id:${name}`);

  const env = {
    PHOTO_ALBUM_ROOM: { idFromName, get },
  } as unknown as CloudflareEnv;

  return { env, stubFetch, idFromName };
}

function mockContext(env: CloudflareEnv) {
  mockGetCloudflareContext.mockReturnValue({
    env,
  } as unknown as ReturnType<typeof getCloudflareContext>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('notifyPartyKit', () => {
  test('broadcasts the message to the named room via the DO binding', async () => {
    const { env, stubFetch, idFromName } = makeEnv();

    mockContext(env);

    const message = { type: 'photo-removed', photoId: 'abc' } as const;

    await notifyPartyKit(message, 'event-123');

    expect(idFromName).toHaveBeenCalledWith('event-123');
    expect(stubFetch).toHaveBeenCalledTimes(1);

    const [, init] = stubFetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];

    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify(message));
  });

  test('defaults to the wedding-album room', async () => {
    const { env, idFromName } = makeEnv();

    mockContext(env);

    await notifyPartyKit(photoAddedMessage);

    expect(idFromName).toHaveBeenCalledWith('wedding-album');
  });

  test('resolves silently when the Cloudflare context is unavailable', async () => {
    mockGetCloudflareContext.mockImplementation(() => {
      throw new Error('not in a worker');
    });

    await expect(notifyPartyKit(photoAddedMessage)).resolves.toBeUndefined();
  });

  test('resolves silently when the room stub fetch rejects', async () => {
    const { env, stubFetch } = makeEnv();

    stubFetch.mockRejectedValue(new Error('room unavailable'));
    mockContext(env);

    await expect(notifyPartyKit(photoAddedMessage)).resolves.toBeUndefined();
  });
});
