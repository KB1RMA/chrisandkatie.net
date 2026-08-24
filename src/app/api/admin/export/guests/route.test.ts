/**
 * @vitest-environment node
 */

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  getAuthIdentity: vi.fn(),
}));

vi.mock('@/lib/db/repositories/guests', () => ({
  findGuestsForVenueExport: vi.fn(),
}));

vi.mock('@/lib/db/repositories/events', () => ({
  findEventById: vi.fn(),
}));

vi.mock('@/lib/db/repositories/rsvpResponses', () => ({
  getEventRsvpReconstruction: vi.fn(),
}));

import { describe, expect, test, beforeEach, vi } from 'vitest';
import { auth, getAuthIdentity } from '@/lib/auth';
import * as GuestRepository from '@/lib/db/repositories/guests';
import * as EventRepository from '@/lib/db/repositories/events';
import * as RsvpRepository from '@/lib/db/repositories/rsvpResponses';
import { GET } from './route';
import type { VenueExportRow } from '@/lib/db/repositories/guests';
import { makeSession } from '@/tests/helpers';

const mockAuth = vi.mocked(auth);
const mockGetAuthIdentity = vi.mocked(getAuthIdentity);
const mockFindGuestsForVenueExport = vi.mocked(
  GuestRepository.findGuestsForVenueExport,
);
const mockFindEventById = vi.mocked(EventRepository.findEventById);
const mockGetEventRsvpReconstruction = vi.mocked(
  RsvpRepository.getEventRsvpReconstruction,
);

const SAMPLE_ROWS: VenueExportRow[] = [
  {
    guestId: 'guest-1',
    firstName: 'Chris',
    lastName: 'Smith',
    type: 'adult',
    attending: true,
    mealChoice: 'short-rib',
    dietaryRestrictions: 'Peanut allergy',
    notes: 'Best man',
    partyName: 'Smith Family',
    tableName: null,
  },
  {
    guestId: 'guest-2',
    firstName: 'Jane',
    lastName: 'Doe',
    type: 'child',
    attending: null,
    mealChoice: null,
    dietaryRestrictions: null,
    notes: null,
    partyName: null,
    tableName: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetEventRsvpReconstruction.mockResolvedValue(makeReconstruction([]));
});

/** Signs the caller in as an admin for the request under test. */
function signInAsAdmin(): void {
  mockAuth.mockResolvedValue(makeSession());
  mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
}

/** Builds an event row for `findEventById` to resolve with. */
function makeEvent(
  overrides: { id?: string; name?: string; type?: string } = {},
) {
  return {
    id: 'event-1',
    name: 'Reception',
    type: 'main',
    ...overrides,
  } as Awaited<ReturnType<typeof EventRepository.findEventById>>;
}

/** Builds a reconstruction result with only the fields the route reads. */
function makeReconstruction(
  rows: Array<{
    guestId: string;
    status: 'attending' | 'not_attending' | 'no_response';
    mealOption?: string | null;
    dietaryRestrictions?: string | null;
  }>,
) {
  return {
    rows: rows.map((row) => ({
      mealOption: null,
      dietaryRestrictions: null,
      ...row,
    })),
    summary: {},
  } as Awaited<ReturnType<typeof RsvpRepository.getEventRsvpReconstruction>>;
}

/** Helper to build a GET Request for the export route. */
function buildRequest(format?: string, eventId?: string): Request {
  const params = new URLSearchParams();

  if (format) {
    params.set('format', format);
  }

  if (eventId) {
    params.set('eventId', eventId);
  }

  const query = params.toString();
  const url = query
    ? `http://localhost/api/admin/export/guests?${query}`
    : `http://localhost/api/admin/export/guests`;

  return new Request(url);
}

