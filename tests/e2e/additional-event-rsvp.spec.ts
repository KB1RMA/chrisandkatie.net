import { test, expect } from '@playwright/test';
import { loginAsGuest } from './helpers/login';
import { resetRsvpState } from './helpers/reset-rsvp';
import { completeAddressStep } from './helpers/complete-address-step';

/**
 * E2E tests for the additional event RSVP flow.
 *
 * These tests cover the Pool Day additional event card on Step 3,
 * the event-specific RSVP page for a non-main event, and the
 * attendance-only submission flow (no meal choice).
 *
 * Seeded data (tests/fixtures/e2e-seed.sql):
 *   Event:      event-e2e-pool-day  (type='other', rsvpRequired=true)
 *   Guests:     Alice E2E, Bob E2E  (both linked via GuestEvent)
 *   Invitation: test-swift
 */

const VALID_CODE = 'test-swift';
const POOL_DAY_EVENT_ID = 'event-e2e-pool-day';

/**
 * Advances the RSVP wizard to Step 3 by completing steps 1 and 2.
 *
 * @param page - Playwright page object.
 */
async function advanceToStep3(page: Parameters<typeof completeAddressStep>[0]) {
  await completeAddressStep(page);

  // Mark both guests attending with meal choices on the main RSVP form.
  await page.locator('label:has-text("Attending")').first().click();
  await page.locator('label:has-text("Attending")').nth(1).click();

  const mealLabels = page.locator('label:has-text("Short Rib")');
  const mealCount = await mealLabels.count();

  for (let i = 0; i < mealCount; i++) {
    await mealLabels.nth(i).click();
  }

  await page.getByRole('button', { name: 'Submit RSVP' }).click();

  // Wait for Step 3 to be rendered.
  await expect(
    page.getByRole('heading', { name: 'Additional Events' }),
  ).toBeVisible({ timeout: 10_000 });
}

test.describe('Additional event RSVP flow', () => {
  test.beforeEach(async ({ page }) => {
    resetRsvpState();
    await loginAsGuest(page, VALID_CODE);
  });

  test('should show Pool Day event card on Step 3 with "Not Responded" badge and "RSVP Now" link', async ({
    page,
  }) => {
    await advanceToStep3(page);

    await expect(page.getByText('Pool Day')).toBeVisible();

    // Scope to Pool Day card — BBQ Dinner also shows "Not Responded" and "RSVP Now"
    // which would cause strict-mode violations if not scoped.
    const poolDayCard = page
      .getByTestId('event-rsvp-card')
      .filter({ hasText: 'Pool Day' });

    await expect(poolDayCard.getByText('Not Responded')).toBeVisible();
    await expect(
      poolDayCard.getByRole('link', { name: 'RSVP Now' }),
    ).toBeVisible();
  });

  test('should show no Meal Choice input on the Pool Day event RSVP page', async ({
    page,
  }) => {
    await page.goto(`/rsvp/${POOL_DAY_EVENT_ID}`);

    // Select attending to reveal the attendee checklist.
    await page.getByText('Yes, I will attend').click();

    // Check Alice to reveal her attendee fields.
    await page.getByText('Alice E2E').click();

    // Meal Choice should NOT be present for non-main events.
    await expect(page.getByText('Meal Choice *')).toBeHidden();
    await expect(page.getByLabel(/Dietary Restrictions/i)).toBeHidden();
  });

  test('should show "← Back to RSVP" link that returns guest to /rsvp', async ({
    page,
  }) => {
    await page.goto(`/rsvp/${POOL_DAY_EVENT_ID}`);

    const backLink = page.getByRole('link', { name: '← Back to RSVP' });

    await expect(backLink).toBeVisible();

    await backLink.click();

    await expect(page).toHaveURL('/rsvp');
  });

  test('should redirect to /rsvp after submitting an attending RSVP for Pool Day', async ({
    page,
  }) => {
    await page.goto(`/rsvp/${POOL_DAY_EVENT_ID}`);

    await page.getByText('Yes, I will attend').click();

    // Select Alice E2E as the attending guest.
    await page.getByText('Alice E2E').click();

    await page
      .getByRole('button', { name: /Submit RSVP|Update RSVP/i })
      .click();

    await expect(page).toHaveURL('/rsvp', { timeout: 10_000 });
  });

  test('should show "Attending" badge on the Pool Day event card after submission', async ({
    page,
  }) => {
    // Submit the Pool Day RSVP first.
    await page.goto(`/rsvp/${POOL_DAY_EVENT_ID}`);

    await page.getByText('Yes, I will attend').click();
    await page.getByText('Alice E2E').click();
    await page
      .getByRole('button', { name: /Submit RSVP|Update RSVP/i })
      .click();

    // EventRsvpForm redirects to /rsvp?step=3 on success — the wizard is already
    // at Step 3, so we wait for the heading rather than calling advanceToStep3.
    await expect(
      page.getByRole('heading', { name: 'Additional Events' }),
    ).toBeVisible({ timeout: 10_000 });

    // Pool Day card should now show "Attending" badge.
    await expect(page.getByText('Attending')).toBeVisible();
  });

  test('should redirect to /rsvp with "Not Attending" badge after submitting a declining RSVP', async ({
    page,
  }) => {
    await page.goto(`/rsvp/${POOL_DAY_EVENT_ID}`);

    await page.getByText('No, I cannot make it').click();

    await page
      .getByRole('button', { name: /Submit RSVP|Update RSVP/i })
      .click();

    // EventRsvpForm redirects to /rsvp?step=3 on success — the wizard is already
    // at Step 3, so we wait for the heading rather than calling advanceToStep3.
    await expect(
      page.getByRole('heading', { name: 'Additional Events' }),
    ).toBeVisible({ timeout: 10_000 });

    // Pool Day card should show "Not Attending" badge.
    await expect(page.getByText('Not Attending')).toBeVisible();
  });
});
