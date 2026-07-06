/**
 * @vitest-environment node
 */

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  getAuthIdentity: vi.fn(),
}));

vi.mock('@/lib/db/repositories/seating', () => ({
  findSeatingAssignmentsForExport: vi.fn(),
}));

vi.mock('@/lib/db/repositories/events', () => ({
  findMainEvent: vi.fn(),
}));

vi.mock('@/lib/db/repositories/rsvpResponses', () => ({
  getEventRsvpReconstruction: vi.fn(),
}));

import { describe, expect, test, beforeEach, vi } from 'vitest';
import { auth, getAuthIdentity } from '@/lib/auth';
import * as EventRepository from '@/lib/db/repositories/events';
import * as RsvpRepository from '@/lib/db/repositories/rsvpResponses';
import * as SeatingRepository from '@/lib/db/repositories/seating';
import { GET } from './route';
import type { SeatingExportRow } from '@/lib/db/repositories/seating';
import type { EventRsvpGuestRow } from '@/lib/db/repositories/rsvpResponses';
import type { WeddingEvent } from '@/lib/db/schema';
import { makeSession } from '@/tests/helpers';

const mockAuth = vi.mocked(auth);
const mockGetAuthIdentity = vi.mocked(getAuthIdentity);
const mockFindSeatingAssignmentsForExport = vi.mocked(
  SeatingRepository.findSeatingAssignmentsForExport,
);
const mockFindMainEvent = vi.mocked(EventRepository.findMainEvent);
const mockGetEventRsvpReconstruction = vi.mocked(
  RsvpRepository.getEventRsvpReconstruction,
);

const SAMPLE_ROWS: SeatingExportRow[] = [
  {
    tableId: 'table-head',
    tableName: 'Head Table',
    tableSortOrder: 0,
    guestId: 'guest-chris',
    seatOrder: 0,
    firstName: 'Chris',
    lastName: 'Snyder',
    partyName: 'The Snyders',
    mealChoice: 'short-rib',
    dietaryRestrictions: null,
  },
  {
    tableId: 'table-head',
    tableName: 'Head Table',
    tableSortOrder: 0,
    guestId: 'guest-katie',
    seatOrder: 1,
    firstName: 'Katie',
    lastName: 'Snyder',
    partyName: 'The Snyders',
    mealChoice: 'roasted-chicken',
    dietaryRestrictions: 'No shellfish',
  },
  {
    tableId: 'table-1',
    tableName: 'Table 1',
    tableSortOrder: 1,
    guestId: 'guest-jane',
    seatOrder: 3,
    firstName: 'Jane',
    lastName: 'Doe',
    partyName: null,
    mealChoice: null,
    dietaryRestrictions: null,
  },
];

/** Builds a reconstructed per-event RSVP row for a guest. */
function makeReconstructedRow(
  overrides: Partial<EventRsvpGuestRow> = {},
): EventRsvpGuestRow {
  return {
    guestId: 'guest-jane',
    firstName: 'Jane',
    lastName: 'Doe',
    invitationId: 'inv-1',
    partyName: 'Jane Doe',
    notes: null,
    status: 'attending',
    mealOption: null,
    dietaryRestrictions: null,
    specialRequests: null,
    ...overrides,
  };
}

/** Builds the main event row fixture. */
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

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMainEvent.mockResolvedValue(makeMainEvent());
  mockGetEventRsvpReconstruction.mockResolvedValue({
    rows: [],
    summary: { attending: 0, notAttending: 0, noResponse: 0, total: 0 },
  });
});

/** Helper to build a GET Request for the seating export route. */
function buildRequest(format?: string): Request {
  const url = format
    ? `http://localhost/api/admin/export/seating?format=${format}`
    : `http://localhost/api/admin/export/seating`;

  return new Request(url);
}

/** Helper to authenticate the mocked session as an admin. */
function mockAdminSession(): void {
  mockAuth.mockResolvedValue(makeSession());
  mockGetAuthIdentity.mockReturnValue({
    type: 'admin',
    username: 'admin',
  });
}

