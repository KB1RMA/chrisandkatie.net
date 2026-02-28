/**
 * @vitest-environment node
 */

import { expect, test, describe, beforeEach, vi } from 'vitest';
import { geocodeLocation } from '@/lib/geocoding';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';

/**
 * Build a minimal Response-like mock for vi.stubGlobal('fetch', ...).
 */
function makeFetchMock(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  });
}

describe('geocodeLocation', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  test('should return coordinates when Nominatim returns a result', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock(200, [{ lat: '42.3601', lon: '-71.0589' }]),
    );

    const result = await geocodeLocation('Boston, MA');

    expect(result).toEqual({ lat: 42.3601, lng: -71.0589 });
  });

  test('should parse lat and lng as numbers, not strings', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock(200, [{ lat: '51.5074', lon: '-0.1278' }]),
    );

    const result = await geocodeLocation('London, UK');

    expect(typeof result?.lat).toBe('number');
    expect(typeof result?.lng).toBe('number');
  });

  test('should return null when Nominatim returns an empty results array', async () => {
    vi.stubGlobal('fetch', makeFetchMock(200, []));

    const result = await geocodeLocation('asdfjklqwertyuiop');

    expect(result).toBeNull();
  });

  test('should return null when the HTTP response is not ok', async () => {
    vi.stubGlobal('fetch', makeFetchMock(429, {}));

    const result = await geocodeLocation('Boston, MA');

    expect(result).toBeNull();
  });

  test('should return null when fetch throws a network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network error')),
    );

    const result = await geocodeLocation('Boston, MA');

    expect(result).toBeNull();
  });

  test('should URL-encode the location query parameter', async () => {
    const fetchMock = makeFetchMock(200, [{ lat: '48.8566', lon: '2.3522' }]);

    vi.stubGlobal('fetch', fetchMock);

    await geocodeLocation('Rue de Rivoli, Paris');

    const calledUrl = fetchMock.mock.calls[0][0] as string;

    expect(calledUrl).toContain(NOMINATIM_BASE);
    expect(calledUrl).toContain(encodeURIComponent('Rue de Rivoli, Paris'));
  });

  test('should send the required User-Agent and Accept-Language headers', async () => {
    const fetchMock = makeFetchMock(200, [{ lat: '42.3601', lon: '-71.0589' }]);

    vi.stubGlobal('fetch', fetchMock);

    await geocodeLocation('Boston, MA');

    const calledHeaders = fetchMock.mock.calls[0][1].headers as Record<
      string,
      string
    >;

    expect(calledHeaders['User-Agent']).toMatch(/chrisandkatie\.net/);
    expect(calledHeaders['Accept-Language']).toBe('en');
  });

  test('should only use the first result when multiple are returned', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock(200, [
        { lat: '42.3601', lon: '-71.0589' },
        { lat: '34.0522', lon: '-118.2437' },
      ]),
    );

    const result = await geocodeLocation('Boston');

    expect(result).toEqual({ lat: 42.3601, lng: -71.0589 });
  });
});
