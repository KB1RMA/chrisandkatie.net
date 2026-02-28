/**
 * @vitest-environment node
 */
import { expect, test, describe } from 'vitest';
import {
  formatEventDate,
  formatEventTime,
  isCurrentEvent,
} from './schedule-utils';
import type { WeddingEvent } from '@/lib/db/schema';

describe('formatEventDate', () => {
  test('should format an ISO date as "Month D • Weekday"', () => {
    // September 11, 2025 is a Thursday
    expect(formatEventDate('2025-09-11')).toBe('September 11 • Thursday');
  });

  test('should format a Saturday correctly', () => {
    // September 13, 2025 is a Saturday
    expect(formatEventDate('2025-09-13')).toBe('September 13 • Saturday');
  });

  test('should format a date in a different month', () => {
    // December 25, 2025 is a Thursday
    expect(formatEventDate('2025-12-25')).toBe('December 25 • Thursday');
  });
});

describe('formatEventTime', () => {
  test('should format 18:00 as "6:00 PM"', () => {
    expect(formatEventTime('18:00')).toBe('6:00 PM');
  });

  test('should format 10:00 as "10:00 AM"', () => {
    expect(formatEventTime('10:00')).toBe('10:00 AM');
  });

  test('should format 00:00 as "12:00 AM"', () => {
    expect(formatEventTime('00:00')).toBe('12:00 AM');
  });

  test('should format 12:00 as "12:00 PM"', () => {
    expect(formatEventTime('12:00')).toBe('12:00 PM');
  });

  test('should format 09:30 as "9:30 AM"', () => {
    expect(formatEventTime('09:30')).toBe('9:30 AM');
  });

  test('should format 22:15 as "10:15 PM"', () => {
    expect(formatEventTime('22:15')).toBe('10:15 PM');
  });
});

describe('isCurrentEvent', () => {
  const makeEvent = (
    eventDate: string,
    startTime: string,
    endTime: string,
  ): WeddingEvent => ({
    id: 'event-1',
    name: 'Test Event',
    description: null,
    location: null,
    eventDate,
    startTime,
    endTime,
    type: 'main',
    dressCode: null,
    parkingInfo: null,
    sortOrder: 0,
    rsvpRequired: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  test('should return true when now is between start and end time', () => {
    const event = makeEvent('2025-09-13', '16:00', '22:00');
    const now = new Date('2025-09-13T19:00:00');

    expect(isCurrentEvent(event, now)).toBe(true);
  });

  test('should return false when now is before event start time', () => {
    const event = makeEvent('2025-09-13', '16:00', '22:00');
    const now = new Date('2025-09-13T15:00:00');

    expect(isCurrentEvent(event, now)).toBe(false);
  });

  test('should return false when now is after event end time', () => {
    const event = makeEvent('2025-09-13', '16:00', '22:00');
    const now = new Date('2025-09-13T23:00:00');

    expect(isCurrentEvent(event, now)).toBe(false);
  });

  test('should return false when now is on a different date', () => {
    const event = makeEvent('2025-09-13', '16:00', '22:00');
    const now = new Date('2025-09-14T19:00:00');

    expect(isCurrentEvent(event, now)).toBe(false);
  });

  test('should return false when eventDate is invalid', () => {
    const event = makeEvent('not-a-date', '16:00', '22:00');
    const now = new Date('2025-09-13T19:00:00');

    expect(isCurrentEvent(event, now)).toBe(false);
  });

  test('should default to now when no date is provided', () => {
    // Create an event that will never be "current" (year 2000)
    const event = makeEvent('2000-01-01', '00:00', '00:01');

    expect(isCurrentEvent(event)).toBe(false);
  });
});
