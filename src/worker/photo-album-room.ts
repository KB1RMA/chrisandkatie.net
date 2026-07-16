import { DurableObject } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '@/lib/db/schema';
import { eventExistsById } from '@/lib/db/repositories/events';
import { WEDDING_ALBUM_ROOM } from '@/lib/schemas/photo-booth';

const PHOTO_ALBUM_PARTY_PATH_PREFIX = '/parties/photo-album/';
const BROADCAST_PATH = '/broadcast';

/**
 * Durable Object room that broadcasts photo booth events to connected sockets.
 *
 * WebSocket upgrades are the only requests routed here from the public
 * internet (see worker.ts). POST broadcasts arrive exclusively via internal
 * Durable Object stub calls from `broadcastPhotoAlbumMessage`, so they need
 * no separate authentication.
 *
 * Sockets are registered with the Durable Object state (hibernatable
 * WebSockets) so connections survive eviction and the object can be evicted
 * from memory while sockets stay open.
 */
export class PhotoAlbumRoom extends DurableObject<CloudflareEnv> {
  /**
   * Handles websocket upgrades and internal photo event broadcasts.
   *
   * @param request - Incoming request for this room instance.
   * @returns 101 for websocket upgrades, 200 for POST broadcasts, 404 for
   *   unknown paths, or 405 for other methods.
   */
  async fetch(request: Request): Promise<Response> {
    const upgrade = request.headers.get('Upgrade')?.toLowerCase();

    if (upgrade === 'websocket') {
      const pair = new WebSocketPair();
      const [clientSocket, serverSocket] = Object.values(pair);

      this.ctx.acceptWebSocket(serverSocket);

      return new Response(null, { status: 101, webSocket: clientSocket });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (new URL(request.url).pathname !== BROADCAST_PATH) {
      return new Response('Not Found', { status: 404 });
    }

    const message = await request.text();

    this.ctx.getWebSockets().forEach((socket) => {
      try {
        socket.send(message);
      } catch {
        // Socket already closed — the runtime removes it from getWebSockets()
      }
    });

    return new Response('ok', { status: 200 });
  }

  /** Clients never send messages; ignore anything received. */
  webSocketMessage(): void {}

  /** No per-socket state to clean up — hibernation API tracks sockets. */
  webSocketClose(): void {}

  webSocketError(): void {}
}

/**
 * Parses a request pathname and returns the photo album room name when matched.
 *
 * @param pathname - Request pathname to evaluate.
 * @returns Decoded room name or null when pathname does not target photo-album route.
 */
export function getPhotoAlbumRoom(pathname: string): string | null {
  if (!pathname.startsWith(PHOTO_ALBUM_PARTY_PATH_PREFIX)) {
    return null;
  }

  const encodedRoom = pathname.slice(PHOTO_ALBUM_PARTY_PATH_PREFIX.length);
  const encodedRoomSegment = encodedRoom.split('/')[0];

  if (!encodedRoomSegment) {
    return null;
  }

  try {
    return decodeURIComponent(encodedRoomSegment);
  } catch {
    return null;
  }
}

/**
 * Routes a photo-album WebSocket upgrade to its Durable Object room.
 *
 * Room names are restricted to the main wedding album and existing event ids,
 * so arbitrary paths cannot subscribe to unknown rooms or spawn unbounded
 * Durable Object instances.
 *
 * @param request - Incoming worker request.
 * @param env - Cloudflare environment bindings.
 * @returns The room's upgrade response, 404 for unknown rooms, or null when
 *   the request is not a photo-album WebSocket upgrade.
 */
export async function handlePhotoAlbumUpgrade(
  request: Request,
  env: CloudflareEnv,
): Promise<Response | null> {
  const room = getPhotoAlbumRoom(new URL(request.url).pathname);
  const upgrade = request.headers.get('Upgrade')?.toLowerCase();

  if (!room || upgrade !== 'websocket') {
    return null;
  }

  if (room !== WEDDING_ALBUM_ROOM) {
    const db = drizzle(env.DB, { schema });
    const isKnownEvent = await eventExistsById(room, db);

    if (!isKnownEvent) {
      return new Response('Unknown room', { status: 404 });
    }
  }

  const roomId = env.PHOTO_ALBUM_ROOM.idFromName(room);
  const roomStub = env.PHOTO_ALBUM_ROOM.get(roomId);

  return roomStub.fetch(request);
}
