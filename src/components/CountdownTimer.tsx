'use client';

import { useEffect, useState } from 'react';

interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Calculates the remaining time until the wedding date.
 *
 * @returns The countdown time object with days, hours, minutes, and seconds.
 */
function calculateCountdown(): CountdownTime {
  const weddingDate = new Date('2026-09-12T17:00:00').getTime();
  const now = new Date().getTime();
  const difference = weddingDate - now;

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  };
}

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
