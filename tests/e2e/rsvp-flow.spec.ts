import { test, expect } from '@playwright/test';
import { loginAsGuest } from './helpers/login';
import { resetRsvpState } from './helpers/reset-rsvp';
import { completeAddressStep } from './helpers/complete-address-step';

/**
 * E2E tests for the RSVP flow.
 *
 * The RSVP page is a three-step wizard:
 *   Step 1 – Confirm Your Address (and optional contact email)
 *   Step 2 – Attendance and meal selections
 *   Step 3 – Additional events (Pool Day and BBQ Dinner event cards)
 *
 * First-time visitors start on Step 1. Guests who have already submitted
 * an RSVP start on Step 2.
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

// ── RSVP wizard — Step 1: Address confirmation ───────────────────────────────

test.describe('RSVP wizard — address step', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGuest(page, VALID_CODE);
  });

  test('should show the address confirmation step on first visit', async ({
    page,
  }) => {
    await expect(page.getByRole('heading', { name: 'RSVP' })).toBeVisible();
    await expect(page.getByText('Confirm Your Address')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Looks correct — continue' }),
    ).toBeVisible();
  });

  test('should display a three-step progress indicator', async ({ page }) => {
    await expect(page.getByText('Confirm Address')).toBeVisible();
    // Use exact match — 'Your RSVP' also appears as a substring in the contact
    // email description, which would cause a strict-mode violation otherwise.
    await expect(page.getByText('Your RSVP', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Additional Events', { exact: true }),
    ).toBeVisible();
  });

  test('should show the contact email field on the address step', async ({
    page,
  }) => {
    await expect(page.getByLabel(/contact email/i)).toBeVisible();
  });

  test('should advance to the RSVP form when address is confirmed', async ({
    page,
  }) => {
    await completeAddressStep(page);

    // Step 2 — RSVP form — is now visible.
    await expect(page.getByText('Alice E2E')).toBeVisible();
    await expect(page.getByText('Bob E2E')).toBeVisible();
  });
});

// ── RSVP page — Step 2: RSVP form ────────────────────────────────────────────

test.describe('RSVP page — authenticated guest', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGuest(page, VALID_CODE);
    // Advance past the address confirmation step to reach the RSVP form.
    await completeAddressStep(page);
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

  test('should allow navigating back to the address step', async ({ page }) => {
    await page.getByRole('button', { name: /back to address/i }).click();

    await expect(page.getByText('Confirm Your Address')).toBeVisible();
  });
});

// ── RSVP submission ───────────────────────────────────────────────────────────

test.describe('RSVP submission', () => {
  test.beforeEach(async ({ page }) => {
    // Reset RSVP state so each test starts from a clean "not yet submitted" slate.
    resetRsvpState();
    await loginAsGuest(page, VALID_CODE);

    // Advance past the address confirmation step (Step 1) to the RSVP form (Step 2).
    await completeAddressStep(page);
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

    // After submission the wizard advances to Step 3 — Additional Events.
    // The seeded invitation has Pool Day and BBQ as additional events.
    await expect(
      page.getByRole('heading', { name: 'Additional Events' }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should submit RSVP when a guest declines', async ({ page }) => {
    // Mark first guest attending, second declining.
    await page.locator('label:has-text("Attending")').first().click();
    await page.locator('label:has-text("Declining")').nth(1).click();

    // Meal choice only required for attending guests — select for first guest.
    await page.locator('label:has-text("Short Rib")').first().click();

    await page.getByRole('button', { name: 'Submit RSVP' }).click();

    // After submission, wizard advances to Step 3.
    await expect(
      page.getByRole('heading', { name: 'Additional Events' }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should save a contact email when provided', async ({ page }) => {
    // The contact email field lives on Step 1. Navigate back to fill it in.
    await page.getByRole('button', { name: /back to address/i }).click();

    const emailInput = page.getByLabel(/contact email/i);

    await expect(emailInput).toBeVisible();
    await emailInput.fill('alice@example.com');

    // Confirm the address again to return to Step 2.
    await completeAddressStep(page);

    await page.locator('label:has-text("Attending")').first().click();
    await page.locator('label:has-text("Attending")').nth(1).click();

    const mealLabels = page.locator('label:has-text("Pasta Primavera")');
    const mealCount = await mealLabels.count();

    for (let i = 0; i < mealCount; i++) {
      await mealLabels.nth(i).click();
    }

    await page.getByRole('button', { name: 'Submit RSVP' }).click();

    // After submission, wizard advances to Step 3.
    await expect(
      page.getByRole('heading', { name: 'Additional Events' }),
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ── RSVP wizard — Step 3: Additional events ──────────────────────────────────

test.describe('RSVP wizard — additional events step', () => {
  test.beforeEach(async ({ page }) => {
    resetRsvpState();
    await loginAsGuest(page, VALID_CODE);
    await completeAddressStep(page);

    // Submit RSVP to advance the wizard to Step 3.
    await page.locator('label:has-text("Attending")').first().click();
    await page.locator('label:has-text("Attending")').nth(1).click();

    const mealLabels = page.locator('label:has-text("Short Rib")');
    const mealCount = await mealLabels.count();

    for (let i = 0; i < mealCount; i++) {
      await mealLabels.nth(i).click();
    }

    await page.getByRole('button', { name: 'Submit RSVP' }).click();
    await expect(
      page.getByRole('heading', { name: 'Additional Events' }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should show the additional events heading and event cards', async ({
    page,
  }) => {
    // Use role selector — 'Additional Events' also appears in the step indicator
    // span and a description paragraph, which would cause strict-mode violations.
    await expect(
      page.getByRole('heading', { name: 'Additional Events' }),
    ).toBeVisible();

    // Both seeded additional events should be visible as RSVP cards.
    await expect(page.getByText('Pool Day')).toBeVisible();
    await expect(page.getByText('BBQ Dinner')).toBeVisible();
  });

  test('should navigate back to the RSVP form from the events step', async ({
    page,
  }) => {
    await page.getByText('← Back to RSVP').click();

    // Step 2 — RSVP form — should be visible again.
    // goBack auto-expands the form so the full RSVPForm (with Update RSVP) is shown.
    await expect(
      page.getByRole('button', { name: 'Update RSVP' }),
    ).toBeVisible();
  });
});

// ── Re-submission / update flow ───────────────────────────────────────────────

test.describe('RSVP update flow', () => {
  test.beforeEach(async ({ page }) => {
    // Reset RSVP state, then log in and submit so we can test the update path.
    resetRsvpState();
    await loginAsGuest(page, VALID_CODE);

    // First visit starts on Step 1 — confirm address to reach the RSVP form.
    await completeAddressStep(page);

    await page.locator('label:has-text("Attending")').first().click();
    await page.locator('label:has-text("Attending")').nth(1).click();

    const mealLabels = page.locator('label:has-text("Short Rib")');
    const mealCount = await mealLabels.count();

    for (let i = 0; i < mealCount; i++) {
      await mealLabels.nth(i).click();
    }

    await page.getByRole('button', { name: 'Submit RSVP' }).click();

    // After submission the wizard advances to Step 3 — Additional Events.
    await expect(
      page.getByRole('heading', { name: 'Additional Events' }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should show the "already submitted" notice when revisiting', async ({
    page,
  }) => {
    // Reload the RSVP page. Because isSubmitted is now true the wizard
    // starts at Step 2 directly — no address confirmation needed.
    await page.reload();

    await expect(page.getByText("You've already submitted")).toBeVisible();

    // On reload the form starts collapsed (RsvpSummary). Expand it to access
    // the full edit form with the Update RSVP button.
    await page.getByRole('button', { name: 'Edit responses' }).click();

    await expect(
      page.getByRole('button', { name: 'Update RSVP' }),
    ).toBeVisible();
  });

  test('should allow guests to update their RSVP', async ({ page }) => {
    await page.reload();

    // On reload the form starts collapsed — expand it before editing responses.
    await page.getByRole('button', { name: 'Edit responses' }).click();

    // Switch first guest to declining.
    await page.locator('label:has-text("Declining")').first().click();

    await page.getByRole('button', { name: 'Update RSVP' }).click();

    // After updating, wizard advances to Step 3.
    await expect(
      page.getByRole('heading', { name: 'Additional Events' }),
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ── Step 3 — empty additional events state ────────────────────────────────────

/**
 * Covers the "You're all set!" banner shown on Step 3 when the invitation has
 * no additional events requiring an RSVP (i.e. no GuestEvent rows). This
 * prevents regressions in the empty-additional-events branch of EventsStep.
 *
 * Uses the 'test-plain' invitation seeded in e2e-seed.sql, which deliberately
 * has no GuestEvent rows linking the guest to any rsvpRequired event.
 */
test.describe('Step 3 — no additional events', () => {
  test.beforeEach(async ({ page }) => {
    // Reset so each test starts from a clean "not yet submitted" state,
    // preventing order-dependence when the suite runs more than once.
    resetRsvpState();

    await loginAsGuest(page, 'test-plain');
    await completeAddressStep(page);

    // Submit the RSVP so the wizard advances to Step 3.
    await page.locator('label:has-text("Attending")').first().click();
    // Meal choice is required for attending guests — select one before submitting.
    await page.locator('label:has-text("Short Rib")').first().click();
    await page.getByRole('button', { name: 'Submit RSVP' }).click();

    await expect(
      page.getByRole('heading', { name: 'Additional Events' }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should show the "You\'re all set!" banner when there are no additional events', async ({
    page,
  }) => {
    await expect(page.getByText("You're all set!")).toBeVisible();
    await expect(page.getByText('Thank you for your RSVP')).toBeVisible();
  });

  test('should not show any additional event cards', async ({ page }) => {
    await expect(page.getByTestId('event-rsvp-card')).toHaveCount(0);
  });
});
