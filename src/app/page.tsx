import Image from 'next/image';
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
    <div className="font-roboto relative flex min-h-screen items-center justify-center p-8">
      <Image
        src="/images/bw-backgrounds/IMG_8943.jpg"
        alt="Chris and Katie"
        fill
        priority
        sizes="(max-width: 640px) 100vw, 0px"
        className="absolute inset-0 object-cover object-center sm:hidden"
      />
      <Image
        src="/images/bw-backgrounds/IMG_8940-2.jpg"
        alt="Chris and Katie"
        fill
        priority
        sizes="(min-width: 641px) 100vw, 0px"
        className="absolute inset-0 hidden object-cover object-center sm:block"
      />
      <div className="absolute inset-0 bg-[#fff7f4]/80"></div>
      <div className="relative z-10 max-w-2xl text-center">
        <h1
          className={`${greatVibes.className} mb-4 text-5xl font-normal text-[#9e3f3f] sm:text-6xl`}
        >
          Chris & Katie
        </h1>

        <p
          className={`${marcellus.className} mb-12 text-xl text-[#6a5555] sm:text-2xl`}
        >
          {WEDDING_DISPLAY_TEXT}
        </p>

        <p className="mb-10 text-lg text-[#6a5555]">
          <span className="block">
            We&#39;re exchanging vows in a private ceremony this summer.
          </span>
          <span className="block">
            Please join us for a celebration of our marriage in September!
          </span>
        </p>

        <CountdownTimer />

        <div className="mb-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button href="/rsvp">RSVP Now</Button>

          <Button href="/schedule">Schedule</Button>

          <Button href="/gallery" variant="secondary">
            Gallery
          </Button>
        </div>

        <p className="mt-8 text-lg text-[#7a6666]">
          We can&#39;t wait to celebrate with you!
        </p>
      </div>
    </div>
  );
}
