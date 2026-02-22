import type { Metadata } from 'next';
import { WEDDING_DATE_DISPLAY } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'RSVP - Chris & Katie',
  description: `RSVP for Chris and Katie's wedding on ${WEDDING_DATE_DISPLAY}`,
};

/**
 * RSVP page with embedded Zola registry RSVP form.
 */
export default function RSVPPage() {
  return (
    <div className="font-roboto flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 p-8">
      <div className="w-full max-w-2xl">
        <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-4 text-center">
          RSVP
        </h1>

        <p className="text-xl text-gray-700 mb-12 text-center">
          We can&#39;t wait to celebrate with you! Please let us know if
          you&#39;ll be joining us.
        </p>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <iframe
            src="https://www.zola.com/registry/chris-katie-snyder/rsvp?embed"
            width="100%"
            height="600"
            style={{ border: 'none' }}
            title="Zola RSVP Form"
          ></iframe>
        </div>
      </div>
    </div>
  );
}
