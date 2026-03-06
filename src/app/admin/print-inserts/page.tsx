import type { Metadata } from 'next';
import {
  countInvitationsWithoutCode,
  findInvitationRowsForPrint,
} from '@/lib/db/repositories/invitations';
import { assemblePrintInserts } from '@/lib/print-inserts';
import InsertCard from './components/InsertCard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Print Invite Inserts',
  description: 'Printable invitation inserts with QR codes.',
};

type SearchParams = {
  ids?: string | string[];
};

type Props = {
  searchParams: Promise<SearchParams>;
};

/**
 * Admin page for printing invitation inserts.
 *
 * Renders a grid of InsertCard components for all invitations that have a
 * code assigned. Supports optional subset filtering via `?ids=id1,id2` query
 * param. Protected by the admin layout — no auth logic needed here.
 *
 * @param searchParams - URL search params; supports `ids` for subset filtering.
 * @returns The print inserts page.
 */
export default async function PrintInsertsPage({ searchParams }: Props) {
  const params = await searchParams;
  const idsParam = Array.isArray(params.ids) ? params.ids[0] : params.ids;
  const invitationIds = idsParam
    ? idsParam
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    : undefined;

  const [rows, skippedCount] = await Promise.all([
    findInvitationRowsForPrint(invitationIds),
    countInvitationsWithoutCode(),
  ]);

  const inserts = await assemblePrintInserts(rows);

  return (
    <>
      <style>{`
        @page { size: letter; margin: 0.5in; }
        @media print {
          header, .print-controls { display: none !important; }
          body { margin: 0; padding: 0; }
          .insert-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            grid-auto-rows: 4.875in;
            gap: 0.25in;
            width: 100%;
          }
          .insert-card {
            break-inside: avoid;
            border: 1px dashed #ccc;
            padding: 0.25in;
            height: 4.875in;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 0.15in;
          }
          .insert-card .qr-container {
            width: 2.5in;
            height: 2.5in;
          }
          .insert-card .qr-container svg {
            width: 100%;
            height: 100%;
          }
        }
      `}</style>

      <section className="print-controls mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm print:hidden">
        {inserts.length === 0 ? (
          <p className="text-gray-500">
            No invitations with codes found. Assign invitation codes first.
          </p>
        ) : (
          <p className="text-gray-700">
            {inserts.length} insert{inserts.length !== 1 ? 's' : ''} ready to
            print
          </p>
        )}

        {skippedCount > 0 && (
          <p className="mt-1 text-amber-600">
            {skippedCount} invitation{skippedCount !== 1 ? 's' : ''} skipped (no
            code assigned)
          </p>
        )}
      </section>

      <div className="insert-grid grid grid-cols-2 gap-4">
        {inserts.map((insert) => (
          <InsertCard key={insert.invitationId} insert={insert} />
        ))}
      </div>
    </>
  );
}
