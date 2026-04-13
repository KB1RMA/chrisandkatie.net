import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { PhotoAlbumMessage } from '@/lib/schemas/photo-booth';

/**
 * Notifies a photo-album room by broadcasting a message to its connected
 * WebSocket clients via the PHOTO_ALBUM_ROOM Durable Object binding.
 *
 * Calling the binding directly (instead of fetching the public URL) keeps the
 * broadcast path internal — the public route only accepts WebSocket upgrades,
 * so unauthenticated callers cannot inject events.
 *
 * Fire-and-forget — errors are swallowed so upstream callers are not affected.
 *
 * @param message - The typed message object to broadcast to all connected clients.
 * @param room - The room name to notify. Defaults to `wedding-album`.
 */
export async function notifyPartyKit(
  message: PhotoAlbumMessage,
  room = 'wedding-album',
): Promise<void> {
  try {
    const { env } = getCloudflareContext();
    const roomId = env.PHOTO_ALBUM_ROOM.idFromName(room);
    const roomStub = env.PHOTO_ALBUM_ROOM.get(roomId);

    await roomStub.fetch('https://photo-album.internal/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
  } catch {
    // Broadcast failures (or a missing binding outside the worker runtime)
    // must never affect the caller.
  }
}
