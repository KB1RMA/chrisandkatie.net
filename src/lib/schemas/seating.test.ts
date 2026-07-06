import { describe, expect, test } from 'vitest';
import {
  addTableSchema,
  assignGuestSchema,
  deleteTableSchema,
  generateTablesSchema,
  unassignGuestSchema,
  updateTableSchema,
  MAX_TABLE_CAPACITY,
  MAX_TABLE_COUNT,
} from './seating';

describe('generateTablesSchema', () => {
  const validInput = {
    tableCount: 10,
    seatsPerTable: 8,
    includeHeadTable: true,
    headTableSeats: 8,
  };

  test('should accept a valid generation request', () => {
    const result = generateTablesSchema.safeParse(validInput);

    expect(result.success).toBe(true);
  });

  test('should reject a zero table count', () => {
    const result = generateTablesSchema.safeParse({
      ...validInput,
      tableCount: 0,
    });

    expect(result.success).toBe(false);
  });

  test('should reject a table count above the maximum', () => {
    const result = generateTablesSchema.safeParse({
      ...validInput,
      tableCount: MAX_TABLE_COUNT + 1,
    });

    expect(result.success).toBe(false);
  });

  test('should reject fractional seat counts', () => {
    const result = generateTablesSchema.safeParse({
      ...validInput,
      seatsPerTable: 7.5,
    });

    expect(result.success).toBe(false);
  });

  test('should reject head table seats above the maximum', () => {
    const result = generateTablesSchema.safeParse({
      ...validInput,
      headTableSeats: MAX_TABLE_CAPACITY + 1,
    });

    expect(result.success).toBe(false);
  });

  test('should reject a missing includeHeadTable flag', () => {
    const { includeHeadTable: _omitted, ...rest } = validInput;
    const result = generateTablesSchema.safeParse(rest);

    expect(result.success).toBe(false);
  });
});

describe('addTableSchema', () => {
  test('should accept a valid table and trim the name', () => {
    const result = addTableSchema.parse({
      name: '  Kids Table ',
      capacity: 6,
    });

    expect(result.name).toBe('Kids Table');
  });

  test('should reject a blank name', () => {
    const result = addTableSchema.safeParse({ name: '   ', capacity: 6 });

    expect(result.success).toBe(false);
  });

  test('should reject a zero capacity', () => {
    const result = addTableSchema.safeParse({ name: 'Table', capacity: 0 });

    expect(result.success).toBe(false);
  });
});

describe('updateTableSchema', () => {
  test('should accept a valid update', () => {
    const result = updateTableSchema.safeParse({
      id: 'table-1',
      name: 'Family',
      capacity: 10,
    });

    expect(result.success).toBe(true);
  });

  test('should reject an empty table id', () => {
    const result = updateTableSchema.safeParse({
      id: '',
      name: 'Family',
      capacity: 10,
    });

    expect(result.success).toBe(false);
  });

  test('should reject an overlong name', () => {
    const result = updateTableSchema.safeParse({
      id: 'table-1',
      name: 'x'.repeat(61),
      capacity: 10,
    });

    expect(result.success).toBe(false);
  });
});

describe('deleteTableSchema', () => {
  test('should require a table id', () => {
    expect(deleteTableSchema.safeParse({ id: '' }).success).toBe(false);
    expect(deleteTableSchema.safeParse({ id: 'table-1' }).success).toBe(true);
  });
});

describe('assignGuestSchema', () => {
  test('should require both guest and table ids', () => {
    expect(
      assignGuestSchema.safeParse({ guestId: 'g1', tableId: 't1' }).success,
    ).toBe(true);
    expect(
      assignGuestSchema.safeParse({ guestId: '', tableId: 't1' }).success,
    ).toBe(false);
    expect(
      assignGuestSchema.safeParse({ guestId: 'g1', tableId: '' }).success,
    ).toBe(false);
  });
});

describe('unassignGuestSchema', () => {
  test('should require a guest id', () => {
    expect(unassignGuestSchema.safeParse({ guestId: '' }).success).toBe(false);
    expect(unassignGuestSchema.safeParse({ guestId: 'g1' }).success).toBe(true);
  });
});
