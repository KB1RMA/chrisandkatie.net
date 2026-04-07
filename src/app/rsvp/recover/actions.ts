'use server';

import { recoverSchema } from '@/lib/schemas/recover';
import { findInvitationCodeByLastNameAndAddress } from '@/lib/db/repositories/invitations';

type RecoverInvitationCodeSuccess = {
  success: true;
  invitationCode: string;
};

type RecoverInvitationCodeFailure = {
  success: false;
  error: string;
};

export type RecoverInvitationCodeResult =
  | RecoverInvitationCodeSuccess
  | RecoverInvitationCodeFailure;

const GENERIC_ERROR = "We couldn't find an invitation matching those details.";

/**
 * Recovers a guest's invitation code by matching their last name and the
 * street address their invitation was mailed to.
 *
 * This action is intentionally unauthenticated — it is the pre-authentication
 * recovery mechanism. All failure paths return an identical generic error
 * message to prevent enumeration of guest records.
 *
 * Rate limiting is enforced at the Cloudflare WAF layer (see wrangler.toml).
 *
 * @param input - Unvalidated form input containing lastName, streetAddress, and zipCode.
 * @returns A RecoverInvitationCodeResult — never throws.
 */
export async function recoverInvitationCode(
  input: unknown,
): Promise<RecoverInvitationCodeResult> {
  const parseResult = recoverSchema.safeParse(input);

  if (!parseResult.success) {
    return { success: false, error: GENERIC_ERROR };
  }

  const { lastName, streetAddress, zipCode } = parseResult.data;

  try {
    const invitationCode = await findInvitationCodeByLastNameAndAddress(
      lastName,
      streetAddress,
      zipCode,
    );

    if (!invitationCode) {
      return { success: false, error: GENERIC_ERROR };
    }

    return { success: true, invitationCode };
  } catch (error) {
    console.error(
      '[recoverInvitationCode] Unexpected error during lookup',
      error,
    );

    return { success: false, error: GENERIC_ERROR };
  }
}
