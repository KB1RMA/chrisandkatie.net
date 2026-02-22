import { Great_Vibes, Marcellus } from 'next/font/google';
import { WEDDING_DISPLAY_TEXT } from '@/lib/constants';
import { Button } from '@/components/Button';
import { CountdownTimer } from '@/components/CountdownTimer';

const greatVibes = Great_Vibes({
  subsets: ['latin'],
  weight: '400',
});

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

export default function Home() {
  return (
    <div className="font-roboto flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-8">
      <div className="text-center max-w-2xl">
        <h1
          className={`${greatVibes.className} text-5xl sm:text-6xl font-normal text-[#9e3f3f] mb-4`}
        >
          Chris & Katie
        </h1>

        <p
          className={`${marcellus.className} text-xl sm:text-2xl text-[#6a5555] mb-12`}
        >
          {WEDDING_DISPLAY_TEXT}
        </p>

        <p className="text-lg text-[#6a5555] mb-10">
          <span className="block">
            We&#39;re exchanging vows in a private ceremony this summer.
          </span>
          <span className="block">
            Please join us for a celebration of our marriage in September!
          </span>
        </p>

        <CountdownTimer />

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
          <Button href="/rsvp">RSVP Now</Button>

          <Button href="/schedule">Schedule</Button>
        </div>

        <p className="text-lg text-[#7a6666] mt-8">
          We can&#39;t wait to celebrate with you!
        </p>
      </div>
    </div>
  );
}
