/**
 * @vitest-environment node
 */

import { describe, expect, test, vi } from 'vitest';
import { PhotoAlbumRoom, getPhotoAlbumRoom } from './photo-album-room';

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
