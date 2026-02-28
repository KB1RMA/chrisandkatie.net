// @vitest-environment node

import { assert, describe, expect, test } from 'vitest';

import { eventFormSchema } from './event';

const validCompleteEvent = {
  name: 'Rehearsal Dinner',
  eventDate: '2026-09-11',
  startTime: '18:30',
  endTime: '20:30',
  description: 'Pre-wedding dinner',
  location: 'The Barn',
  type: 'rehearsal',
  dressCode: 'Smart Casual',
  parkingInfo: 'Valet available',
  sortOrder: 1,
};

const validRequiredOnlyEvent = {
  name: 'Rehearsal Dinner',
  eventDate: '2026-09-11',
  startTime: '18:30',
  endTime: '20:30',
};

describe('eventFormSchema', () => {
  describe('valid data', () => {
    test('should pass validation with all fields including optional ones', () => {
      const result = eventFormSchema.safeParse(validCompleteEvent);

      expect(result.success).toBe(true);
    });

    test('should pass validation with only required fields', () => {
      const result = eventFormSchema.safeParse(validRequiredOnlyEvent);

      expect(result.success).toBe(true);
    });
  });

  describe('required field validation', () => {
    test('should fail when name is missing with "Event name is required"', () => {
      const { name: _name, ...data } = validRequiredOnlyEvent;
      const result = eventFormSchema.safeParse(data);

      expect(result.success).toBe(false);
      assert(!result.success);

      const nameError = result.error.issues.find((issue) =>
        issue.path.includes('name'),
      );

      expect(nameError?.message).toBe('Event name is required');
    });

    test('should fail when eventDate is missing', () => {
      const { eventDate: _eventDate, ...data } = validRequiredOnlyEvent;
      const result = eventFormSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    test('should fail when startTime is missing', () => {
      const { startTime: _startTime, ...data } = validRequiredOnlyEvent;
      const result = eventFormSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    test('should fail when endTime is missing', () => {
      const { endTime: _endTime, ...data } = validRequiredOnlyEvent;
      const result = eventFormSchema.safeParse(data);

      expect(result.success).toBe(false);
    });
  });

  describe('time range validation', () => {
    test('should fail with "End time must be after start time" when endTime equals startTime', () => {
      const result = eventFormSchema.safeParse({
        ...validRequiredOnlyEvent,
        startTime: '18:30',
        endTime: '18:30',
      });

      expect(result.success).toBe(false);
      assert(!result.success);

      const endTimeError = result.error.issues.find((issue) =>
        issue.path.includes('endTime'),
      );

      expect(endTimeError?.message).toBe('End time must be after start time');
    });

    test('should fail with "End time must be after start time" when endTime is before startTime', () => {
      const result = eventFormSchema.safeParse({
        ...validRequiredOnlyEvent,
        startTime: '20:30',
        endTime: '18:30',
      });

      expect(result.success).toBe(false);
      assert(!result.success);

      const endTimeError = result.error.issues.find((issue) =>
        issue.path.includes('endTime'),
      );

      expect(endTimeError?.message).toBe('End time must be after start time');
    });
  });

  describe('format validation', () => {
    test('should fail when eventDate is not in YYYY-MM-DD format', () => {
      const result = eventFormSchema.safeParse({
        ...validRequiredOnlyEvent,
        eventDate: '09/11/2026',
      });

      expect(result.success).toBe(false);
    });

    test('should fail when startTime is not in HH:MM format', () => {
      const result = eventFormSchema.safeParse({
        ...validRequiredOnlyEvent,
        startTime: '6:30pm',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('default values', () => {
    test('should default type to "other" when omitted', () => {
      const result = eventFormSchema.safeParse(validRequiredOnlyEvent);

      expect(result.success).toBe(true);
      assert(result.success);

      expect(result.data.type).toBe('other');
    });

    test('should default sortOrder to 0 when omitted', () => {
      const result = eventFormSchema.safeParse(validRequiredOnlyEvent);

      expect(result.success).toBe(true);
      assert(result.success);

      expect(result.data.sortOrder).toBe(0);
    });
  });

  describe('rsvpRequired', () => {
    test('should default rsvpRequired to false when omitted', () => {
      const result = eventFormSchema.safeParse(validRequiredOnlyEvent);

      expect(result.success).toBe(true);
      assert(result.success);

      expect(result.data.rsvpRequired).toBe(false);
    });

    test('should pass validation when rsvpRequired is true', () => {
      const result = eventFormSchema.safeParse({
        ...validRequiredOnlyEvent,
        rsvpRequired: true,
      });

      expect(result.success).toBe(true);
      assert(result.success);

      expect(result.data.rsvpRequired).toBe(true);
    });

    test('should pass validation when rsvpRequired is false', () => {
      const result = eventFormSchema.safeParse({
        ...validRequiredOnlyEvent,
        rsvpRequired: false,
      });

      expect(result.success).toBe(true);
      assert(result.success);

      expect(result.data.rsvpRequired).toBe(false);
    });

    test('should coerce rsvpRequired to false when type is main regardless of input', () => {
      const result = eventFormSchema.safeParse({
        ...validRequiredOnlyEvent,
        type: 'main',
        rsvpRequired: true,
      });

      expect(result.success).toBe(true);
      assert(result.success);

      expect(result.data.rsvpRequired).toBe(false);
    });
  });
});
