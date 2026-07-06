/**
 * @vitest-environment node
 */

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  getAuthIdentity: vi.fn(),
}));

vi.mock('@/lib/db/repositories/seating', () => ({
  findAllSeatingTables: vi.fn(),
  findSeatingTableById: vi.fn(),
  countAssignmentsForTable: vi.fn(),
  insertSeatingTables: vi.fn(),
  updateSeatingTable: vi.fn(),
  deleteSeatingTable: vi.fn(),
  findAssignmentByGuestId: vi.fn(),
  upsertAssignment: vi.fn(),
  deleteAssignmentForGuest: vi.fn(),
}));

vi.mock('@/lib/db/repositories/guests', () => ({
  findGuestById: vi.fn(),
}));

vi.mock('@/lib/db/repositories/events', () => ({
  findMainEvent: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { expect, test, describe, beforeEach, vi } from 'vitest';
import { auth, getAuthIdentity } from '@/lib/auth';
import * as EventRepository from '@/lib/db/repositories/events';
import * as SeatingRepository from '@/lib/db/repositories/seating';
import * as GuestRepository from '@/lib/db/repositories/guests';
import type { WeddingEvent } from '@/lib/db/schema';
import { makeSession } from '@/tests/helpers';
import {
  addSeatingTable,
  assignGuestToTable,
  deleteSeatingTable,
  generateSeatingTables,
  unassignGuest,
  updateSeatingTableDetails,
} from './actions';

const mockAuth = vi.mocked(auth);
const mockGetAuthIdentity = vi.mocked(getAuthIdentity);
const mockFindAllSeatingTables = vi.mocked(
  SeatingRepository.findAllSeatingTables,
);
const mockFindSeatingTableById = vi.mocked(
  SeatingRepository.findSeatingTableById,
);
const mockCountAssignmentsForTable = vi.mocked(
  SeatingRepository.countAssignmentsForTable,
);
const mockInsertSeatingTables = vi.mocked(
  SeatingRepository.insertSeatingTables,
);
const mockUpdateSeatingTable = vi.mocked(SeatingRepository.updateSeatingTable);
const mockDeleteSeatingTableRepo = vi.mocked(
  SeatingRepository.deleteSeatingTable,
);
const mockFindAssignmentByGuestId = vi.mocked(
  SeatingRepository.findAssignmentByGuestId,
);
const mockUpsertAssignment = vi.mocked(SeatingRepository.upsertAssignment);
const mockDeleteAssignmentForGuest = vi.mocked(
  SeatingRepository.deleteAssignmentForGuest,
);
const mockFindGuestById = vi.mocked(GuestRepository.findGuestById);
const mockFindMainEvent = vi.mocked(EventRepository.findMainEvent);

/** Marks the mocked session as an authenticated admin. */
function mockAdminSession(): void {
  mockAuth.mockResolvedValue(makeSession());
  mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
}

/** Builds the main event row fixture the seating chart is scoped to. */
function makeMainEvent(): WeddingEvent {
  return {
    id: 'event-main',
    name: 'Wedding Reception',
    description: null,
    location: null,
    eventDate: '2026-09-12',
    startTime: '17:00',
    endTime: '23:00',
    type: 'main',
    dressCode: null,
    parkingInfo: null,
    locationLat: null,
    locationLng: null,
    sortOrder: 0,
    rsvpRequired: false,
    createdAt: '2026-07-06T00:00:00.000Z',
    updatedAt: '2026-07-06T00:00:00.000Z',
  };
}

/** Builds a SeatingTable row fixture. */
function makeTable(
  overrides: Partial<{
    id: string;
    eventId: string;
    name: string;
    capacity: number;
    isHeadTable: boolean;
    sortOrder: number;
  }> = {},
) {
  return {
    id: 'table-1',
    eventId: 'event-main',
    name: 'Table 1',
    capacity: 8,
    isHeadTable: false,
    sortOrder: 1,
    createdAt: '2026-07-06T00:00:00.000Z',
    updatedAt: '2026-07-06T00:00:00.000Z',
    ...overrides,
  };
}

const VALID_GENERATE_INPUT = {
  tableCount: 10,
  seatsPerTable: 8,
  includeHeadTable: true,
  headTableSeats: 8,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMainEvent.mockResolvedValue(makeMainEvent());
});

describe('generateSeatingTables', () => {
  test('should throw Unauthorized when session is not admin', async () => {
    mockAuth.mockResolvedValue(null);
    mockGetAuthIdentity.mockReturnValue(null);

    await expect(generateSeatingTables(VALID_GENERATE_INPUT)).rejects.toThrow(
      'Unauthorized',
    );
  });

  test('should return a validation error for an invalid table count', async () => {
    mockAdminSession();

    const result = await generateSeatingTables({
      ...VALID_GENERATE_INPUT,
      tableCount: 0,
    });

    expect(result).toEqual({
      success: false,
      error: 'At least 1 table is required',
    });
    expect(mockInsertSeatingTables).not.toHaveBeenCalled();
  });

  test('should return an error when no main event exists', async () => {
    mockAdminSession();
    mockFindMainEvent.mockResolvedValue(undefined);

    const result = await generateSeatingTables(VALID_GENERATE_INPUT);

    expect(result.success).toBe(false);
    expect(mockInsertSeatingTables).not.toHaveBeenCalled();
  });

  test('should refuse to generate when tables already exist', async () => {
    mockAdminSession();
    mockFindAllSeatingTables.mockResolvedValue([
      { ...makeTable(), assignments: [] },
    ]);

    const result = await generateSeatingTables(VALID_GENERATE_INPUT);

    expect(result.success).toBe(false);
    expect(mockInsertSeatingTables).not.toHaveBeenCalled();
  });

  test('should create a head table plus numbered tables', async () => {
    mockAdminSession();
    mockFindAllSeatingTables.mockResolvedValue([]);

    const result = await generateSeatingTables(VALID_GENERATE_INPUT);

    expect(result).toEqual({ success: true });

    const rows = mockInsertSeatingTables.mock.calls[0][0];

    expect(rows).toHaveLength(10);
    expect(rows[0]).toMatchObject({
      eventId: 'event-main',
      name: 'Head Table',
      isHeadTable: true,
      capacity: 8,
      sortOrder: 0,
    });
    expect(rows[1]).toMatchObject({ name: 'Table 1', sortOrder: 1 });
    expect(rows[9]).toMatchObject({ name: 'Table 9', sortOrder: 9 });
  });

  test('should create only numbered tables when head table is excluded', async () => {
    mockAdminSession();
    mockFindAllSeatingTables.mockResolvedValue([]);

    await generateSeatingTables({
      ...VALID_GENERATE_INPUT,
      tableCount: 3,
      includeHeadTable: false,
    });

    const rows = mockInsertSeatingTables.mock.calls[0][0];

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.name)).toEqual([
      'Table 1',
      'Table 2',
      'Table 3',
    ]);
  });
});

