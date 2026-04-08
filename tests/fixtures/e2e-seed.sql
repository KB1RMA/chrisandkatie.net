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

-- Events mirroring production structure with dummy locations.
-- Wedding and Cocktail (main, rsvpRequired=0) drive no Step-3 cards.
-- Pool Day and BBQ (other, rsvpRequired=1) appear as additional event cards on Step 3.
INSERT INTO Event (
  id, name, description, location, eventDate, startTime, endTime,
  type, dressCode, parkingInfo, sortOrder, rsvpRequired, createdAt, updatedAt
)
VALUES
  (
    'event-e2e-wedding',
    'Wedding Celebration',
    'Join us for dinner and dancing at our wedding celebration.',
    '1 Test Hall Way, Springfield, USA',
    '2026-09-12', '17:00', '22:00',
    'main', NULL, 'Street parking available.', 50, 0,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'event-e2e-cocktail',
    'Cocktail Hour',
    'Join us for a welcome cocktail hour prior to the celebration.',
    '1 Test Hall Way, Springfield, USA',
    '2026-09-12', '16:00', '17:00',
    'main', NULL, 'Street parking available.', 40, 0,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'event-e2e-pool-day',
    'Pool Day',
    'Come for a pool day and BBQ! Food and drinks provided.',
    '100 Test Farm Rd, Chester, USA',
    '2026-09-10', '13:00', '18:00',
    'other', NULL, 'Plenty of parking at the house.', 10, 1,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'event-e2e-bbq',
    'BBQ Dinner',
    'Come see our house and hang out with us the night before the celebration.',
    '1 Olive Ave, Springfield, USA',
    '2026-09-11', '17:00', '21:00',
    'other', NULL, 'Limited parking — nearby lot one block away.', 20, 1,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  );

-- Link both of the rsvpRequired=true events to alice and bob so Step 3 shows event cards.
INSERT INTO GuestEvent (id, guestId, eventId)
VALUES
  ('guestevent-e2e-alice-pool',  'guest-e2e-alice', 'event-e2e-pool-day'),
  ('guestevent-e2e-bob-pool',    'guest-e2e-bob',   'event-e2e-pool-day'),
  ('guestevent-e2e-alice-bbq',   'guest-e2e-alice', 'event-e2e-bbq'),
  ('guestevent-e2e-bob-bbq',     'guest-e2e-bob',   'event-e2e-bbq');

-- No-extras invitation — intentionally has no GuestEvent rows so Step 3
-- shows the "You're all set!" empty-state banner.
INSERT INTO Invitation (
  id, relationshipToCouple, totalInvited, visibleEvents,
  invitationCode, createdAt, updatedAt
)
VALUES (
  'invite-e2e-noextras', 'Test', 1, '[0,1,2,3]',
  'test-plain', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

INSERT INTO Guest (
  id, invitationId, firstName, lastName, type, createdAt, updatedAt
)
VALUES
  ('guest-e2e-plain', 'invite-e2e-noextras', 'Plain', 'Guest', 'adult', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

COMMIT;
