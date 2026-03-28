/**
 * @vitest-environment node
 */

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  getAuthIdentity: vi.fn(),
}));

vi.mock('@/lib/db/repositories/invitations', () => ({
  findInvitationsForExport: vi.fn(),
}));

import { describe, expect, test, beforeEach, vi } from 'vitest';
import { auth, getAuthIdentity } from '@/lib/auth';
import * as InvitationRepository from '@/lib/db/repositories/invitations';
import { GET } from './route';
import type { InvitationExportRow } from '@/lib/db/repositories/invitations';
import { makeSession } from '@/tests/helpers';

const mockAuth = vi.mocked(auth);
const mockGetAuthIdentity = vi.mocked(getAuthIdentity);
const mockFindInvitationsForExport = vi.mocked(
  InvitationRepository.findInvitationsForExport,
);

const SAMPLE_ROWS: InvitationExportRow[] = [
  {
    id: 'inv-1',
    mailingAddress: 'Smith Family',
    address: '123 Main St',
    addressLine2: null,
    city: 'Springfield',
    state: 'IL',
    zipCode: '62701',
    country: 'United States',
    contactEmail: 'smith@example.com',
    primaryGuestFirstName: 'Chris',
    primaryGuestLastName: 'Smith',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

/** Helper to build a GET Request for the export route. */
function buildRequest(format?: string): Request {
  const url = format
    ? `http://localhost/api/admin/export/invitations?format=${format}`
    : `http://localhost/api/admin/export/invitations`;

  return new Request(url);
}

describe('GET /api/admin/export/invitations', () => {
  test('should return 401 when caller is unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    mockGetAuthIdentity.mockReturnValue(null);

    const response = await GET(buildRequest('minted'));

    expect(response.status).toBe(401);
  });

  test('should return 401 when caller is a non-admin guest', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'inv-1',
    });

    const response = await GET(buildRequest('minted'));

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

  test('should return 200 with correct CSV headers for format=minted', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'admin',
      username: 'admin',
    });
    mockFindInvitationsForExport.mockResolvedValue(SAMPLE_ROWS);

    const response = await GET(buildRequest('minted'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/csv');
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="invitations-minted-address-book.csv"',
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  test('should include the Minted column headers in the CSV response body', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'admin',
      username: 'admin',
    });
    mockFindInvitationsForExport.mockResolvedValue(SAMPLE_ROWS);

    const response = await GET(buildRequest('minted'));
    const text = await response.text();

    expect(text).toContain('"Name on Envelope"');
    expect(text).toContain('"Street Address 1"');
    expect(text).toContain('"Phone (Optional)"');
  });

  test('should use mailingAddress directly as Name on Envelope when present', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'admin',
      username: 'admin',
    });
    mockFindInvitationsForExport.mockResolvedValue(SAMPLE_ROWS);

    const response = await GET(buildRequest('minted'));
    const text = await response.text();

    expect(text).toContain('"Smith Family"');
  });

  test('should fall back to primary guest name when mailingAddress is null', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'admin',
      username: 'admin',
    });
    mockFindInvitationsForExport.mockResolvedValue([
      {
        id: 'inv-2',
        mailingAddress: null,
        address: null,
        addressLine2: null,
        city: null,
        state: null,
        zipCode: null,
        country: null,
        contactEmail: null,
        primaryGuestFirstName: 'Jane',
        primaryGuestLastName: 'Doe',
      },
    ]);

    const response = await GET(buildRequest('minted'));
    const text = await response.text();

    expect(text).toContain('"Jane Doe"');
  });
});
