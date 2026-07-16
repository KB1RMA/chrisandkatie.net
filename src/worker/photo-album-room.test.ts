/**
 * @vitest-environment node
 */

vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => ({})),
}));

vi.mock('@/lib/db/repositories/events', () => ({
  eventExistsById: vi.fn(),
}));

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { eventExistsById } from '@/lib/db/repositories/events';
import {
  PhotoAlbumRoom,
  getPhotoAlbumRoom,
  handlePhotoAlbumUpgrade,
} from './photo-album-room';

const mockEventExistsById = vi.mocked(eventExistsById);

type MockSocket = { send: ReturnType<typeof vi.fn> };

/**
 * Creates a PhotoAlbumRoom backed by a mock DurableObjectState.
 */
function makeRoom(sockets: MockSocket[] = []) {
  const ctx = {
    acceptWebSocket: vi.fn(),
    getWebSockets: vi.fn(() => sockets),
  };

  const room = new PhotoAlbumRoom(
    ctx as unknown as DurableObjectState,
    {} as CloudflareEnv,
  );

  return { room, ctx };
}

/**
 * Creates a mock CloudflareEnv with a PHOTO_ALBUM_ROOM namespace whose stub
 * records fetch calls.
 */
function makeEnv() {
  // Node's Response rejects status 101, so the stub returns an ordinary
  // response — the assertions only care about identity, not the status.
  const stubResponse = new Response('upgraded');
  const stubFetch = vi.fn(async () => stubResponse);
  const get = vi.fn(() => ({ fetch: stubFetch }));
  const idFromName = vi.fn((name: string) => `id:${name}`);

  const env = {
    DB: {},
    PHOTO_ALBUM_ROOM: { idFromName, get },
  } as unknown as CloudflareEnv;

  return { env, stubFetch, idFromName, stubResponse };
}

/** Builds a WebSocket upgrade request for the given path. */
function makeUpgradeRequest(path: string) {
  return new Request(`https://chrisandkatie.net${path}`, {
    headers: { Upgrade: 'websocket' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PhotoAlbumRoom', () => {
  test('broadcasts a POSTed message to every connected socket', async () => {
    const sockets = [{ send: vi.fn() }, { send: vi.fn() }];
    const { room } = makeRoom(sockets);
    const body = JSON.stringify({ type: 'photo-added', photo: { id: '1' } });

    const response = await room.fetch(
      new Request('https://photo-album.internal/broadcast', {
        method: 'POST',
        body,
      }),
    );

    expect(response.status).toBe(200);
    sockets.forEach((socket) => {
      expect(socket.send).toHaveBeenCalledWith(body);
    });
  });

  test('keeps broadcasting when one socket send throws', async () => {
    const failing = {
      send: vi.fn(() => {
        throw new Error('socket closed');
      }),
    };
    const healthy = { send: vi.fn() };
    const { room } = makeRoom([failing, healthy]);

    const response = await room.fetch(
      new Request('https://photo-album.internal/broadcast', {
        method: 'POST',
        body: 'hello',
      }),
    );

    expect(response.status).toBe(200);
    expect(healthy.send).toHaveBeenCalledWith('hello');
  });

  test('rejects non-upgrade, non-POST requests with 405', async () => {
    const { room, ctx } = makeRoom();

    const response = await room.fetch(
      new Request('https://photo-album.internal/broadcast'),
    );

    expect(response.status).toBe(405);
    expect(ctx.acceptWebSocket).not.toHaveBeenCalled();
  });

  test('rejects POSTs to paths other than /broadcast with 404', async () => {
    const socket = { send: vi.fn() };
    const { room } = makeRoom([socket]);

    const response = await room.fetch(
      new Request('https://photo-album.internal/other', {
        method: 'POST',
        body: 'hello',
      }),
    );

    expect(response.status).toBe(404);
    expect(socket.send).not.toHaveBeenCalled();
  });
});

describe('getPhotoAlbumRoom', () => {
  test('returns the room name for a photo-album path', () => {
    expect(getPhotoAlbumRoom('/parties/photo-album/wedding-album')).toBe(
      'wedding-album',
    );
  });

  test('decodes percent-encoded room names', () => {
    expect(getPhotoAlbumRoom('/parties/photo-album/my%20room')).toBe('my room');
  });

  test('ignores trailing path segments', () => {
    expect(getPhotoAlbumRoom('/parties/photo-album/room-a/extra')).toBe(
      'room-a',
    );
  });

  test('returns null for non-matching paths', () => {
    expect(getPhotoAlbumRoom('/api/photo-booth/photos')).toBeNull();
  });

  test('returns null when the room segment is empty', () => {
    expect(getPhotoAlbumRoom('/parties/photo-album/')).toBeNull();
  });

  test('returns null for malformed percent-encoding instead of throwing', () => {
    expect(getPhotoAlbumRoom('/parties/photo-album/%E0%A4%A')).toBeNull();
  });
});

describe('handlePhotoAlbumUpgrade', () => {
  test('returns null for non-photo-album paths', async () => {
    const { env, stubFetch } = makeEnv();

    const result = await handlePhotoAlbumUpgrade(
      makeUpgradeRequest('/api/photo-booth/photos'),
      env,
    );

    expect(result).toBeNull();
    expect(stubFetch).not.toHaveBeenCalled();
  });

  test('returns null for photo-album paths without a websocket upgrade', async () => {
    const { env, stubFetch } = makeEnv();

    const result = await handlePhotoAlbumUpgrade(
      new Request(
        'https://chrisandkatie.net/parties/photo-album/wedding-album',
      ),
      env,
    );

    expect(result).toBeNull();
    expect(stubFetch).not.toHaveBeenCalled();
  });

  test('routes wedding-album upgrades to the room without a DB lookup', async () => {
    const { env, stubFetch, idFromName, stubResponse } = makeEnv();

    const result = await handlePhotoAlbumUpgrade(
      makeUpgradeRequest('/parties/photo-album/wedding-album'),
      env,
    );

    expect(result).toBe(stubResponse);
    expect(idFromName).toHaveBeenCalledWith('wedding-album');
    expect(stubFetch).toHaveBeenCalledTimes(1);
    expect(mockEventExistsById).not.toHaveBeenCalled();
  });

  test('routes upgrades for known event rooms to the room', async () => {
    const { env, stubFetch, idFromName, stubResponse } = makeEnv();

    mockEventExistsById.mockResolvedValue(true);

    const result = await handlePhotoAlbumUpgrade(
      makeUpgradeRequest('/parties/photo-album/event-123'),
      env,
    );

    expect(result).toBe(stubResponse);
    expect(mockEventExistsById).toHaveBeenCalledWith('event-123', {});
    expect(idFromName).toHaveBeenCalledWith('event-123');
    expect(stubFetch).toHaveBeenCalledTimes(1);
  });

  test('rejects upgrades for unknown rooms with 404', async () => {
    const { env, stubFetch } = makeEnv();

    mockEventExistsById.mockResolvedValue(false);

    const result = await handlePhotoAlbumUpgrade(
      makeUpgradeRequest('/parties/photo-album/not-a-real-room'),
      env,
    );

    expect(result?.status).toBe(404);
    expect(stubFetch).not.toHaveBeenCalled();
  });
});
