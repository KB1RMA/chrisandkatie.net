'use client';

import { useEffect, useState } from 'react';
import { calculateCountdown, type CountdownTime } from '@/lib/countdown';

/**
 * Displays a real-time countdown timer to the wedding date.
 */
export function CountdownTimer() {
  const [countdown, setCountdown] = useState<CountdownTime>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const updateCountdown = () => setCountdown(calculateCountdown());
    updateCountdown();

    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mb-12 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-8">
      <div className="rounded-lg bg-[#fffdfb] p-6 shadow-lg sm:p-8">
        <div className="mb-2 text-4xl font-bold text-[#9e3f3f] sm:text-5xl">
          {countdown.days}
        </div>

        <div className="text-sm font-medium text-[#7a6666] sm:text-base">
          Days
        </div>
      </div>

      <div className="rounded-lg bg-[#fffdfb] p-6 shadow-lg sm:p-8">
        <div className="mb-2 text-4xl font-bold text-[#9e3f3f] sm:text-5xl">
          {String(countdown.hours).padStart(2, '0')}
        </div>

        <div className="text-sm font-medium text-[#7a6666] sm:text-base">
          Hours
        </div>
      </div>

      <div className="rounded-lg bg-[#fffdfb] p-6 shadow-lg sm:p-8">
        <div className="mb-2 text-4xl font-bold text-[#9e3f3f] sm:text-5xl">
          {String(countdown.minutes).padStart(2, '0')}
        </div>

        <div className="text-sm font-medium text-[#7a6666] sm:text-base">
          Minutes
        </div>
      </div>

      <div className="rounded-lg bg-[#fffdfb] p-6 shadow-lg sm:p-8">
        <div className="mb-2 text-4xl font-bold text-[#9e3f3f] sm:text-5xl">
          {String(countdown.seconds).padStart(2, '0')}
        </div>

        <div className="text-sm font-medium text-[#7a6666] sm:text-base">
          Seconds
        </div>
      </div>
    </div>
  );
}
