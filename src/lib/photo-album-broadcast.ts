import { getCloudflareContext } from '@opennextjs/cloudflare';
import {
  WEDDING_ALBUM_ROOM,
  type PhotoAlbumMessage,
} from '@/lib/schemas/photo-booth';

/**
 * Posts a message to a single photo-album room's internal broadcast endpoint.
 * Failures are swallowed so one unreachable room never affects the others.
 */
async function postToRoom(
  env: CloudflareEnv,
  room: string,
  message: PhotoAlbumMessage,
): Promise<void> {
  try {
    const roomId = env.PHOTO_ALBUM_ROOM.idFromName(room);
    const roomStub = env.PHOTO_ALBUM_ROOM.get(roomId);

    await roomStub.fetch('https://photo-album.internal/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
  } catch {
    // Broadcast failures must never affect the caller.
  }
}

/**
 * Broadcasts a photo-album message to the room's connected WebSocket clients
 * via the PHOTO_ALBUM_ROOM Durable Object binding.
 *
 * Calling the binding directly (instead of fetching the public URL) keeps the
 * broadcast path internal — the public route only accepts WebSocket upgrades,
 * so unauthenticated callers cannot inject events.
 *
 * Event-scoped messages are also mirrored to the main wedding-album room,
 * because the main album displays photos from every event.
 *
 * Fire-and-forget — the delivery runs under `ctx.waitUntil` so it completes
 * after the response is sent, and errors are swallowed so upstream callers
 * are never affected.
 *
 * @param message - The typed message object to broadcast to all connected clients.
 * @param room - The room name to notify. Defaults to `wedding-album`.
 */
export function broadcastPhotoAlbumMessage(
  message: PhotoAlbumMessage,
  room = WEDDING_ALBUM_ROOM,
): void {
  try {
    const { env, ctx } = getCloudflareContext();
    const rooms =
      room === WEDDING_ALBUM_ROOM ? [room] : [room, WEDDING_ALBUM_ROOM];

    ctx.waitUntil(
      Promise.all(rooms.map((target) => postToRoom(env, target, message))),
    );
  } catch {
    // A missing Cloudflare context (outside the worker runtime) must never
    // affect the caller.
  }
}