describe('addSeatingTable', () => {
  test('should return a validation error for a blank name', async () => {
    mockAdminSession();

    const result = await addSeatingTable({ name: '  ', capacity: 8 });

    expect(result).toEqual({
      success: false,
      error: 'Table name is required',
    });
  });

  test('should append after the highest existing sortOrder', async () => {
    mockAdminSession();
    mockFindAllSeatingTables.mockResolvedValue([
      { ...makeTable({ sortOrder: 4 }), assignments: [] },
    ]);

    const result = await addSeatingTable({ name: 'Kids Table', capacity: 6 });

    expect(result).toEqual({ success: true });
    expect(mockInsertSeatingTables).toHaveBeenCalledWith([
      expect.objectContaining({
        eventId: 'event-main',
        name: 'Kids Table',
        capacity: 6,
        sortOrder: 5,
      }),
    ]);
  });

  test('should return an error when no main event exists', async () => {
    mockAdminSession();
    mockFindMainEvent.mockResolvedValue(undefined);

    const result = await addSeatingTable({ name: 'Kids Table', capacity: 6 });

    expect(result.success).toBe(false);
    expect(mockInsertSeatingTables).not.toHaveBeenCalled();
  });
});

describe('updateSeatingTableDetails', () => {
  test('should return an error when the table does not exist', async () => {
    mockAdminSession();
    mockFindSeatingTableById.mockResolvedValue(undefined);

    const result = await updateSeatingTableDetails({
      id: 'missing',
      name: 'Table X',
      capacity: 8,
    });

    expect(result).toEqual({ success: false, error: 'Table not found.' });
  });

  test('should refuse a capacity below the seated guest count', async () => {
    mockAdminSession();
    mockFindSeatingTableById.mockResolvedValue(makeTable());
    mockCountAssignmentsForTable.mockResolvedValue(6);

    const result = await updateSeatingTableDetails({
      id: 'table-1',
      name: 'Table 1',
      capacity: 4,
    });

    expect(result.success).toBe(false);
    expect(mockUpdateSeatingTable).not.toHaveBeenCalled();
  });

  test('should persist a valid rename and capacity change', async () => {
    mockAdminSession();
    mockFindSeatingTableById.mockResolvedValue(makeTable());
    mockCountAssignmentsForTable.mockResolvedValue(2);

    const result = await updateSeatingTableDetails({
      id: 'table-1',
      name: 'Family Table',
      capacity: 10,
    });

    expect(result).toEqual({ success: true });
    expect(mockUpdateSeatingTable).toHaveBeenCalledWith('table-1', {
      name: 'Family Table',
      capacity: 10,
    });
  });
});

