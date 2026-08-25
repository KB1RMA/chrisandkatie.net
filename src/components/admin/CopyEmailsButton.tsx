'use client';

import { useMemo, useState } from 'react';

export type CopyEmailsButtonProps = {
  /** Raw contact emails from all invitations; may contain duplicates, blanks, or nulls. */
  emails: (string | null)[];
};

/**
 * Copies every invitee contact email to the clipboard as a semicolon-separated
 * list, ready to paste into a mail client's "To" or "Bcc" field.
 *
 * Deduplicates and trims the incoming emails before copying and shows a
 * "Copied!" confirmation for two seconds after a successful copy.
 *
 * @param emails - Contact emails to copy (nulls/blanks are filtered out).
 * @returns Button that copies the deduplicated email list on click.
 */
export function CopyEmailsButton({ emails }: CopyEmailsButtonProps) {
  const [copied, setCopied] = useState(false);

  const uniqueEmails = useMemo(
    () => [
      ...new Set(
        emails
          .map((email) => email?.trim() ?? '')
          .filter((email) => email.length > 0),
      ),
    ],
    [emails],
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(uniqueEmails.join('; '));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={uniqueEmails.length === 0}
      title={
        uniqueEmails.length === 0
          ? 'No email addresses on file'
          : `Copy ${uniqueEmails.length} email address${uniqueEmails.length === 1 ? '' : 'es'} as a semicolon-separated list`
      }
      className="inline-flex items-center gap-1 rounded-md bg-white px-4 py-2 text-sm font-medium text-[#6a5555] shadow ring-1 ring-gray-200 ring-inset hover:bg-[#f3dedb] hover:text-[#9e3f3f] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-[#6a5555]"
    >
      {copied ? 'Copied!' : `Copy Emails (${uniqueEmails.length})`}
    </button>
  );
}
