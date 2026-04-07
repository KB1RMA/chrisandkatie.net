import { test, expect } from '@playwright/test';
import { recoveryGuest } from '../fixtures/recovery';

/**
 * E2E tests for the invitation code recovery flow.
 *
 * Seeded test data (from tests/fixtures/e2e-seed.sql):
 *   Last name:        Testguest
 *   Street address:   42 Recovery Lane
 *   ZIP code:         62701
 *   Invitation code:  test-code
 */

// ── Scenario 1: Recovery link on the login page ───────────────────────────────

test.describe('Login page — recovery link', () => {
  test('should show "Missing or lost your invitation code?" link below the submit button', async ({
    page,
  }) => {
    await page.goto('/login');

    await expect(
      page.getByRole('link', { name: /Missing or lost your invitation code/i }),
    ).toBeVisible();
  });

  test('should navigate to /rsvp/recover when clicking the recovery link', async ({
    page,
  }) => {
    await page.goto('/login');

    await page
      .getByRole('link', { name: /Missing or lost your invitation code/i })
      .click();

    await expect(page).toHaveURL('/rsvp/recover');
  });
});

// ── Scenario 2: Successful recovery flow ─────────────────────────────────────

test.describe('Recovery page — successful code retrieval', () => {
  test('should display the invitation code and a sign-in link when valid details are submitted', async ({
    page,
  }) => {
    await page.goto('/rsvp/recover');

    await page.getByLabel(/last name/i).fill(recoveryGuest.lastName);

    await page.getByLabel(/street address/i).fill(recoveryGuest.streetAddress);

    await page.getByLabel(/zip code/i).fill(recoveryGuest.zipCode);

    await page.getByRole('button', { name: /find my code/i }).click();

    await expect(page.getByText(recoveryGuest.invitationCode)).toBeVisible();

    const signInLink = page.getByRole('link', {
      name: /sign in with this code/i,
    });

    await expect(signInLink).toBeVisible();
    await expect(signInLink).toHaveAttribute(
      'href',
      `/login?code=${recoveryGuest.invitationCode}`,
    );
  });

  test('should navigate to /login with code pre-filled when clicking "Sign in with this code"', async ({
    page,
  }) => {
    await page.goto('/rsvp/recover');

    await page.getByLabel(/last name/i).fill(recoveryGuest.lastName);
    await page.getByLabel(/street address/i).fill(recoveryGuest.streetAddress);
    await page.getByLabel(/zip code/i).fill(recoveryGuest.zipCode);
    await page.getByRole('button', { name: /find my code/i }).click();

    await page.getByRole('link', { name: /sign in with this code/i }).click();

    await expect(page).toHaveURL(`/login?code=${recoveryGuest.invitationCode}`);
  });
});

// ── Scenario 3: Failed recovery flow ─────────────────────────────────────────

test.describe('Recovery page — no matching invitation', () => {
  test('should show a generic error message when details do not match any record', async ({
    page,
  }) => {
    await page.goto('/rsvp/recover');

    await page.getByLabel(/last name/i).fill('Unknown');
    await page.getByLabel(/street address/i).fill('999 Nowhere Rd');
    await page.getByLabel(/zip code/i).fill('00000');
    await page.getByRole('button', { name: /find my code/i }).click();

    await expect(
      page.getByText(/couldn't find an invitation matching those details/i),
    ).toBeVisible();
  });
});

// ── Scenario 4: Recovery link in the error state ─────────────────────────────

test.describe('Login page — recovery link in error state', () => {
  test('should show an inline "Missing your code?" link when an invalid code is submitted', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByLabel('Invitation Code').fill('fake-code');
    await page.getByRole('button', { name: 'Continue to RSVP' }).click();

    await expect(
      page.getByRole('link', { name: /missing your code\?/i }),
    ).toBeVisible();
  });

  test('should navigate cleanly to /rsvp/recover when clicking the inline error link', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByLabel('Invitation Code').fill('fake-code');
    await page.getByRole('button', { name: 'Continue to RSVP' }).click();

    await page.getByRole('link', { name: /missing your code\?/i }).click();

    await expect(page).toHaveURL('/rsvp/recover');
  });
});
