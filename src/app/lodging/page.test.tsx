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

import LodgingPage from './page';
import { findMainEvent } from '@/lib/db/repositories/events';

/**
 * Renders the LodgingPage to an HTML string.
 *
 * @returns The rendered HTML string.
 */
async function renderPage(): Promise<string> {
  const element = await LodgingPage();

  return renderToString(element);
}

describe('LodgingPage — hotel section', () => {
  test('should render Hygge House Suites', async () => {
    const htmlString = await renderPage();

    expect(htmlString).toContain('Hygge House Suites');
  });

  test('should render Cutwater Inn', async () => {
    const htmlString = await renderPage();

    expect(htmlString).toContain('Cutwater Inn');
  });

  test('should render Hygge House Suites address', async () => {
    const htmlString = await renderPage();

    expect(htmlString).toContain('Newburyport, MA 01950');
  });

  test('should render walking distances for both hotels', async () => {
    const htmlString = await renderPage();

    expect(htmlString).toContain('minute walk to the venue');
  });

  test('should render walking directions links with travelmode=walking', async () => {
    const htmlString = await renderPage();

    expect(htmlString).toContain('travelmode=walking');
  });

  test('should render Hygge House Suites hotel website href', async () => {
    const htmlString = await renderPage();

    expect(htmlString).toContain('https://www.hyggehouse.com');
  });

  test('should render Cutwater Inn hotel website href', async () => {
    const htmlString = await renderPage();

    expect(htmlString).toContain('https://www.cutwaterinn.com');
  });
});

describe('LodgingPage — FAQ section', () => {
  test('should render the dress code question', async () => {
    const htmlString = await renderPage();

    expect(htmlString).toContain('What is the dress code?');
  });

  test('should render the dress code answer', async () => {
    const htmlString = await renderPage();

    expect(htmlString).toContain('Cocktail attire is requested.');
  });

  test('should render the parking question', async () => {
    const htmlString = await renderPage();

    expect(htmlString).toContain('Is there parking available at the venue?');
  });

  test('should render the parking answer', async () => {
    const htmlString = await renderPage();

    expect(htmlString).toContain(
      'Yes, complimentary parking is available on site.',
    );
  });

  test('should render the children question', async () => {
    const htmlString = await renderPage();

    expect(htmlString).toContain('Are children welcome?');
  });

  test('should render the plus-one question', async () => {
    const htmlString = await renderPage();

    expect(htmlString).toContain('Can I bring a plus-one?');
  });

  test('should render the dietary restriction question', async () => {
    const htmlString = await renderPage();

    expect(htmlString).toContain(
      'What should I do if I have a dietary restriction?',
    );
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
