import { WEDDING_DATE_DISPLAY } from '@/lib/constants';

import type { PrintInsert } from '@/lib/print-inserts';

type Props = {
  insert: PrintInsert;
};

/**
 * Renders a single printable invitation insert card.
 *
 * Displays wedding branding, the household label, a QR code linking to the
 * RSVP portal, and the plain-text invitation code. Safe to use with
 * dangerouslySetInnerHTML because the QR SVG is generated server-side from our
 * own database data.
 *
 * @param insert - The PrintInsert record to render.
 * @returns A styled insert card for screen and print output.
 */
export default function InsertCard({ insert }: Props) {
  return (
    <div className="insert-card flex flex-col gap-3 rounded border border-dashed border-gray-300 bg-white p-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-wide text-[#9e3f3f]">
          Chris &amp; Katie
        </h2>
        <p className="text-sm text-gray-500">{WEDDING_DATE_DISPLAY}</p>
      </div>

      {insert.mailingAddress && (
        <p className="text-center text-sm whitespace-pre-line text-gray-700">
          {insert.mailingAddress}
        </p>
      )}

      <div className="flex justify-center">
        {insert.qrCodeSvg ? (
          <div
            className="qr-container h-40 w-40"
            dangerouslySetInnerHTML={{ __html: insert.qrCodeSvg }}
          />
        ) : (
          <p className="text-amber-600 print:hidden">
            QR code unavailable — add qrcode package
          </p>
        )}
      </div>

      <p className="text-center font-mono text-sm text-gray-600">
        Invitation Code: <pre>{insert.invitationCode}</pre>
      </p>
    </div>
  );
}
