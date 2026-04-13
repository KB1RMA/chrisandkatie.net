import { DurableObject } from 'cloudflare:workers';

const PHOTO_ALBUM_PARTY_PATH_PREFIX = '/parties/photo-album/';

/**
 * Durable Object room that broadcasts photo booth events to connected sockets.
 *
 * WebSocket upgrades are the only requests routed here from the public
 * internet (see worker.ts). POST broadcasts arrive exclusively via internal
 * Durable Object stub calls from `notifyPartyKit`, so they need no separate
 * authentication.
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
   * @returns 101 for websocket upgrades, 200 for POST broadcasts, or 405 otherwise.
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
