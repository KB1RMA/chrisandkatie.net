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

-- test-swift (Alice, Bob) gets all 4 events — mirrors a full-access invitation.
-- test-code (Recovery) gets only the 2 main events — exercises GuestEvent filtering.
INSERT INTO GuestEvent (id, guestId, eventId)
VALUES
  ('guestevent-e2e-alice-wedding',    'guest-e2e-alice',   'event-e2e-wedding'),
  ('guestevent-e2e-bob-wedding',      'guest-e2e-bob',     'event-e2e-wedding'),
  ('guestevent-e2e-recover-wedding',  'guest-e2e-recover', 'event-e2e-wedding'),
  ('guestevent-e2e-alice-cocktail',   'guest-e2e-alice',   'event-e2e-cocktail'),
  ('guestevent-e2e-bob-cocktail',     'guest-e2e-bob',     'event-e2e-cocktail'),
  ('guestevent-e2e-recover-cocktail', 'guest-e2e-recover', 'event-e2e-cocktail'),
  ('guestevent-e2e-alice-pool',       'guest-e2e-alice',   'event-e2e-pool-day'),
  ('guestevent-e2e-bob-pool',         'guest-e2e-bob',     'event-e2e-pool-day'),
  ('guestevent-e2e-alice-bbq',        'guest-e2e-alice',   'event-e2e-bbq'),
  ('guestevent-e2e-bob-bbq',          'guest-e2e-bob',     'event-e2e-bbq');

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

-- ---------------------------------------------------------------------------
-- Venue guest-list export fixture (used by admin-guest-export.spec.ts).
--
-- Kept on its own invitation so the RSVP specs' reset helper — which only
-- touches invite-e2e-a and invite-e2e-noextras — cannot disturb it.
--
--   Carol Export: seated at both charts, RSVP'd to the BBQ with a different
--                 meal than her wedding meal. Proves the BBQ export reports
--                 the BBQ meal, not the wedding one.
--   Dave Export:  seated at the wedding, never invited to the BBQ. Proves the
--                 BBQ export marks him Not Invited rather than No Response.
-- ---------------------------------------------------------------------------
INSERT INTO Invitation (
  id, relationshipToCouple, totalInvited, visibleEvents,
  invitationCode, mailingAddress, createdAt, updatedAt
)
VALUES (
  'invite-e2e-export', 'Test', 2, '[0,1,2,3]',
  'test-export', 'The Export Family', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

INSERT INTO Guest (
  id, invitationId, firstName, lastName, type,
  attending, mealChoice, dietaryRestrictions, notes, createdAt, updatedAt
)
VALUES
  (
    'guest-e2e-carol', 'invite-e2e-export', 'Carol', 'Export', 'adult',
    1, 'short-rib', 'Peanut allergy', 'Maid of honor',
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'guest-e2e-dave', 'invite-e2e-export', 'Dave', 'Export', 'child',
    NULL, NULL, NULL, NULL,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  );

-- Carol is invited to the wedding and the BBQ; Dave only to the wedding.
INSERT INTO GuestEvent (id, guestId, eventId)
VALUES
  ('guestevent-e2e-carol-wedding', 'guest-e2e-carol', 'event-e2e-wedding'),
  ('guestevent-e2e-carol-bbq',     'guest-e2e-carol', 'event-e2e-bbq'),
  ('guestevent-e2e-dave-wedding',  'guest-e2e-dave',  'event-e2e-wedding');

-- Seating charts exist for the wedding and the BBQ only. Cocktail Hour and
-- Pool Day are deliberately left without tables so the export dropdown has
-- chart-less events to filter out.
INSERT INTO SeatingTable (
  id, eventId, name, capacity, isHeadTable, sortOrder, createdAt, updatedAt
)
VALUES
  (
    'seatingtable-e2e-wedding-head', 'event-e2e-wedding', 'Head Table',
    8, 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'seatingtable-e2e-bbq-picnic', 'event-e2e-bbq', 'Picnic Table 2',
    8, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  );

INSERT INTO SeatingAssignment (id, eventId, tableId, guestId, seatOrder, createdAt)
VALUES
  (
    'seatingassign-e2e-carol-wedding', 'event-e2e-wedding',
    'seatingtable-e2e-wedding-head', 'guest-e2e-carol', 0, CURRENT_TIMESTAMP
  ),
  (
    'seatingassign-e2e-dave-wedding', 'event-e2e-wedding',
    'seatingtable-e2e-wedding-head', 'guest-e2e-dave', 1, CURRENT_TIMESTAMP
  ),
  (
    'seatingassign-e2e-carol-bbq', 'event-e2e-bbq',
    'seatingtable-e2e-bbq-picnic', 'guest-e2e-carol', 0, CURRENT_TIMESTAMP
  );

-- Erin sits on her own invitation with no BBQ response at all. She is the
-- guest who exposes a wedding-data leak: the reconstruction has no meal for
-- her, so a BBQ export that still consults the guest-level columns would
-- report her wedding meal and her wedding attendance. She is also invited to
-- the BBQ but unseated, so her Table cell must be blank.
INSERT INTO Invitation (
  id, relationshipToCouple, totalInvited, visibleEvents,
  invitationCode, mailingAddress, createdAt, updatedAt
)
VALUES (
  'invite-e2e-export-b', 'Test', 1, '[0,1,2,3]',
  'test-export-b', 'The Unseated Family', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

INSERT INTO Guest (
  id, invitationId, firstName, lastName, type,
  attending, mealChoice, dietaryRestrictions, notes, createdAt, updatedAt
)
VALUES (
  'guest-e2e-erin', 'invite-e2e-export-b', 'Erin', 'Export', 'adult',
  1, 'roasted-chicken', 'Gluten free', NULL,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

INSERT INTO GuestEvent (id, guestId, eventId)
VALUES
  ('guestevent-e2e-erin-wedding', 'guest-e2e-erin', 'event-e2e-wedding'),
  ('guestevent-e2e-erin-bbq',     'guest-e2e-erin', 'event-e2e-bbq');

-- Carol's BBQ RSVP. The attendee name must match "firstName lastName" for the
-- reconstruction to attribute the meal to her.
INSERT INTO RsvpResponse (
  id, guestId, eventId, attendanceStatus, numberOfAttending,
  submittedAt, updatedAt
)
VALUES (
  'rsvp-e2e-carol-bbq', 'guest-e2e-carol', 'event-e2e-bbq',
  'attending', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

INSERT INTO Attendee (
  id, rsvpResponseId, name, mealOption, dietaryRestrictions, sortOrder, createdAt
)
VALUES (
  'attendee-e2e-carol-bbq', 'rsvp-e2e-carol-bbq', 'Carol Export',
  'option_b', 'Shellfish', 0, CURRENT_TIMESTAMP
);

COMMIT;
