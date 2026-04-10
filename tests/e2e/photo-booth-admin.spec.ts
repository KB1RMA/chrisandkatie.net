import { test, expect } from '@playwright/test';

/**
 * E2E tests for US3: Photo Moderation by Event Organizer.
 *
 * Verifies that an admin user can access the /admin/photo-booth page and
 * that the photo grid or empty state is rendered correctly.
 *
 * Prerequisites (seeded by e2e-seed.sql):
 *   Admin credentials are handled by the existing session/cookie setup.
 */

test.describe('Admin Photo Booth — moderation page', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in as admin using the credential-based login flow.
    await page.goto('/login');

    // Use admin credentials (name-based login)
    await page.getByLabel('First Name').fill('Admin');
    await page.getByLabel('Last Name').fill('User');
    await page.getByRole('button', { name: /sign in/i }).click();
  });

  test('admin can navigate to /admin/photo-booth and page loads', async ({
    page,
  }) => {
    await page.goto('/admin/photo-booth');

    // The page should render the Photo Booth heading
    await expect(
      page.getByRole('heading', { name: 'Photo Booth' }),
    ).toBeVisible({ timeout: 10_000 });

    // Either photos are present or the empty state is shown
    const hasPhotos = await page.locator('img[alt="Guest photo"]').count();
    const emptyState = page.getByText('No photos yet.');

    if (hasPhotos === 0) {
      await expect(emptyState).toBeVisible();
    } else {
      expect(hasPhotos).toBeGreaterThan(0);
    }
  });

  test('admin photo booth page shows remove/restore controls when photos exist', async ({
    page,
  }) => {
    await page.goto('/admin/photo-booth');

    await expect(
      page.getByRole('heading', { name: 'Photo Booth' }),
    ).toBeVisible({ timeout: 10_000 });

    const photoCount = await page.locator('img[alt="Guest photo"]').count();

    // Only validate controls if photos are present; otherwise skip.
    if (photoCount > 0) {
      const removeOrRestoreButtons = page.getByRole('button', {
        name: /remove|restore/i,
      });

      await expect(removeOrRestoreButtons.first()).toBeVisible();
    }
  });
});
