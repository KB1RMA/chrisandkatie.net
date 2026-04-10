import { NextRequest, NextResponse } from 'next/server';
import { auth, getAuthIdentity } from '@/lib/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { uploadPhotoSchema } from '@/lib/schemas/photo-booth';
import { insertGuestPhoto } from '@/lib/db/repositories/guestPhotos';
import { findInvitationWithGuests } from '@/lib/db/repositories/invitations';
import { notifyPartyKit } from '@/lib/partykit';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * POST /api/photo-booth/upload
 *
 * Accepts a multipart form with a `photo` file field. Authenticates the
 * caller as a guest, validates the file, writes it to R2, inserts a database
 * record, and broadcasts a PartyKit notification.
 *
 * @param request - The incoming Next.js request with multipart body.
 * @returns 201 with `{ id, publicUrl, uploadedAt }` on success.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate — guests only
    const session = await auth();
    const identity = getAuthIdentity(session);

    if (!identity || identity.type !== 'guest') {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('photo');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'MISSING_FILE' }, { status: 400 });
    }

    // Validate MIME type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'INVALID_MIME' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 413 });
    }

    // Parse optional metadata fields
    const rawFields = {
      guestId: formData.get('guestId') ?? undefined,
      eventId: formData.get('eventId') ?? undefined,
      takenAt: formData.get('takenAt') ?? undefined,
      width: formData.get('width') ?? undefined,
      height: formData.get('height') ?? undefined,
    };

    const parsed = uploadPhotoSchema.safeParse(rawFields);
    const photoData = parsed.success ? parsed.data : null;

    // Resolve guestId from the invitation
    const invitation = await findInvitationWithGuests(identity.invitationId);
    const firstGuest = invitation?.guests[0];

    const matchedGuest = photoData?.guestId
      ? invitation?.guests.find((g) => g.id === photoData.guestId)
      : undefined;

    const resolvedGuestId = (matchedGuest ?? firstGuest)?.id;

    if (!resolvedGuestId) {
      return NextResponse.json({ error: 'GUEST_NOT_FOUND' }, { status: 400 });
    }

    // Generate identifiers and upload path
    const id = crypto.randomUUID();
    const uploadedAt = new Date().toISOString();
    const r2Key = `guest-photos/${uploadedAt}/${id}.jpg`;

    // Write to R2 — cast env to access GUEST_PHOTOS_BUCKET binding
    const { env } = getCloudflareContext();
    const bucket = (env as unknown as { GUEST_PHOTOS_BUCKET: R2Bucket })
      .GUEST_PHOTOS_BUCKET;

    await bucket.put(r2Key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });

    // Construct public URL.
    // R2_PUBLIC_BASE_URL is the full base (e.g. "https://pub-xxx.r2.dev" in production
    // or "http://localhost:8787/api/photo-booth/files" in local dev).
    // Falls back to https:// + R2_PUBLIC_DOMAIN for backwards compatibility.
    // For localhost URLs we store a relative path so the URL works regardless of port.
    const rawBase =
      process.env.R2_PUBLIC_BASE_URL ??
      `https://${process.env.R2_PUBLIC_DOMAIN}`;
    const parsedBase = new URL(rawBase);
    const baseUrl =
      parsedBase.hostname === 'localhost'
        ? parsedBase.pathname.replace(/\/$/, '')
        : rawBase.replace(/\/$/, '');
    const publicUrl = `${baseUrl}/${r2Key}`;

    // Insert database record
    await insertGuestPhoto({
      id,
      r2Key,
      publicUrl,
      guestId: resolvedGuestId,
      eventId: photoData?.eventId,
      width: photoData?.width,
      height: photoData?.height,
      takenAt: photoData?.takenAt,
    });

    // Fire-and-forget PartyKit broadcast
    const room = photoData?.eventId ?? 'wedding-album';

    void notifyPartyKit(
      {
        type: 'photo-added',
        photo: {
          id,
          publicUrl,
          width: photoData?.width,
          height: photoData?.height,
          uploadedAt,
        },
      },
      room,
    );

    return NextResponse.json({ id, publicUrl, uploadedAt }, { status: 201 });
  } catch (err) {
    console.error('[photo-booth/upload] Unhandled error:', err);

    return NextResponse.json({ error: 'UPLOAD_FAILED' }, { status: 500 });
  }
}
