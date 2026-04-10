import { test, expect } from '@playwright/test';
import { loginAsGuest } from './helpers/login';

/**
 * E2E tests for the Photo Booth Album page (User Story 2).
 *
 * Prerequisites:
 *   - A guest account exists (seeded via e2e-seed.sql with code 'test-swift')
 *   - Alice/Bob (test-swift) are linked to event-e2e-pool-day ('Pool Day')
 *   - The per-event album is accessible at /photo-booth/[eventId]
 *
 * These tests focus on:
 *   1. Authenticated guests can navigate to and view a per-event album page
 *   2. The polaroid grid renders when photos are present
 *   3. Unauthenticated users are redirected to login
 */

const VALID_CODE = 'test-swift';
const EVENT_ID = 'event-e2e-pool-day';
const EVENT_NAME = 'Pool Day';

test.describe('Photo Booth Album', () => {
  test('should load the album page for an authenticated guest', async ({
    page,
  }) => {
    await loginAsGuest(page, VALID_CODE);

    await page.goto(`/photo-booth/${EVENT_ID}`);

    await expect(page).toHaveURL(`/photo-booth/${EVENT_ID}`);
    await expect(
      page.getByRole('heading', { name: EVENT_NAME }),
    ).toBeVisible();
  });

  test('should show empty state message when no photos exist', async ({
    page,
  }) => {
    await loginAsGuest(page, VALID_CODE);

    await page.goto(`/photo-booth/${EVENT_ID}`);

    // If the album has no photos, show the empty state.
    // If photos exist (from other tests), the masonry grid is shown instead.
    const emptyState = page.getByText(
      'No photos yet — be the first to take one!',
    );
    const masonryGrid = page.locator('[class*="react-photo-album"]');

    await expect(emptyState.or(masonryGrid).first()).toBeVisible();
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Navigate directly without logging in
    await page.goto(`/photo-booth/${EVENT_ID}`);

    // Should be redirected to the login page
    await expect(page).toHaveURL(/\/login/);
  });
});
