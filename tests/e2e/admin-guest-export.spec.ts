import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

/**
 * E2E tests for the venue guest-list CSV export.
 *
 * These run the export against a real D1 database, which the unit tests
 * cannot do — they mock `getDb`, so the three-way LEFT JOIN that resolves a
 * guest's table name is never actually executed anywhere else.
 *
 * Fixture data (seeded by e2e-seed.sql):
 *   Carol Export — seated at both charts; wedding meal 'short-rib' with a
 *     'Peanut allergy', but her BBQ RSVP records 'option_b' and 'Shellfish'.
 *   Dave Export  — seated at the wedding, never invited to the BBQ.
 *   Erin Export  — invited to the BBQ but never responded and unseated, so
 *     any wedding data appearing on her BBQ row is a leak.
 *   Charts exist for Wedding Celebration and BBQ Dinner only.
 */

const VENUE_EXPORT = '/api/admin/export/guests?format=venue';

/**
 * Splits a CSV body into lines, dropping the trailing blank from the final
 * CRLF so callers can index rows directly.
 *
 * @param body - The raw CSV response body.
 * @returns One string per CSV line.
 */
function toLines(body: string): string[] {
  return body.split('\r\n').filter((line) => line.length > 0);
}

/**
 * Finds the single CSV line for a guest.
 *
 * @param body - The raw CSV response body.
 * @param guestName - The quoted guest name to match.
 * @returns The matching line.
 */
function lineFor(body: string, guestName: string): string {
  const matches = toLines(body).filter((line) =>
    line.startsWith(`"${guestName}"`),
  );

  expect(matches).toHaveLength(1);

  return matches[0];
}

test.describe('Admin venue guest-list export', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('exports the plain guest list with no Table column', async ({
    page,
  }) => {
    const response = await page.request.get(VENUE_EXPORT);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/csv');
    expect(response.headers()['content-disposition']).toBe(
      'attachment; filename="venue-guest-list.csv"',
    );

    const body = await response.text();
    const [header] = toLines(body);

    expect(header).toBe(
      '"Guest Name","Party","Guest Type","Attending","Meal Choice",' +
        '"Dietary Restrictions / Allergies","Notes"',
    );

    // Carol's wedding RSVP, with the party name from the mailing address.
    expect(lineFor(body, 'Carol Export')).toBe(
      '"Carol Export","The Export Family","Adult","Yes","Short Rib",' +
        '"Peanut allergy","Maid of honor"',
    );
  });

  test('joins the seating chart for the main event and keeps wedding RSVP data', async ({
    page,
  }) => {
    const response = await page.request.get(
      `${VENUE_EXPORT}&eventId=event-e2e-wedding`,
    );

    expect(response.status()).toBe(200);
    expect(response.headers()['content-disposition']).toBe(
      'attachment; filename="venue-guest-list-wedding-celebration.csv"',
    );

    const body = await response.text();
    const [header] = toLines(body);

    expect(header).toContain('"Notes","Table"');

    // Main event: the guest-level wedding RSVP still applies, now with a table.
    expect(lineFor(body, 'Carol Export')).toBe(
      '"Carol Export","The Export Family","Adult","Yes","Short Rib",' +
        '"Peanut allergy","Maid of honor","Head Table"',
    );

    // Erin is invited to the wedding and unseated there, so her Table is blank
    // while her wedding RSVP data still reports.
    expect(lineFor(body, 'Erin Export')).toBe(
      '"Erin Export","The Unseated Family","Adult","Yes","Roasted Chicken",' +
        '"Gluten free","",""',
    );

    // Dave is seated but never RSVP'd, so his attendance stays unanswered.
    expect(lineFor(body, 'Dave Export')).toBe(
      '"Dave Export","The Export Family","Child","No Response",' +
        '"","","","Head Table"',
    );
  });

  test('reports the event RSVP meal rather than the wedding meal for a non-main event', async ({
    page,
  }) => {
    const response = await page.request.get(
      `${VENUE_EXPORT}&eventId=event-e2e-bbq`,
    );

    expect(response.status()).toBe(200);
    expect(response.headers()['content-disposition']).toBe(
      'attachment; filename="venue-guest-list-bbq-dinner.csv"',
    );

    const body = await response.text();

    // Carol's BBQ seat pairs with her BBQ meal, not her wedding meal.
    expect(lineFor(body, 'Carol Export')).toBe(
      '"Carol Export","The Export Family","Adult","Yes","Option B",' +
        '"Shellfish","Maid of honor","Picnic Table 2"',
    );

    // Erin never responded to the BBQ, so her wedding meal, dietary note and
    // attendance must not stand in for BBQ data.
    expect(lineFor(body, 'Erin Export')).toBe(
      '"Erin Export","The Unseated Family","Adult","No Response","","","",""',
    );

    // The wedding-only values must not appear anywhere in a BBQ export.
    expect(body).not.toContain('Short Rib');
    expect(body).not.toContain('Peanut allergy');
    expect(body).not.toContain('Roasted Chicken');
    expect(body).not.toContain('Gluten free');
  });

  test('marks guests who were never invited to a non-main event', async ({
    page,
  }) => {
    const response = await page.request.get(
      `${VENUE_EXPORT}&eventId=event-e2e-bbq`,
    );
    const body = await response.text();

    // Dave has no BBQ GuestEvent row, so he is Not Invited rather than
    // silently reported as No Response, and has no BBQ table.
    expect(lineFor(body, 'Dave Export')).toBe(
      '"Dave Export","The Export Family","Child","Not Invited","","","",""',
    );
  });

  test('rejects an unknown eventId', async ({ page }) => {
    const response = await page.request.get(
      `${VENUE_EXPORT}&eventId=no-such-event`,
    );

    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: 'Event not found' });
  });

  test('offers a with-Tables export only for events that have a seating chart', async ({
    page,
  }) => {
    await page.goto('/admin/invitations');
    await page.getByRole('button', { name: 'Export ▾' }).click();

    const options = page.getByRole('listbox').locator('button');

    await expect(
      options.filter({ hasText: 'Venue Guest List with Tables' }),
    ).toHaveCount(2);
    await expect(
      options.filter({ hasText: 'with Tables (Wedding Celebration)' }),
    ).toBeVisible();
    await expect(
      options.filter({ hasText: 'with Tables (BBQ Dinner)' }),
    ).toBeVisible();

    // Cocktail Hour and Pool Day have no chart, so they must not be offered.
    await expect(
      options.filter({ hasText: 'with Tables (Cocktail Hour)' }),
    ).toHaveCount(0);
    await expect(
      options.filter({ hasText: 'with Tables (Pool Day)' }),
    ).toHaveCount(0);
  });
});
