/**
 * Recovery E2E fixture — known Guest + Invitation seed record for use in
 * invite-code-recovery E2E tests.
 *
 * This data matches the record inserted by tests/fixtures/e2e-seed.sql.
 * E2E tests must be run against a local D1 database seeded with that file
 * (the global-setup.ts automatically seeds it before each test run).
 */
export const recoveryGuest = {
  /** Guest's last name, case-insensitively matched during recovery. */
  lastName: 'Testguest',
  /** Street address the invitation was mailed to. */
  streetAddress: '42 Recovery Lane',
  /** ZIP code the invitation was mailed to. */
  zipCode: '62701',
  /** The invitation code returned on a successful recovery. */
  invitationCode: 'test-code',
} as const;
