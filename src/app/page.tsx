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

        <CountdownTimer />

        <RsvpButton />

        <p className="text-lg text-gray-600">
          We can&#39;t wait to celebrate with you!
        </p>
      </div>
    </div>
  );
}
