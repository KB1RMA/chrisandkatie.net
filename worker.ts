// @ts-ignore generated at build time
import { default as handler } from './.open-next/worker.js';
import { handleRsvpNotificationQueue } from './src/worker/queue-consumer';
import {
  handlePhotoAlbumUpgrade,
  PhotoAlbumRoom as PhotoAlbumRoomImpl,
} from './src/worker/photo-album-room';
import type { RsvpNotificationPayload } from './src/lib/email/notification';

// Declared directly in this module so workerd's export scanner recognises the
// class name matching the `class_name` binding in wrangler.toml.
export class PhotoAlbumRoom extends PhotoAlbumRoomImpl {}

export default {
  async fetch(request, env, context) {
    // Only WebSocket upgrades reach the room from the public internet.
    // Broadcasts go through the Durable Object binding in
    // broadcastPhotoAlbumMessage, so exposing POST here would only create an
    // unauthenticated surface.
    const upgradeResponse = await handlePhotoAlbumUpgrade(request, env);

    return upgradeResponse ?? handler.fetch(request, env, context);
  },
  queue: handleRsvpNotificationQueue,
} satisfies ExportedHandler<CloudflareEnv, RsvpNotificationPayload>;
