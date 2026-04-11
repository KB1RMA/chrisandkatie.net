/**
 * Notifies a PartyKit photo-album room by posting a broadcast message.
 * Fire-and-forget — errors are swallowed so upstream callers are not affected.
 * When `PARTYKIT_SERVER_SECRET` is set the request includes a Bearer token so
 * the PartyKit host can reject unauthenticated broadcasts.
 *
 * @param message - The typed message object to broadcast to all connected clients.
 * @param room - The PartyKit room name to notify. Defaults to `wedding-album`.
 */
export async function notifyPartyKit(
  message: object,
  room = 'wedding-album',
): Promise<void> {
  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST;

  if (!host) {
    return;
  }

  const url = `https://${host}/parties/photo-album/${encodeURIComponent(room)}`;
  const secret = process.env.PARTYKIT_SERVER_SECRET;

  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify(message),
  }).catch(() => undefined);
}
