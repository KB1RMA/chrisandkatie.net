/**
 * Zod schemas for seating chart server action validation.
 *
 * Validates table generation, table edits, and guest seat assignment
 * inputs before any data operation runs.
 */
import { z } from 'zod';

/** Upper bound on the number of tables that can be generated at once. */
export const MAX_TABLE_COUNT = 50;

/** Upper bound on seats at a single table. */
export const MAX_TABLE_CAPACITY = 30;

const tableCapacitySchema = z
  .number()
  .int('Seat counts must be whole numbers')
  .min(1, 'Tables must have at least 1 seat')
  .max(MAX_TABLE_CAPACITY, `Tables cannot exceed ${MAX_TABLE_CAPACITY} seats`);

const tableNameSchema = z
  .string()
  .trim()
  .min(1, 'Table name is required')
  .max(60, 'Table name must be 60 characters or fewer');

/**
 * Validation schema for generating the initial set of seating tables.
 */
export const generateTablesSchema = z.object({
  tableCount: z
    .number()
    .int('Table count must be a whole number')
    .min(1, 'At least 1 table is required')
    .max(MAX_TABLE_COUNT, `Table count cannot exceed ${MAX_TABLE_COUNT}`),
  seatsPerTable: tableCapacitySchema,
  includeHeadTable: z.boolean(),
  headTableSeats: tableCapacitySchema,
});

export type GenerateTablesData = z.infer<typeof generateTablesSchema>;

/**
 * Validation schema for adding a single seating table.
 */
export const addTableSchema = z.object({
  name: tableNameSchema,
  capacity: tableCapacitySchema,
});

export type AddTableData = z.infer<typeof addTableSchema>;

/**
 * Validation schema for renaming a table or changing its capacity.
 */
export const updateTableSchema = z.object({
  id: z.string().min(1, 'Table id is required'),
  name: tableNameSchema,
  capacity: tableCapacitySchema,
});

export type UpdateTableData = z.infer<typeof updateTableSchema>;

/**
 * Validation schema for deleting a seating table.
 */
export const deleteTableSchema = z.object({
  id: z.string().min(1, 'Table id is required'),
});

export type DeleteTableData = z.infer<typeof deleteTableSchema>;

/**
 * Validation schema for seating a guest at a table.
 */
export const assignGuestSchema = z.object({
  guestId: z.string().min(1, 'Guest id is required'),
  tableId: z.string().min(1, 'Table id is required'),
});

export type AssignGuestData = z.infer<typeof assignGuestSchema>;

/**
 * Validation schema for removing a guest's seat assignment.
 */
export const unassignGuestSchema = z.object({
  guestId: z.string().min(1, 'Guest id is required'),
});

export type UnassignGuestData = z.infer<typeof unassignGuestSchema>;
