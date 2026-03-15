/**
 * @vitest-environment node
 */
/* eslint-disable testing-library/render-result-naming-convention */
import { expect, test, describe, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

vi.mock('next/font/google', () => ({
  Marcellus: vi.fn(() => ({ className: 'marcellus-font' })),
}));

// HotelRouteMapClient is a 'use client' component that lazily loads Leaflet — render null in node env
vi.mock('@/components/HotelRouteMapClient', () => ({
  HotelRouteMapClient: () => null,
}));

// Return a main event with pre-geocoded venue coordinates
vi.mock('@/lib/db/repositories/events', () => ({
  findMainEvent: vi.fn().mockResolvedValue({
    location: 'Test Venue',
    locationLat: 42.81075658532706,
    locationLng: -70.87293203187453,
  }),
}));

import LodgingPage, { HOTELS, FAQ_ITEMS } from './page';
import { findMainEvent } from '@/lib/db/repositories/events';

/**
 * Renders the LodgingPage to an HTML string.
 *
 * @returns The rendered HTML string.
 */
async function renderPage(): Promise<string> {
  const element = await LodgingPage();

  return renderToString(element)
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

describe('LodgingPage — hotel section', () => {
  test('should render all hotel names', async () => {
    const htmlString = await renderPage();

    HOTELS.forEach((hotel) => {
      expect(htmlString).toContain(hotel.name);
    });
  });

  test('should render all hotel addresses', async () => {
    const htmlString = await renderPage();

    HOTELS.forEach((hotel) => {
      expect(htmlString).toContain(hotel.address);
    });
  });

  test('should render walking distances for all hotels', async () => {
    const htmlString = await renderPage();

    expect(htmlString).toContain('minute walk to the venue');
  });

  test('should render walking directions links with travelmode=walking', async () => {
    const htmlString = await renderPage();

    expect(htmlString).toContain('travelmode=walking');
  });

  test('should render website links for all hotels', async () => {
    const htmlString = await renderPage();

    HOTELS.forEach((hotel) => {
      expect(htmlString).toContain(hotel.websiteUrl);
    });
  });
});

describe('LodgingPage — FAQ section', () => {
  test('should render all FAQ questions', async () => {
    const htmlString = await renderPage();

    FAQ_ITEMS.forEach((item) => {
      expect(htmlString).toContain(item.question);
    });
  });

  test('should render all FAQ answers', async () => {
    const htmlString = await renderPage();

    FAQ_ITEMS.forEach((item) => {
      expect(htmlString).toContain(item.answer);
    });
  });

  test('should render lodging section before FAQ section in document order', async () => {
    const htmlString = await renderPage();

    const lodgingIndex = htmlString.indexOf('Recommended Hotels');
    const faqIndex = htmlString.indexOf('Frequently Asked Questions');

    expect(lodgingIndex).toBeGreaterThan(-1);
    expect(faqIndex).toBeGreaterThan(-1);
    expect(lodgingIndex).toBeLessThan(faqIndex);
  });
});

describe('LodgingPage — venue geocoding guard', () => {
  test('should throw when the main event has no coordinates', async () => {
    vi.mocked(findMainEvent).mockResolvedValueOnce({
      location: 'Test Venue',
      locationLat: null,
      locationLng: null,
    } as never);

    await expect(LodgingPage()).rejects.toThrow(
      'Main event has not been geocoded',
    );
  });

  test('should throw when the main event does not exist', async () => {
    vi.mocked(findMainEvent).mockResolvedValueOnce(undefined);

    await expect(LodgingPage()).rejects.toThrow(
      'Main event has not been geocoded',
    );
  });
});
