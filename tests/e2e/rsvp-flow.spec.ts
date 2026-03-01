import { test, expect } from '@playwright/test';
import { loginAsGuest } from './helpers/login';
import { resetRsvpState } from './helpers/reset-rsvp';

/**
 * E2E tests for the RSVP flow.
 *
 * Test invitation seeded by e2e-seed.sql:
 *   Code:   test-swift
 *   Guests: Alice E2E, Bob E2E
 */

const VALID_CODE = 'test-swift';
// Must match word-word format to pass client-side validation but not exist in the DB.
const INVALID_CODE = 'fake-code';

// ── Authentication ────────────────────────────────────────────────────────────

test.describe('Login — invitation code', () => {
  test('should show invitation code form by default', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByLabel('Invitation Code')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Continue to RSVP' }),
    ).toBeVisible();
  });

  test('should redirect to /rsvp after a valid code is entered', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByLabel('Invitation Code').fill(VALID_CODE);
    await page.getByRole('button', { name: 'Continue to RSVP' }).click();

    await expect(page).toHaveURL('/rsvp');
    await expect(page.getByRole('heading', { name: 'RSVP' })).toBeVisible();
  });

  test('should show an error when an invalid code is entered', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByLabel('Invitation Code').fill(INVALID_CODE);
    await page.getByRole('button', { name: 'Continue to RSVP' }).click();

    await expect(page.getByText("That code wasn't recognised")).toBeVisible();

    // Should stay on /login — not redirected.
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show a validation error for incorrectly formatted codes', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByLabel('Invitation Code').fill('badformat');
    await page.getByRole('button', { name: 'Continue to RSVP' }).click();

    await expect(
      page.getByText('Code should be in the format "word-word"'),
    ).toBeVisible();
  });

  test('should auto-submit via QR deep-link (?code= query param)', async ({
    page,
  }) => {
    await page.goto(`/login?code=${VALID_CODE}`);

    // The form auto-submits when initialCode is present — skip manual entry.
    await expect(page).toHaveURL('/rsvp', { timeout: 10_000 });
  });

  test('should redirect an already-authenticated guest away from /login', async ({
    page,
  }) => {
    // Log in first.
    await loginAsGuest(page, VALID_CODE);

    // Navigating back to /login should redirect to /rsvp.
    await page.goto('/login');
    await expect(page).toHaveURL('/rsvp');
  });

  test('should reveal the admin sign-in form when the toggle is clicked', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByText('Admin sign in').click();

    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });
});

// ── Access control ────────────────────────────────────────────────────────────

test.describe('RSVP page — access control', () => {
  test('should redirect unauthenticated users from /rsvp to /login', async ({
    page,
  }) => {
    await page.goto('/rsvp');

    await expect(page).toHaveURL(/\/login/);
  });
});

// ── RSVP page ─────────────────────────────────────────────────────────────────

test.describe('RSVP page — authenticated guest', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGuest(page, VALID_CODE);
  });

  test('should display the invited party on the RSVP page', async ({
    page,
  }) => {
    await expect(page.getByRole('heading', { name: 'RSVP' })).toBeVisible();

    // Both seeded guests should be listed.
    await expect(page.getByText('Alice E2E')).toBeVisible();
    await expect(page.getByText('Bob E2E')).toBeVisible();
  });

  test('should show the Submit RSVP button before any submission', async ({
    page,
  }) => {
    await expect(
      page.getByRole('button', { name: 'Submit RSVP' }),
    ).toBeVisible();
  });
});

// ── RSVP submission ───────────────────────────────────────────────────────────

test.describe('RSVP submission', () => {
  test.beforeEach(async ({ page }) => {
    // Reset RSVP state so each test starts from a clean "not yet submitted" slate.
    resetRsvpState();
    await loginAsGuest(page, VALID_CODE);
  });

  test('should submit RSVP successfully when all guests mark attending', async ({
    page,
  }) => {
    // Mark both guests as attending.
    const attendingLabels = page.locator('label:has-text("Attending")');
    const count = await attendingLabels.count();

    for (let i = 0; i < count; i++) {
      await attendingLabels.nth(i).click();
    }

    // Select a meal choice for each attending guest.
    const mealLabels = page.locator('label:has-text("Roasted Chicken")');
    const mealCount = await mealLabels.count();

    for (let i = 0; i < mealCount; i++) {
      await mealLabels.nth(i).click();
    }

    // Submit the form.
    await page.getByRole('button', { name: 'Submit RSVP' }).click();

    // Verify the success confirmation is visible.
    await expect(page.getByText('RSVP Submitted Successfully')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('should submit RSVP when a guest declines', async ({ page }) => {
    // Mark first guest attending, second declining.
    await page.locator('label:has-text("Attending")').first().click();
    await page.locator('label:has-text("Declining")').nth(1).click();

    // Meal choice only required for attending guests — select for first guest.
    await page.locator('label:has-text("Short Rib")').first().click();

    await page.getByRole('button', { name: 'Submit RSVP' }).click();

    await expect(page.getByText('RSVP Submitted Successfully')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('should save a contact email when provided', async ({ page }) => {
    await page.locator('label:has-text("Attending")').first().click();
    await page.locator('label:has-text("Attending")').nth(1).click();

    const mealLabels = page.locator('label:has-text("Pasta Primavera")');
    const mealCount = await mealLabels.count();

    for (let i = 0; i < mealCount; i++) {
      await mealLabels.nth(i).click();
    }

    // Provide an optional contact email.
    const emailInput = page.getByLabel(/email/i);

    await expect(emailInput).toBeVisible();
    await emailInput.fill('alice@example.com');

    await page.getByRole('button', { name: 'Submit RSVP' }).click();

    await expect(page.getByText('RSVP Submitted Successfully')).toBeVisible({
      timeout: 10_000,
    });
  });
});

// ── Re-submission / update flow ───────────────────────────────────────────────

test.describe('RSVP update flow', () => {
  test.beforeEach(async ({ page }) => {
    // Reset RSVP state, then log in and submit so we can test the update path.
    resetRsvpState();
    await loginAsGuest(page, VALID_CODE);

    await page.locator('label:has-text("Attending")').first().click();
    await page.locator('label:has-text("Attending")').nth(1).click();

    const mealLabels = page.locator('label:has-text("Short Rib")');
    const mealCount = await mealLabels.count();

    for (let i = 0; i < mealCount; i++) {
      await mealLabels.nth(i).click();
    }

    await page.getByRole('button', { name: 'Submit RSVP' }).click();
    await expect(page.getByText('RSVP Submitted Successfully')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('should show the "already submitted" notice when revisiting', async ({
    page,
  }) => {
    // Reload the RSVP page to exit the success state.
    await page.reload();

    await expect(page.getByText("You've already submitted")).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Update RSVP' }),
    ).toBeVisible();
  });

  test('should allow guests to update their RSVP', async ({ page }) => {
    await page.reload();

    // Switch first guest to declining.
    await page.locator('label:has-text("Declining")').first().click();

    await page.getByRole('button', { name: 'Update RSVP' }).click();

    await expect(page.getByText('RSVP Submitted Successfully')).toBeVisible({
      timeout: 10_000,
    });
  });
});
