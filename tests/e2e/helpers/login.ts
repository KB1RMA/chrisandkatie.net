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

/**
 * Logs in as an admin using the credential-based login flow.
 *
 * Navigates to /login, reveals the admin form behind its toggle, submits the
 * credentials, and waits for the redirect into /admin so the session cookie is
 * set before the test proceeds. Credentials come from ADMIN_USERNAME and
 * ADMIN_PASSWORD, defaulting to the values CI seeds.
 *
 * @param page - Playwright page object.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');

  // The admin credentials form is hidden by default behind a toggle.
  await page.getByText('Admin sign in').click();

  await page.getByLabel('Username').fill(process.env.ADMIN_USERNAME ?? 'admin');
  await page
    .getByLabel('Password')
    .fill(process.env.ADMIN_PASSWORD ?? 'testpassword');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  // Wait for the post-login redirect so the session cookie is available.
  await page.waitForURL(/\/admin\//);
}
