'use client';

import { useEffect } from 'react';
import { calculateCountdown, isWeddingDay } from '@/lib/countdown';

/**
 * Updates the document title with a real-time countdown to the wedding.
 * Displays something like "🎊 2d 3h 45m 30s | Chris & Katie"
 */
export function CountdownPageTitle() {
  useEffect(() => {
    const updateTitle = () => {
      if (isWeddingDay()) {
        document.title = '💒 Today is the day! | Chris & Katie';

        return;
      }

      const { days, hours, minutes, seconds } = calculateCountdown();

      document.title = `🎊 ${days}d ${hours}h ${minutes}m ${seconds}s | Chris & Katie`;
    };

    updateTitle();
    const interval = setInterval(updateTitle, 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
