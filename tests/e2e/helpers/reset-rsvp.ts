import { execSync } from 'child_process';

const REPO_ROOT = process.cwd();
const DB_NAME = 'prisma-demo-db-local';

/**
 * Resets the RSVP state for the E2E test invitation back to its seeded baseline.
 *
 * Clears `attending`, `mealChoice`, `dietaryRestrictions`, and `notes` on all
 * E2E guests so every test starts from a "not yet submitted" state. Also clears
 * `contactEmail` on the invitation row and removes any event RSVP responses
 * (RsvpResponse rows) for the e2e guests so event RSVP cards show "Not Responded".
 *
 * Covers both seeded invitations:
 *   - `invite-e2e-a`        (guests: alice, bob) — main RSVP flow tests
 *   - `invite-e2e-noextras` (guest: plain)       — empty-additional-events tests
 */
export function resetRsvpState(): void {
  const exec = (cmd: string) =>
    execSync(cmd, { cwd: REPO_ROOT, stdio: 'inherit' });

  exec(
    `npx wrangler d1 execute ${DB_NAME} --local --command "UPDATE Guest SET attending = NULL, mealChoice = NULL, dietaryRestrictions = NULL, notes = NULL WHERE invitationId IN ('invite-e2e-a', 'invite-e2e-noextras')"`,
  );

  exec(
    `npx wrangler d1 execute ${DB_NAME} --local --command "UPDATE Invitation SET contactEmail = NULL WHERE id IN ('invite-e2e-a', 'invite-e2e-noextras')"`,
  );

  // Remove event RsvpResponse rows so event cards reset to "Not Responded" state.
  exec(
    `npx wrangler d1 execute ${DB_NAME} --local --command "DELETE FROM RsvpResponse WHERE guestId IN ('guest-e2e-alice', 'guest-e2e-bob', 'guest-e2e-plain')"`,
  );
}
