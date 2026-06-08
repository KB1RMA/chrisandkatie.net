import { Marcellus } from 'next/font/google';
import type { Metadata } from 'next';
import { Button } from '@/components/Button';

export const metadata: Metadata = {
  title: 'Registry',
  description:
    'Gift registry for Katie & Chris — shop our Crate and Barrel registry',
};

const REGISTRY_URL =
  'https://www.crateandbarrel.com/gift-registry/katie-karam-and-chris-snyder/r7570277';

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

/**
 * Public registry page linking guests to the Crate and Barrel gift registry.
 *
 * @returns Server component with registry information and external link.
 */
export default function RegistryPage() {
  return (
    <div className="font-roboto flex min-h-screen flex-col items-center justify-start bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-4 sm:justify-center sm:p-8">
      <div className="w-full max-w-2xl">
        <h1
          className={`${marcellus.className} mb-4 text-center text-5xl font-bold text-[#9e3f3f] sm:text-6xl`}
        >
          Registry
        </h1>

        {/* <p className="mb-12 text-center text-xl text-[#6a5555]">
          Your presence is truly the greatest gift. If you'd like to celebrate
          with something from our registry, we're registered at Crate &amp;
          Barrel.
        </p> */}

        {/* Crate & Barrel registry card */}
        <div className="mt-12 overflow-hidden rounded-xl border border-[#f3dedb] bg-white shadow-sm">
          <div className="flex flex-col items-center gap-6 p-8 text-center">
            {/* C&B wordmark as styled text */}
            <div className="flex flex-col items-center gap-1">
              <p
                className={`${marcellus.className} text-3xl text-[#9e3f3f] sm:text-4xl`}
              >
                Crate &amp; Barrel
              </p>
            </div>

            <p className="max-w-sm text-[#6a5555]">
              Browse our curated registry to find something we'll love as we
              build our home together.
            </p>

            <Button href={REGISTRY_URL} target="_blank">
              View Our Registry ↗
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
