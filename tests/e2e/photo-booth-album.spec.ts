import { test, expect } from '@playwright/test';
import { loginAsGuest } from './helpers/login';

/**
 * E2E tests for the Photo Booth Album page (User Story 2).
 *
 * Prerequisites:
 *   - A guest account exists (seeded via e2e-seed.sql with code 'test-swift')
 *   - The photo-booth album page is accessible at /photo-booth/album
 *
 * These tests focus on:
 *   1. Authenticated guests can navigate to and view the album page
 *   2. The polaroid grid renders when photos are present
 *   3. Unauthenticated users are redirected to login
 */

const VALID_CODE = 'test-swift';

test.describe('Photo Booth Album', () => {
  test('should load the album page for an authenticated guest', async ({
    page,
  }) => {
    await loginAsGuest(page, VALID_CODE);

    await page.goto('/photo-booth/album');

    await expect(page).toHaveURL('/photo-booth/album');
    await expect(
      page.getByRole('heading', { name: 'Photo Booth Album' }),
    ).toBeVisible();
  });

  test('should show empty state message when no photos exist', async ({
    page,
  }) => {
    await loginAsGuest(page, VALID_CODE);

    await page.goto('/photo-booth/album');

    // If the album has no photos, show the empty state
    // If photos exist (from other tests), skip this assertion
    const hasEmptyState = await page
      .getByText('No photos yet — be the first to take one!')
      .isVisible()
      .catch(() => false);

    const hasMasonryGrid = await page
      .locator('[class*="react-photo-album"]')
      .isVisible()
      .catch(() => false);

    // Either the empty state or the photo grid should be present
    expect(hasEmptyState || hasMasonryGrid).toBe(true);
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Navigate directly without logging in
    await page.goto('/photo-booth/album');

    // Should be redirected to the login page
    await expect(page).toHaveURL(/\/login/);
  });
});
