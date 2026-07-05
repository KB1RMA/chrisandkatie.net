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

import { describe, expect, test, beforeEach, vi } from 'vitest';
import { auth, getAuthIdentity } from '@/lib/auth';
import * as GuestRepository from '@/lib/db/repositories/guests';
import { GET } from './route';
import type { VenueExportRow } from '@/lib/db/repositories/guests';
import { makeSession } from '@/tests/helpers';

const mockAuth = vi.mocked(auth);
const mockGetAuthIdentity = vi.mocked(getAuthIdentity);
const mockFindGuestsForVenueExport = vi.mocked(
  GuestRepository.findGuestsForVenueExport,
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
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

/** Helper to build a GET Request for the export route. */
function buildRequest(format?: string): Request {
  const url = format
    ? `http://localhost/api/admin/export/guests?format=${format}`
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
});
