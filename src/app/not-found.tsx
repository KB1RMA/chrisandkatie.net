import { Marcellus } from 'next/font/google';
import { Button } from '@/components/Button';

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

/**
 * Custom 404 Not Found page for the wedding site.
 * Displays a cute message when a page is not found.
 */
export default function NotFound() {
  return (
    <div className="font-roboto flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-4">
      <div className="text-center">
        <div className="mb-8">
          <div
            className={`${marcellus.className} mb-4 text-7xl font-bold text-[#9e3f3f]`}
          >
            404
          </div>
          <h1
            className={`${marcellus.className} mb-2 text-4xl font-bold text-[#9e3f3f] sm:text-5xl`}
          >
            Oops! Page Not Found
          </h1>
        </div>

        <p className="mb-4 max-w-md text-lg text-[#6a5555] sm:text-xl">
          It looks like this page got lost on the way to the celebration! 💍
        </p>

        <p className="mb-8 text-base text-[#7a6666] sm:text-lg">
          Don&apos;t worry, it happens to the best of us. Let&apos;s get you
          back on track!
        </p>

        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Button href="/">Back to Home</Button>
          <Button href="/schedule" variant="secondary">
            View Schedule
          </Button>
        </div>

        <div className="mt-12 text-4xl">
          <span
            className="inline-block animate-bounce"
            style={{ animationDelay: '0s' }}
          >
            💕
          </span>
          <span
            className="inline-block animate-bounce"
            style={{ animationDelay: '0.1s' }}
          >
            {' '}
            ✨{' '}
          </span>
          <span
            className="inline-block animate-bounce"
            style={{ animationDelay: '0.2s' }}
          >
            💍
          </span>
        </div>
      </div>
    </div>
  );
}
