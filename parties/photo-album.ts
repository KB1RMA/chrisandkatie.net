import { jwtVerify } from 'jose';
import type * as Party from 'partykit/server';

/** Shape of the environment variables available to the photo-album party. */
type PhotoAlbumEnv = {
  PARTYKIT_SERVER_SECRET?: string;
  AUTH_SECRET?: string;
};

export default class PhotoAlbumParty implements Party.Server {
  constructor(public room: Party.Room) {}

  /**
   * Handles HTTP POST requests from Next.js API routes to broadcast messages.
   * Requires a valid `Authorization: Bearer <PARTYKIT_SERVER_SECRET>` header to
   * prevent unauthenticated callers from spoofing photo events.
   * Relays the POST body as a broadcast to all connected WebSocket clients.
   *
   * @param req - The incoming HTTP request from the Next.js server.
   * @returns 200 OK on POST success, 401 when the secret is missing/invalid, 405 for other methods.
   */
  async onRequest(req: Party.Request): Promise<Response> {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Validate shared secret when configured so only the Next.js server can broadcast.
    const secret = (this.room.env as PhotoAlbumEnv).PARTYKIT_SERVER_SECRET;

    if (secret) {
      const authHeader = req.headers.get('Authorization') ?? '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

      if (token !== secret) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    const message = await req.text();
    this.room.broadcast(message);

    return new Response('ok', { status: 200 });
  }

  /**
   * Called when a WebSocket client connects.
   * No initial state is sent — clients load photos via GET /api/photo-booth/photos.
   *
   * @param conn - The newly connected WebSocket connection.
   */
  onConnect(conn: Party.Connection): void {
    // No initial state — clients fetch via REST on mount
  }

  /**
   * Runs before each WebSocket upgrade request is forwarded to the Durable Object.
   * Verifies the short-lived JWT issued by `/api/photo-booth/ws-token` so that
   * only authenticated Next.js sessions can establish a real-time connection.
   *
   * This is a PartyKit static edge hook (see `Party.Worker`). Returning a
   * `Response` short-circuits the upgrade and sends that response to the client
   * instead of opening the connection; returning the original `req` allows it
   * to proceed normally.
   *
   * @see https://docs.partykit.io/reference/partyserver-api/#static-onbeforeconnect
   * @param req - The incoming WebSocket upgrade request.
   * @param lobby - The lobby context containing environment variables.
   * @returns The original request to allow the connection, or a 401 Response to reject it.
   */
  static async onBeforeConnect(
    req: Party.Request,
    lobby: Party.Lobby,
  ): Promise<Party.Request | Response> {
    const env = lobby.env as PhotoAlbumEnv;
    const authSecret = env.AUTH_SECRET;

    if (!authSecret) {
      // If AUTH_SECRET is not configured, allow the connection so local dev
      // works without any env vars (same pattern as PARTYKIT_SERVER_SECRET).
      return req;
    }

    const url = new URL(req.url);
    const token = url.searchParams.get('token') ?? '';

    if (!token) {
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      const keyBytes = new TextEncoder().encode(authSecret);

      await jwtVerify(token, keyBytes, { audience: 'partykit-ws' });

      return req;
    } catch {
      return new Response('Unauthorized', { status: 401 });
    }
  }
}

