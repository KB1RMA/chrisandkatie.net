import { test, expect } from '@playwright/test';
import path from 'path';
import { loginAsGuest } from './helpers/login';

/**
 * E2E tests for US1: Guest Takes and Shares a Photo.
 *
 * Uses the file input fallback (capture attribute) since getUserMedia is
 * not available in the Playwright test environment.
 *
 * Prerequisites:
 *   - A guest account exists (seeded via e2e-seed.sql with code 'test-swift')
 *   - Alice/Bob (test-swift) are linked to event-e2e-pool-day and event-e2e-bbq
 *   - The upload API route is functional
 *   - R2 is configured (or stubbed) in the local dev environment
 */

const VALID_CODE = 'test-swift';
const EVENT_ID = 'event-e2e-pool-day';

// Path to a small test image bundled with the repo
const TEST_IMAGE_PATH = path.resolve(
  process.cwd(),
  'public/images/gallery/70087357173__158F6804-3CF9-45B4-9277-F32E81811A94.jpg',
);

test.describe('Photo Booth — Guest Takes and Shares a Photo (US1)', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/photo-booth');

    await expect(page).toHaveURL(/\/login/);
  });

  test('should show the photo booth event list after login', async ({
    page,
  }) => {
    await loginAsGuest(page, VALID_CODE);

    await page.goto('/photo-booth');

    await expect(page).toHaveURL('/photo-booth');
    await expect(
      page.getByRole('heading', { name: 'Photo Booth' }),
    ).toBeVisible();
  });

  test('should show file input fallback when camera is unavailable', async ({
    page,
  }) => {
    await loginAsGuest(page, VALID_CODE);

    await page.goto(`/photo-booth/${EVENT_ID}`);

    // The camera API is unavailable in the test environment, so the
    // file input fallback should be shown
    await expect(page.getByText('Take Photo')).toBeVisible();
  });

  test('should show polaroid preview after selecting a file', async ({
    page,
  }) => {
    await loginAsGuest(page, VALID_CODE);

    await page.goto(`/photo-booth/${EVENT_ID}`);

    // Use the camera capture file input (first file input with capture attr)
    const fileInput = page
      .locator('input[type="file"][accept="image/*"]')
      .first();

    await fileInput.setInputFiles(TEST_IMAGE_PATH);

    // The preview should now be visible with retake/confirm buttons
    await expect(page.getByRole('button', { name: /retake/i })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /share photo/i }),
    ).toBeVisible();
  });

  test('should show success state after confirming upload', async ({ page }) => {
    await loginAsGuest(page, VALID_CODE);

    await page.goto(`/photo-booth/${EVENT_ID}`);

    const fileInput = page
      .locator('input[type="file"][accept="image/*"]')
      .first();

    await fileInput.setInputFiles(TEST_IMAGE_PATH);

    await expect(
      page.getByRole('button', { name: /share photo/i }),
    ).toBeVisible();

    await page.getByRole('button', { name: /share photo/i }).click();

    // On success, the success heading and "Take Another" button should appear
    await expect(
      page.getByRole('heading', { name: /photo shared/i }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.getByRole('button', { name: /take another/i }),
    ).toBeVisible();
  });
});
