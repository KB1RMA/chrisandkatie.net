import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

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
    await loginAsAdmin(page);
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
    const photos = page.locator('img[alt="Guest photo"]');
    const emptyState = page.getByText('No photos yet.');

    await expect(photos.or(emptyState).first()).toBeVisible();
  });

  test('admin photo booth page shows remove/restore controls when photos exist', async ({
    page,
  }) => {
    await page.goto('/admin/photo-booth');

    await expect(
      page.getByRole('heading', { name: 'Photo Booth' }),
    ).toBeVisible({ timeout: 10_000 });

    // When photos exist the moderation controls must be visible;
    // when none are seeded the empty state is acceptable.
    const removeOrRestoreButtons = page.getByRole('button', {
      name: /remove|restore/i,
    });
    const emptyState = page.getByText('No photos yet.');

    await expect(removeOrRestoreButtons.first().or(emptyState)).toBeVisible();
  });
});