describe('deleteSeatingTable', () => {
  test('should return an error when the table does not exist', async () => {
    mockAdminSession();
    mockFindSeatingTableById.mockResolvedValue(undefined);

    const result = await deleteSeatingTable({ id: 'missing' });

    expect(result).toEqual({ success: false, error: 'Table not found.' });
    expect(mockDeleteSeatingTableRepo).not.toHaveBeenCalled();
  });

  test('should delete an existing table', async () => {
    mockAdminSession();
    mockFindSeatingTableById.mockResolvedValue(makeTable());

    const result = await deleteSeatingTable({ id: 'table-1' });

    expect(result).toEqual({ success: true });
    expect(mockDeleteSeatingTableRepo).toHaveBeenCalledWith('table-1');
  });
});

describe('assignGuestToTable', () => {
  test('should return an error when the guest does not exist', async () => {
    mockAdminSession();
    mockFindGuestById.mockResolvedValue(undefined);

    const result = await assignGuestToTable({
      guestId: 'missing',
      tableId: 'table-1',
    });

    expect(result).toEqual({ success: false, error: 'Guest not found.' });
  });

  test('should return an error when the table is full', async () => {
    mockAdminSession();
    mockFindGuestById.mockResolvedValue({ id: 'guest-1' } as never);
    mockFindSeatingTableById.mockResolvedValue(makeTable({ capacity: 2 }));
    mockFindAssignmentByGuestId.mockResolvedValue(undefined);
    mockCountAssignmentsForTable.mockResolvedValue(2);

    const result = await assignGuestToTable({
      guestId: 'guest-1',
      tableId: 'table-1',
    });

    expect(result).toEqual({ success: false, error: 'Table 1 is full.' });
    expect(mockUpsertAssignment).not.toHaveBeenCalled();
  });

  test('should no-op when the guest is already at the target table', async () => {
    mockAdminSession();
    mockFindGuestById.mockResolvedValue({ id: 'guest-1' } as never);
    mockFindSeatingTableById.mockResolvedValue(makeTable());
    mockFindAssignmentByGuestId.mockResolvedValue({
      id: 'assignment-1',
      guestId: 'guest-1',
      tableId: 'table-1',
      eventId: 'event-main',
      seatOrder: 0,
      createdAt: '2026-07-06T00:00:00.000Z',
    });

    const result = await assignGuestToTable({
      guestId: 'guest-1',
      tableId: 'table-1',
    });

    expect(result).toEqual({ success: true });
    expect(mockUpsertAssignment).not.toHaveBeenCalled();
  });

  test('should seat the guest when the table has room', async () => {
    mockAdminSession();
    mockFindGuestById.mockResolvedValue({ id: 'guest-1' } as never);
    mockFindSeatingTableById.mockResolvedValue(makeTable());
    mockFindAssignmentByGuestId.mockResolvedValue(undefined);
    mockCountAssignmentsForTable.mockResolvedValue(3);

    const result = await assignGuestToTable({
      guestId: 'guest-1',
      tableId: 'table-1',
    });

    expect(result).toEqual({ success: true });
    expect(mockUpsertAssignment).toHaveBeenCalledWith(
      'guest-1',
      'table-1',
      'event-main',
    );
  });
});

describe('unassignGuest', () => {
  test('should throw Unauthorized when session is not admin', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'inv-1',
    });

    await expect(unassignGuest({ guestId: 'guest-1' })).rejects.toThrow(
      'Unauthorized',
    );
  });

  test('should return a validation error for an empty guest id', async () => {
    mockAdminSession();

    const result = await unassignGuest({ guestId: '' });

    expect(result).toEqual({ success: false, error: 'Guest id is required' });
    expect(mockDeleteAssignmentForGuest).not.toHaveBeenCalled();
  });

  test('should delete the assignment for the guest on the main event', async () => {
    mockAdminSession();

    const result = await unassignGuest({ guestId: 'guest-1' });

    expect(result).toEqual({ success: true });
    expect(mockDeleteAssignmentForGuest).toHaveBeenCalledWith(
      'guest-1',
      'event-main',
    );
  });

  test('should return an error when no main event exists', async () => {
    mockAdminSession();
    mockFindMainEvent.mockResolvedValue(undefined);

    const result = await unassignGuest({ guestId: 'guest-1' });

    expect(result.success).toBe(false);
    expect(mockDeleteAssignmentForGuest).not.toHaveBeenCalled();
  });
});