describe('GET /api/admin/export/seating', () => {
  test('should return 401 when caller is unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    mockGetAuthIdentity.mockReturnValue(null);

    const response = await GET(buildRequest('coordinator'));

    expect(response.status).toBe(401);
  });

  test('should return 401 when caller is a non-admin guest', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'inv-1',
    });

    const response = await GET(buildRequest('coordinator'));

    expect(response.status).toBe(401);
  });

  test('should return 400 with error message for an unknown format param', async () => {
    mockAdminSession();

    const response = await GET(buildRequest('unknown'));

    expect(response.status).toBe(400);
    const body = await response.json();

    expect(body).toEqual({ error: 'Unknown export format' });
  });

  test('should return 400 when format param is missing', async () => {
    mockAdminSession();

    const response = await GET(buildRequest());

    expect(response.status).toBe(400);
  });

  test('should return 400 when no main event exists', async () => {
    mockAdminSession();
    mockFindMainEvent.mockResolvedValue(undefined);

    const response = await GET(buildRequest('coordinator'));

    expect(response.status).toBe(400);
    expect(mockFindSeatingAssignmentsForExport).not.toHaveBeenCalled();
  });

  test('should scope the export to the main event', async () => {
    mockAdminSession();
    mockFindSeatingAssignmentsForExport.mockResolvedValue(SAMPLE_ROWS);

    await GET(buildRequest('coordinator'));

    expect(mockFindSeatingAssignmentsForExport).toHaveBeenCalledWith(
      'event-main',
    );
    expect(mockGetEventRsvpReconstruction).toHaveBeenCalledWith('event-main');
  });

  test('should prefer per-event attendee meal data over guest columns', async () => {
    mockAdminSession();
    mockFindSeatingAssignmentsForExport.mockResolvedValue([
      { ...SAMPLE_ROWS[0], mealChoice: 'short-rib', dietaryRestrictions: null },
    ]);
    mockGetEventRsvpReconstruction.mockResolvedValue({
      rows: [
        makeReconstructedRow({
          guestId: 'guest-chris',
          mealOption: 'roasted-chicken',
          dietaryRestrictions: 'No nuts',
        }),
      ],
      summary: { attending: 1, notAttending: 0, noResponse: 0, total: 1 },
    });

    const response = await GET(buildRequest('coordinator'));
    const text = await response.text();

    expect(text).toContain('"Roasted Chicken"');
    expect(text).toContain('"No nuts"');
    expect(text).not.toContain('"Short Rib"');
  });

  test('should fall back to guest columns when the event has no attendee data', async () => {
    mockAdminSession();
    mockFindSeatingAssignmentsForExport.mockResolvedValue([SAMPLE_ROWS[0]]);

    const response = await GET(buildRequest('coordinator'));
    const text = await response.text();

    expect(text).toContain('"Short Rib"');
  });

  test('should return 200 with correct CSV headers for format=coordinator', async () => {
    mockAdminSession();
    mockFindSeatingAssignmentsForExport.mockResolvedValue(SAMPLE_ROWS);

    const response = await GET(buildRequest('coordinator'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/csv');
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="seating-chart.csv"',
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  test('should include the coordinator column headers in the CSV body', async () => {
    mockAdminSession();
    mockFindSeatingAssignmentsForExport.mockResolvedValue(SAMPLE_ROWS);

    const response = await GET(buildRequest('coordinator'));
    const text = await response.text();

    expect(text).toContain('"Table","Seat","Guest Name","Party"');
    expect(text).toContain('"Meal Choice"');
    expect(text).toContain('"Dietary Restrictions / Allergies"');
  });

  test('should restart seat numbering at 1 for each table', async () => {
    mockAdminSession();
    mockFindSeatingAssignmentsForExport.mockResolvedValue(SAMPLE_ROWS);

    const response = await GET(buildRequest('coordinator'));
    const text = await response.text();

    expect(text).toContain('"Head Table","1","Chris Snyder"');
    expect(text).toContain('"Head Table","2","Katie Snyder"');
    expect(text).toContain('"Table 1","1","Jane Doe"');
  });

  test('should restart seat numbering between adjacent tables that share a name', async () => {
    mockAdminSession();
    mockFindSeatingAssignmentsForExport.mockResolvedValue([
      { ...SAMPLE_ROWS[2], tableId: 'table-a', tableName: 'Family' },
      { ...SAMPLE_ROWS[2], tableId: 'table-b', tableName: 'Family' },
    ]);

    const response = await GET(buildRequest('coordinator'));
    const text = await response.text();

    expect(text).not.toContain('"Family","2"');
    expect(text.match(/"Family","1"/g)).toHaveLength(2);
  });

  test('should fall back to guest name when the party name is blank', async () => {
    mockAdminSession();
    mockFindSeatingAssignmentsForExport.mockResolvedValue([
      { ...SAMPLE_ROWS[2], partyName: '  ' },
    ]);

    const response = await GET(buildRequest('coordinator'));
    const text = await response.text();

    expect(text).toContain('"Jane Doe","Jane Doe"');
  });

  test('should map meal choices to labels and fall back to guest name for Party', async () => {
    mockAdminSession();
    mockFindSeatingAssignmentsForExport.mockResolvedValue(SAMPLE_ROWS);

    const response = await GET(buildRequest('coordinator'));
    const text = await response.text();

    expect(text).toContain('"Short Rib"');
    expect(text).toContain('"Roasted Chicken"');
    expect(text).toContain('"No shellfish"');
    expect(text).toContain('"Jane Doe","Jane Doe","",""');
  });
});
