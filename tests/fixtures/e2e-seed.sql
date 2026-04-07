-- E2E test seed data for RSVP flow tests.
--
-- The database is wiped and re-bootstrapped by global-setup.ts before every
-- test run, so no teardown is needed here. This file only inserts known data.
--
-- Test invitation:
--   Invitation code:  test-swift
--   Guests:           Alice E2E, Bob E2E
--   Invitation ID:    invite-e2e-a

BEGIN TRANSACTION;

INSERT INTO Invitation (
  id, relationshipToCouple, totalInvited, visibleEvents,
  invitationCode, createdAt, updatedAt
)
VALUES (
  'invite-e2e-a', 'Test', 2, '[0,1,2,3]',
  'test-swift', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

INSERT INTO Guest (
  id, invitationId, firstName, lastName, type, createdAt, updatedAt
)
VALUES
  ('guest-e2e-alice', 'invite-e2e-a', 'Alice', 'E2E', 'adult', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('guest-e2e-bob',   'invite-e2e-a', 'Bob',   'E2E', 'adult', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Recovery test invitation (used by invite-code-recovery.spec.ts).
--   Invitation code:  test-code
--   Guest:            Recovery Testguest
--   Street address:   42 Recovery Lane
--   ZIP code:         62701
INSERT INTO Invitation (
  id, relationshipToCouple, totalInvited, visibleEvents,
  invitationCode, address, zipCode, createdAt, updatedAt
)
VALUES (
  'invite-e2e-recover', 'Test', 1, '[0,1,2,3]',
  'test-code', '42 Recovery Lane', '62701', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

INSERT INTO Guest (
  id, invitationId, firstName, lastName, type, createdAt, updatedAt
)
VALUES
  ('guest-e2e-recover', 'invite-e2e-recover', 'Recovery', 'Testguest', 'adult', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

COMMIT;
