import { execSync } from 'child_process';

const REPO_ROOT = process.cwd();
const DB_NAME = 'prisma-demo-db-local';

/**
 * Resets the RSVP state for the E2E test invitation back to its seeded baseline.
 *
 * Clears `attending`, `mealChoice`, `dietaryRestrictions`, and `notes` on all
 * E2E guests so every test starts from a "not yet submitted" state. Also clears
 * `contactEmail` on the invitation row.
 *
 * The seeded invitation ID is `invite-e2e-a` (see tests/fixtures/e2e-seed.sql).
 */
export function resetRsvpState(): void {
  const exec = (cmd: string) =>
    execSync(cmd, { cwd: REPO_ROOT, stdio: 'inherit' });

  exec(
    `npx wrangler d1 execute ${DB_NAME} --local --command "UPDATE Guest SET attending = NULL, mealChoice = NULL, dietaryRestrictions = NULL, notes = NULL WHERE invitationId = 'invite-e2e-a'"`,
  );

  exec(
    `npx wrangler d1 execute ${DB_NAME} --local --command "UPDATE Invitation SET contactEmail = NULL WHERE id = 'invite-e2e-a'"`,
  );
}