describe('GET /api/admin/export/guests', () => {
  test('should return 401 when caller is unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    mockGetAuthIdentity.mockReturnValue(null);

    const response = await GET(buildRequest('venue'));

    expect(response.status).toBe(401);
  });

  test('should return 401 when caller is a non-admin guest', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'inv-1',
    });

    const response = await GET(buildRequest('venue'));

    expect(response.status).toBe(401);
  });

  test('should return 400 with error message for an unknown format param', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'admin',
      username: 'admin',
    });

    const response = await GET(buildRequest('unknown'));

    expect(response.status).toBe(400);
    const body = await response.json();

    expect(body).toEqual({ error: 'Unknown export format' });
  });

  test('should return 400 when format param is missing', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'admin',
      username: 'admin',
    });

    const response = await GET(buildRequest());

    expect(response.status).toBe(400);
  });

  test('should return 200 with correct CSV headers for format=venue', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'admin',
      username: 'admin',
    });
    mockFindGuestsForVenueExport.mockResolvedValue(SAMPLE_ROWS);

    const response = await GET(buildRequest('venue'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/csv');
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="venue-guest-list.csv"',
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  test('should include the venue column headers in the CSV response body', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'admin',
      username: 'admin',
    });
    mockFindGuestsForVenueExport.mockResolvedValue(SAMPLE_ROWS);

    const response = await GET(buildRequest('venue'));
    const text = await response.text();

    expect(text).toContain('"Guest Name"');
    expect(text).toContain('"Meal Choice"');
    expect(text).toContain('"Dietary Restrictions / Allergies"');
  });

  test('should map meal choice values and attendance flags to labels', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'admin',
      username: 'admin',
    });
    mockFindGuestsForVenueExport.mockResolvedValue(SAMPLE_ROWS);

    const response = await GET(buildRequest('venue'));
    const text = await response.text();

    expect(text).toContain('"Short Rib"');
    expect(text).toContain('"Peanut allergy"');
    expect(text).toContain('"Yes"');
    expect(text).toContain('"No Response"');
  });

  test('should fall back to the guest name for Party when partyName is null', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'admin',
      username: 'admin',
    });
    mockFindGuestsForVenueExport.mockResolvedValue(SAMPLE_ROWS);

    const response = await GET(buildRequest('venue'));
    const text = await response.text();

    expect(text).toContain('"Jane Doe","Jane Doe","Child","No Response"');
  });

  test('should call findGuestsForVenueExport with undefined when eventId is omitted', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'admin',
      username: 'admin',
    });
    mockFindGuestsForVenueExport.mockResolvedValue(SAMPLE_ROWS);

    await GET(buildRequest('venue'));

    expect(mockFindGuestsForVenueExport).toHaveBeenCalledWith(undefined);
  });

  test('should return 400 when eventId is provided but the event is not found', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'admin',
      username: 'admin',
    });
    mockFindEventById.mockResolvedValue(undefined);

    const response = await GET(buildRequest('venue', 'missing-event'));

    expect(response.status).toBe(400);
    const body = await response.json();

    expect(body).toEqual({ error: 'Event not found' });
    expect(mockFindGuestsForVenueExport).not.toHaveBeenCalled();
  });

  test('should call findGuestsForVenueExport with the eventId when provided', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'admin',
      username: 'admin',
    });
    mockFindEventById.mockResolvedValue(makeEvent());
    mockFindGuestsForVenueExport.mockResolvedValue(SAMPLE_ROWS);

    await GET(buildRequest('venue', 'event-1'));

    expect(mockFindGuestsForVenueExport).toHaveBeenCalledWith('event-1');
  });

  test('should include a Table column with tableName only when eventId is given', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'admin',
      username: 'admin',
    });
    mockFindEventById.mockResolvedValue(makeEvent());
    mockFindGuestsForVenueExport.mockResolvedValue([
      { ...SAMPLE_ROWS[0], tableName: 'Table 3' },
      { ...SAMPLE_ROWS[1], tableName: null },
    ]);

    const response = await GET(buildRequest('venue', 'event-1'));
    const text = await response.text();

    expect(text).toContain('"Table"');
    expect(text).toContain('"Table 3"');
  });

  test('should not include a Table column when eventId is omitted', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'admin',
      username: 'admin',
    });
    mockFindGuestsForVenueExport.mockResolvedValue(SAMPLE_ROWS);

    const response = await GET(buildRequest('venue'));
    const text = await response.text();

    expect(text).not.toContain('"Table"');
  });

  test('should not leak wedding meal or attendance data into a non-main event export', async () => {
    signInAsAdmin();
    mockFindEventById.mockResolvedValue(
      makeEvent({ id: 'event-2', name: 'Welcome Party', type: 'other' }),
    );
    mockGetEventRsvpReconstruction.mockResolvedValue(
      makeReconstruction([
        {
          guestId: 'guest-1',
          status: 'not_attending',
        },
      ]),
    );
    mockFindGuestsForVenueExport.mockResolvedValue([
      { ...SAMPLE_ROWS[0], tableName: 'Table 3' },
    ]);

    const response = await GET(buildRequest('venue', 'event-2'));
    const text = await response.text();

    // guest-1 declined the welcome party but is a 'short-rib' wedding guest
    expect(text).toContain('"No","","","Best man","Table 3"');
    expect(text).not.toContain('Short Rib');
    expect(text).not.toContain('Peanut allergy');
  });

  test('should use the event RSVP meal and dietary details for a non-main event', async () => {
    signInAsAdmin();
    mockFindEventById.mockResolvedValue(
      makeEvent({ id: 'event-2', name: 'Welcome Party', type: 'other' }),
    );
    mockGetEventRsvpReconstruction.mockResolvedValue(
      makeReconstruction([
        {
          guestId: 'guest-1',
          status: 'attending',
          mealOption: 'option_b',
          dietaryRestrictions: 'Shellfish',
        },
      ]),
    );
    mockFindGuestsForVenueExport.mockResolvedValue([
      { ...SAMPLE_ROWS[0], tableName: 'Table 3' },
    ]);

    const response = await GET(buildRequest('venue', 'event-2'));
    const text = await response.text();

    expect(text).toContain('"Yes","Option B","Shellfish"');
  });

  test('should mark guests who were never invited to a non-main event', async () => {
    signInAsAdmin();
    mockFindEventById.mockResolvedValue(
      makeEvent({ id: 'event-2', name: 'Welcome Party', type: 'other' }),
    );
    mockGetEventRsvpReconstruction.mockResolvedValue(makeReconstruction([]));
    mockFindGuestsForVenueExport.mockResolvedValue([SAMPLE_ROWS[0]]);

    const response = await GET(buildRequest('venue', 'event-2'));
    const text = await response.text();

    expect(text).toContain('"Not Invited"');
  });

  test('should fall back to guest-level RSVP data for the main event', async () => {
    signInAsAdmin();
    mockFindEventById.mockResolvedValue(makeEvent({ type: 'main' }));
    mockGetEventRsvpReconstruction.mockResolvedValue(
      makeReconstruction([{ guestId: 'guest-1', status: 'no_response' }]),
    );
    mockFindGuestsForVenueExport.mockResolvedValue([
      { ...SAMPLE_ROWS[0], tableName: 'Table 3' },
    ]);

    const response = await GET(buildRequest('venue', 'event-1'));
    const text = await response.text();

    expect(text).toContain('"Yes","Short Rib","Peanut allergy"');
  });

  test('should not query event RSVPs when no eventId is given', async () => {
    signInAsAdmin();
    mockFindGuestsForVenueExport.mockResolvedValue(SAMPLE_ROWS);

    await GET(buildRequest('venue'));

    expect(mockGetEventRsvpReconstruction).not.toHaveBeenCalled();
    expect(mockFindEventById).not.toHaveBeenCalled();
  });

  test('should qualify the download filename with the event name', async () => {
    signInAsAdmin();
    mockFindEventById.mockResolvedValue(
      makeEvent({ id: 'event-2', name: 'Welcome Party', type: 'other' }),
    );
    mockFindGuestsForVenueExport.mockResolvedValue(SAMPLE_ROWS);

    const response = await GET(buildRequest('venue', 'event-2'));

    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="venue-guest-list-welcome-party.csv"',
    );
  });

  test('should use the plain filename when no eventId is given', async () => {
    signInAsAdmin();
    mockFindGuestsForVenueExport.mockResolvedValue(SAMPLE_ROWS);

    const response = await GET(buildRequest('venue'));

    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="venue-guest-list.csv"',
    );
  });
});
