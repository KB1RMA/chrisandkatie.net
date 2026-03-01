import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Completes the wizard's address confirmation step (Step 1) by clicking
 * the "Looks correct — continue" button, then waits for Step 2 (the RSVP
 * form) to be fully rendered before returning.
 *
 * Waiting is essential on CI where the updateInvitationAddress server action
 * may take a moment to complete before the wizard transitions.
 *
 * @param page - Playwright page object.
 */
export async function completeAddressStep(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Looks correct — continue' }).click();

  // Wait for the RSVP form (Step 2) to be ready before the caller proceeds.
  await expect(
    page.getByRole('button', { name: /Submit RSVP|Update RSVP/ }),
  ).toBeVisible();
}
