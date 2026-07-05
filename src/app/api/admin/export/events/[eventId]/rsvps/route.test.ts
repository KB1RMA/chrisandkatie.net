/**
 * @vitest-environment node
 */

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  getAuthIdentity: vi.fn(),
}));

vi.mock('@/lib/db/repositories/events', () => ({
  findEventById: vi.fn(),
}));

vi.mock('@/lib/db/repositories/rsvpResponses', () => ({
  findEventRsvpRowsForExport: vi.fn(),
}));

import { describe, expect, test, beforeEach, vi } from 'vitest';
import { auth, getAuthIdentity } from '@/lib/auth';
import * as EventRepository from '@/lib/db/repositories/events';
import * as RsvpRepository from '@/lib/db/repositories/rsvpResponses';
import { GET } from './route';
import type { EventRsvpExportRow } from '@/lib/db/repositories/rsvpResponses';
import { makeSession } from '@/tests/helpers';

const mockAuth = vi.mocked(auth);
const mockGetAuthIdentity = vi.mocked(getAuthIdentity);
const mockFindEventById = vi.mocked(EventRepository.findEventById);
const mockFindEventRsvpRowsForExport = vi.mocked(
  RsvpRepository.findEventRsvpRowsForExport,
);

const SAMPLE_EVENT = {
  id: 'event-1',
  name: 'BBQ @ Chris & Katie’s House',
} as Awaited<ReturnType<typeof EventRepository.findEventById>>;

const SAMPLE_ROWS: EventRsvpExportRow[] = [
  {
    guestId: 'guest-1',
    guestFirstName: 'Chris',
    guestLastName: 'Smith',
    partyName: 'Smith Family',
    attendanceStatus: 'attending',
    specialRequests: 'High chair please',
    guestNotes: null,
    mealOption: 'option_a',
    dietaryRestrictions: 'Gluten free',
  },
  {
    guestId: 'guest-2',
    guestFirstName: 'Jane',
    guestLastName: 'Doe',
    partyName: 'Jane Doe',
    attendanceStatus: 'no_response',
    specialRequests: null,
    guestNotes: null,
    mealOption: null,
    dietaryRestrictions: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

/** Helper to build a GET Request and route context for the export route. */
function buildArgs(eventId = 'event-1') {
  return [
    new Request(`http://localhost/api/admin/export/events/${eventId}/rsvps`),
    { params: Promise.resolve({ eventId }) },
  ] as const;
}

describe('GET /api/admin/export/events/[eventId]/rsvps', () => {
  test('should return 401 when caller is unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    mockGetAuthIdentity.mockReturnValue(null);

    const response = await GET(...buildArgs());

    expect(response.status).toBe(401);
  });

  test('should return 401 when caller is a non-admin guest', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'inv-1',
    });

    const response = await GET(...buildArgs());

    expect(response.status).toBe(401);
  });

  test('should return 404 when the event does not exist', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'admin',
      username: 'admin',
    });
    mockFindEventById.mockResolvedValue(undefined);

    const response = await GET(...buildArgs('missing-event'));

    expect(response.status).toBe(404);
    const body = await response.json();

    expect(body).toEqual({ error: 'Event not found' });
  });

  test('should return 200 with CSV headers and a slugified filename', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'admin',
      username: 'admin',
    });
    mockFindEventById.mockResolvedValue(SAMPLE_EVENT);
    mockFindEventRsvpRowsForExport.mockResolvedValue(SAMPLE_ROWS);

    const response = await GET(...buildArgs());

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/csv');
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="bbq-chris-katie-s-house-rsvps.csv"',
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  test('should include the export column headers in the CSV response body', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'admin',
      username: 'admin',
    });
    mockFindEventById.mockResolvedValue(SAMPLE_EVENT);
    mockFindEventRsvpRowsForExport.mockResolvedValue(SAMPLE_ROWS);

    const response = await GET(...buildArgs());
    const text = await response.text();

    expect(text).toContain('"Guest Name"');
    expect(text).toContain('"RSVP Status"');
    expect(text).toContain('"Meal Choice"');
    expect(text).toContain('"Dietary Restrictions / Allergies"');
  });

  test('should map attendee meal options and statuses to labels', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'admin',
      username: 'admin',
    });
    mockFindEventById.mockResolvedValue(SAMPLE_EVENT);
    mockFindEventRsvpRowsForExport.mockResolvedValue(SAMPLE_ROWS);

    const response = await GET(...buildArgs());
    const text = await response.text();

    expect(text).toContain('"Attending"');
    expect(text).toContain('"Option A"');
    expect(text).toContain('"Gluten free"');
    expect(text).toContain('"High chair please"');
  });

  test('should emit a No Response row with empty attendee fields for guests without a response', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'admin',
      username: 'admin',
    });
    mockFindEventById.mockResolvedValue(SAMPLE_EVENT);
    mockFindEventRsvpRowsForExport.mockResolvedValue(SAMPLE_ROWS);

    const response = await GET(...buildArgs());
    const text = await response.text();

    expect(text).toContain('"Jane Doe","Jane Doe","No Response","","","",""');
  });
});
