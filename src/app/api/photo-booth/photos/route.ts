import { auth, getAuthIdentity } from '@/lib/auth';
import { findVisiblePhotos } from '@/lib/db/repositories/guestPhotos';
import { findEventsByInvitationId } from '@/lib/db/repositories/events';

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

/**
 * GET /api/photo-booth/photos
 *
 * Returns a paginated list of visible guest photos.
 * Supports cursor-based pagination via `cursor` and `limit` query params.
 * When `eventId` is provided, verifies the authenticated guest is invited to
 * that event before returning scoped photos.
 *
 * @param request - The incoming HTTP request.
 * @returns 200 JSON with `photos`, `nextCursor`, and `hasMore`; 401 if unauthenticated; 400 for invalid params; 403 if the guest is not invited to the requested event.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  const identity = getAuthIdentity(session);

  if (!identity) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const cursorParam = url.searchParams.get('cursor') ?? undefined;
  const limitParam = url.searchParams.get('limit');
  const eventIdParam = url.searchParams.get('eventId') ?? undefined;

  // For guest sessions, validate the requested event is visible to their invitation
  if (eventIdParam && identity.type === 'guest') {
    const visibleEvents = await findEventsByInvitationId(identity.invitationId);
    const isAllowed = visibleEvents.some((e) => e.id === eventIdParam);

    if (!isAllowed) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  let effectiveLimit = DEFAULT_LIMIT;

  if (limitParam !== null) {
    const parsed = Number(limitParam);

    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
      return Response.json(
        {
          error: `limit must be a positive integer no greater than ${MAX_LIMIT}`,
        },
        { status: 400 },
      );
    }

    effectiveLimit = parsed;
  }

  // Fetch one extra to determine whether there are more pages
  const results = await findVisiblePhotos({
    limit: effectiveLimit + 1,
    cursor: cursorParam,
    eventId: eventIdParam,
  });

  const hasMore = results.length > effectiveLimit;
  const trimmed = hasMore ? results.slice(0, effectiveLimit) : results;
  const nextCursor = hasMore ? trimmed[trimmed.length - 1].uploadedAt : null;

  const photos = trimmed.map((p) => ({
    id: p.id,
    publicUrl: p.publicUrl,
    width: p.width,
    height: p.height,
    uploadedAt: p.uploadedAt,
    takenBy: p.takenBy,
  }));

  return Response.json({ photos, nextCursor, hasMore });
}
