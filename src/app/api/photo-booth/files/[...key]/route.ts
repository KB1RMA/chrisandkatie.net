import { NextRequest, NextResponse } from 'next/server';
import { auth, getAuthIdentity } from '@/lib/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * GET /api/photo-booth/files/[...key]
 *
 * Proxies R2 guest photo objects for authenticated guests. This route is used
 * in local development where photos cannot be accessed via a public CDN domain.
 * In production, R2_PUBLIC_BASE_URL points directly to the R2 CDN and this
 * route is not used.
 *
 * @param request - The incoming request.
 * @param params - Route params; `key` is the R2 object key segments joined into a path.
 * @returns The R2 object body with the correct content-type, or 404 if not found.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
): Promise<NextResponse> {
  const session = await auth();
  const identity = getAuthIdentity(session);

  if (!identity) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { key } = await params;
  const r2Key = key.join('/');

  const { env } = getCloudflareContext();
  const bucket = (env as unknown as { GUEST_PHOTOS_BUCKET: R2Bucket })
    .GUEST_PHOTOS_BUCKET;

  const object = await bucket.get(r2Key);

  if (!object) {
    return new NextResponse(null, { status: 404 });
  }

  const body = await object.arrayBuffer();
  const contentType =
    object.httpMetadata?.contentType ?? 'application/octet-stream';

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
