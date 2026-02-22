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
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 mb-12">
      <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
        <div className="text-4xl sm:text-5xl font-bold text-purple-600 mb-2">
          {countdown.days}
        </div>

        <div className="text-gray-600 font-medium text-sm sm:text-base">
          Days
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
        <div className="text-4xl sm:text-5xl font-bold text-purple-600 mb-2">
          {String(countdown.hours).padStart(2, '0')}
        </div>

        <div className="text-gray-600 font-medium text-sm sm:text-base">
          Hours
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
        <div className="text-4xl sm:text-5xl font-bold text-purple-600 mb-2">
          {String(countdown.minutes).padStart(2, '0')}
        </div>

        <div className="text-gray-600 font-medium text-sm sm:text-base">
          Minutes
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
        <div className="text-4xl sm:text-5xl font-bold text-purple-600 mb-2">
          {String(countdown.seconds).padStart(2, '0')}
        </div>

        <div className="text-gray-600 font-medium text-sm sm:text-base">
          Seconds
        </div>
      </div>
    </div>
  );
}
