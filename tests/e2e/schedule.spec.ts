import { test, expect } from '@playwright/test';
import { loginAsGuest } from './helpers/login';

/**
 * E2E tests for the Schedule page.
 *
 * Verifies that the schedule page shows only the events linked to the
 * authenticated guest's invitation via GuestEvent rows.
 *
 * Seed data (e2e-seed.sql) configures two distinct invitations:
 *   test-swift (Alice E2E, Bob E2E)  — linked to all 4 events
 *   test-code  (Recovery Testguest) — linked to main events only
 *     (Wedding Celebration, Cocktail Hour)
 */

const FULL_ACCESS_CODE = 'test-swift';
const MAIN_ONLY_CODE = 'test-code';

test.describe('Schedule page — guest view', () => {
  test('should redirect unauthenticated users to /login', async ({ page }) => {
    await page.goto('/schedule');

    await expect(page).toHaveURL(/\/login/);
  });

  test('should show the Schedule heading after login', async ({ page }) => {
    await loginAsGuest(page, FULL_ACCESS_CODE);

    await page.goto('/schedule');

    await expect(page).toHaveURL('/schedule');
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible();
  });

  test('should show the guest welcome message with both guest first names', async ({
    page,
  }) => {
    await loginAsGuest(page, FULL_ACCESS_CODE);

    await page.goto('/schedule');

    await expect(page.getByText(/Alice.*Bob|Bob.*Alice/)).toBeVisible();
  });

  test('should show all 4 events for a full-access invitation', async ({
    page,
  }) => {
    await loginAsGuest(page, FULL_ACCESS_CODE);

    await page.goto('/schedule');

    await expect(
      page.getByRole('heading', { name: 'Wedding Celebration' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Cocktail Hour' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pool Day' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'BBQ Dinner' }),
    ).toBeVisible();
  });
});

test.describe('Schedule page — event filtering', () => {
  test('should show only linked events for a main-events-only invitation', async ({
    page,
  }) => {
    await loginAsGuest(page, MAIN_ONLY_CODE);

    await page.goto('/schedule');

    // test-code has GuestEvent rows for main events only.
    await expect(
      page.getByRole('heading', { name: 'Wedding Celebration' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Cocktail Hour' }),
    ).toBeVisible();

    // Other events are not linked — they must not appear.
    await expect(page.getByRole('heading', { name: 'Pool Day' })).toBeHidden();
    await expect(
      page.getByRole('heading', { name: 'BBQ Dinner' }),
    ).toBeHidden();
  });
});

test.describe('Schedule page — admin view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');

    await page.getByText('Admin sign in').click();

    await page
      .getByLabel('Username')
      .fill(process.env.ADMIN_USERNAME ?? 'admin');
    await page
      .getByLabel('Password')
      .fill(process.env.ADMIN_PASSWORD ?? 'testpassword');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    // Wait for the post-login redirect to complete so the session cookie is set.
    await page.waitForURL(/\/admin\//);
  });

  test('should show all events for an admin', async ({ page }) => {
    await page.goto('/schedule');

    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible();

    // Admins see every event regardless of GuestEvent links.
    await expect(page.getByRole('heading', { name: 'Pool Day' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'BBQ Dinner' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Wedding Celebration' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Cocktail Hour' }),
    ).toBeVisible();
  });
});
