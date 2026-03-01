import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Logs in as a guest using the invitation code flow.
 *
 * Navigates to /login, enters the provided code, submits the form, and
 * waits for the redirect to /rsvp. Throws if authentication fails.
 *
 * @param page - Playwright page object.
 * @param invitationCode - Two-word code (e.g. 'test-swift').
 */
export async function loginAsGuest(
  page: Page,
  invitationCode: string,
): Promise<void> {
  await page.goto('/login');

  await page.getByLabel('Invitation Code').fill(invitationCode);
  await page.getByRole('button', { name: 'Continue to RSVP' }).click();

  // Wait for the redirect to complete after successful sign-in.
  await expect(page).toHaveURL('/rsvp');
}
