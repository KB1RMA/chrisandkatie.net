import { WEDDING_DATE } from '@/lib/constants';

/**
 * Represents the remaining time until the wedding.
 */
export type CountdownTime = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

/**
 * Calculates the remaining time until the wedding date.
 *
 * @returns The countdown time object with days, hours, minutes, and seconds.
 */
export function calculateCountdown(): CountdownTime {
  const weddingTime = WEDDING_DATE.getTime();
  const now = new Date().getTime();
  const difference = weddingTime - now;

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  };
}

/**
 * Checks if the wedding has already started (time difference <= 0).
 *
 * @returns true if the wedding day has arrived, false otherwise.
 */
export function isWeddingDay(): boolean {
  return new Date().getTime() >= WEDDING_DATE.getTime();
}
