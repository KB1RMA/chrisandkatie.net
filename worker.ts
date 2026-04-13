// @ts-ignore generated at build time
import { default as handler } from './.open-next/worker.js';
import { handleRsvpNotificationQueue } from './src/worker/queue-consumer';
import {
  getPhotoAlbumRoom,
  PhotoAlbumRoom as PhotoAlbumRoomImpl,
} from './src/worker/photo-album-room';
import type { RsvpNotificationPayload } from './src/lib/email/notification';

// Declared directly in this module so workerd's export scanner recognises the
// class name matching the `class_name` binding in wrangler.toml.
export class PhotoAlbumRoom extends PhotoAlbumRoomImpl {}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    const room = getPhotoAlbumRoom(url.pathname);
    const upgrade = request.headers.get('Upgrade')?.toLowerCase();

    // Only WebSocket upgrades reach the room from the public internet.
    // Broadcasts go through the Durable Object binding in notifyPartyKit,
    // so exposing POST here would only create an unauthenticated surface.
    if (!room || upgrade !== 'websocket') {
      return handler.fetch(request, env, context);
    }

    const roomId = env.PHOTO_ALBUM_ROOM.idFromName(room);
    const roomStub = env.PHOTO_ALBUM_ROOM.get(roomId);

    return roomStub.fetch(request);
  },
  queue: handleRsvpNotificationQueue,
} satisfies ExportedHandler<CloudflareEnv, RsvpNotificationPayload>;
