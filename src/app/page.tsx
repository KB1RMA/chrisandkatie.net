import Link from 'next/link';
import { WEDDING_DISPLAY_TEXT } from '@/lib/constants';
import { CountdownTimer } from '@/components/CountdownTimer';
import { RsvpButton } from '@/components/RsvpButton';

export default function Home() {
  return (
    <div className="font-roboto flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 p-8">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-4">
          Chris & Katie
        </h1>

        <p className="text-xl sm:text-2xl text-gray-700 mb-12">
          {WEDDING_DISPLAY_TEXT}
        </p>

        <p className="text-lg text-gray-700 mb-10">
          <span className="block">
            We&#39;re exchanging vows in a private ceremony this summer.
          </span>
          <span className="block">
            Please join us for a celebration of our marriage in September!
          </span>
        </p>

        <CountdownTimer />

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
          <RsvpButton />

          <Link
            href="/schedule"
            className="inline-block bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-8 rounded-full shadow-lg transition-all duration-200"
          >
            Schedule
          </Link>
        </div>

        <p className="text-lg text-gray-600 mt-8">
          We can&#39;t wait to celebrate with you!
        </p>
      </div>
    </div>
  );
}
