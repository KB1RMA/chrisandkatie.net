import type * as Party from 'partykit/server';

export default class PhotoAlbumParty implements Party.Server {
  constructor(public room: Party.Room) {}

  /**
   * Handles HTTP POST requests from Next.js API routes to broadcast messages.
   * Relays the POST body as a broadcast to all connected WebSocket clients.
   *
   * @param req - The incoming HTTP request from the Next.js server.
   * @returns 200 OK on POST success, 405 for other methods.
   */
  async onRequest(req: Party.Request): Promise<Response> {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
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
