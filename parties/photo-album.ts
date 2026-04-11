import type * as Party from 'partykit/server';

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
    const secret = (this.room.env as Record<string, string | undefined>)
      .PARTYKIT_SERVER_SECRET;

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
}
