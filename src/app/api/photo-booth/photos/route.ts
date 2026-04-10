import { auth, getAuthIdentity } from '@/lib/auth';
import { findVisiblePhotos } from '@/lib/db/repositories/guestPhotos';

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

/**
 * GET /api/photo-booth/photos
 *
 * Returns a paginated list of visible guest photos.
 * Supports cursor-based pagination via `cursor` and `limit` query params.
 *
 * @param request - The incoming HTTP request.
 * @returns 200 JSON with `photos`, `nextCursor`, and `hasMore`; 401 if unauthenticated; 400 for invalid params.
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
