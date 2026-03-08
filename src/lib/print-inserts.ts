/**
 * Utility functions for printable invitation inserts.
 */

import qrcode from 'qrcode';

/**
 * Raw invitation data returned by the repository before QR assembly.
 * The repository layer returns this shape; callers assemble it into PrintInsert.
 */
export type InvitationPrintRow = {
  invitationId: string;
  invitationCode: string;
  householdLabel: string;
  mailingAddress: string | null;
};

/** Represents a single printable insert unit, assembled at query time. */
export type PrintInsert = {
  /** Invitation record ID */
  invitationId: string;
  /** The two-word invitation code (guaranteed non-null) */
  invitationCode: string;
  /** Formatted mailing address for the household */
  mailingAddress: string | null;
  /** Full deep-link URL encoded in the QR code */
  deepLinkUrl: string;
  /** Pre-generated SVG string for the QR code (server-side) */
  qrCodeSvg: string;
};

/**
 * Build the invitation deep-link URL for a given invitation code.
 * The code is URL-encoded to handle special characters.
 *
 * @param code - The invitation code to embed in the URL.
 * @returns The full deep-link URL.
 */
export function buildInviteDeepLink(code: string): string {
  return `https://chrisandkatie.net/login?code=${encodeURIComponent(code)}`;
}

/**
 * Assemble PrintInsert records from raw repository rows by generating
 * deep-link URLs and QR code SVGs, then sort by householdLabel ascending.
 *
 * @param rows - Raw invitation rows returned by the repository.
 * @returns PrintInsert records sorted by householdLabel ascending.
 */
export async function assemblePrintInserts(
  rows: InvitationPrintRow[],
): Promise<PrintInsert[]> {
  const results = await Promise.all(
    rows.map(async (row) => {
      const deepLinkUrl = buildInviteDeepLink(row.invitationCode);
      const qrCodeSvg = await qrcode.toString(deepLinkUrl, { type: 'svg' });

      return {
        invitationId: row.invitationId,
        invitationCode: row.invitationCode,
        householdLabel: row.householdLabel,
        mailingAddress: row.mailingAddress,
        deepLinkUrl,
        qrCodeSvg,
      };
    }),
  );

  return results.sort((a, b) =>
    a.householdLabel.localeCompare(b.householdLabel),
  );
}
