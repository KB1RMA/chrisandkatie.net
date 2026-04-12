/**
 * Builds a public URL for a guest photo from its R2 storage key.
 *
 * Reads R2_PUBLIC_BASE_URL from the environment (e.g. "https://pub-xxx.r2.dev"
 * in production, or "http://localhost:8787/api/photo-booth/files" locally).
 * Falls back to https:// + R2_PUBLIC_DOMAIN for backwards compatibility.
 * For localhost base URLs, returns a relative-path URL so it works regardless
 * of port.
 *
 * @param r2Key - The R2 object key (e.g. "guest-photos/2026-…/uuid.jpg").
 * @returns The full public URL for the photo.
 * @throws {Error} When neither R2_PUBLIC_BASE_URL nor R2_PUBLIC_DOMAIN is set in the environment.
 */
export function buildPublicUrl(r2Key: string): string {
  let rawBase = process.env.R2_PUBLIC_BASE_URL;

  if (!rawBase && process.env.R2_PUBLIC_DOMAIN) {
    rawBase = `https://${process.env.R2_PUBLIC_DOMAIN}`;
  }

  if (!rawBase) {
    throw new Error(
      'Missing R2 configuration: set R2_PUBLIC_BASE_URL (or R2_PUBLIC_DOMAIN) in your environment.',
    );
  }

  const parsedBase = new URL(rawBase);
  const baseUrl =
    parsedBase.hostname === 'localhost'
      ? parsedBase.pathname.replace(/\/$/, '')
      : rawBase.replace(/\/$/, '');

  return `${baseUrl}/${r2Key}`;
}
