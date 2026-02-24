'use client';

import { useEffect } from 'react';
import { calculateCountdown, isWeddingDay } from '@/lib/countdown';

/**
 * Updates the document title with a real-time countdown to the wedding.
 * Appends countdown to the existing page title, like "Gallery | Chris & Katie - 🎊 2d 3h 45m 30s"
 */
export function CountdownPageTitle() {
  useEffect(() => {
    const updateTitle = () => {
      // Extract base title from current title (remove any existing countdown)
      const currentTitle = document.title;
      const baseTitle = currentTitle.split(' - 🎊')[0].split(' - 💒')[0].trim();

      if (isWeddingDay()) {
        document.title = `${baseTitle} - 💒 Today is the day!`;

        return;
      }

      const { days, hours, minutes, seconds } = calculateCountdown();

      document.title = `${baseTitle} - 🎊 ${days}d ${hours}h ${minutes}m ${seconds}s`;
    };

    updateTitle();
    const interval = setInterval(updateTitle, 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
