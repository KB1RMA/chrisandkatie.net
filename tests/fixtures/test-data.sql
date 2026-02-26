-- Test data for integration testing: events, invitations, guests, and guest_event records
-- Run with: npm run db:seed:test-data
--
-- Committed to source control. Does NOT contain real guest data.
--
-- Test guest assignments:
--   Guest A (Alice Test): rehearsal dinner + day-after brunch
--   Guest B (Bob Test): rehearsal dinner only
--   Guest C (Carol Test): main wedding only (no additional events)

BEGIN TRANSACTION;

-- Test invitations
INSERT OR IGNORE INTO Invitation (id, relationshipToCouple, totalInvited, visibleEvents, createdAt, updatedAt)
VALUES
  ('invite-test-a', 'Test', 2, '[0,1,2,3]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('invite-test-b', 'Test', 2, '[0,1,2,3]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('invite-test-c', 'Test', 1, '[0,1,2,3]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Test guests
INSERT OR IGNORE INTO Guest (id, invitationId, firstName, lastName, type, createdAt, updatedAt)
VALUES
  ('guest-test-alice', 'invite-test-a', 'Alice',  'Test', 'adult', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('guest-test-alice-partner', 'invite-test-a', 'Alex', 'Test', 'adult', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('guest-test-bob',   'invite-test-b', 'Bob',    'Test', 'adult', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('guest-test-bob-partner', 'invite-test-b', 'Bridget', 'Test', 'adult', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('guest-test-carol', 'invite-test-c', 'Carol',  'Test', 'adult', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Additional events
INSERT OR IGNORE INTO Event (id, name, description, location, eventDate, eventTime, duration, type, dressCode, parkingInfo, sortOrder, createdAt, updatedAt)
VALUES
  (
    'event-rehearsal-dinner-001',
    'Rehearsal Dinner',
    'Join us for dinner the evening before the wedding as we rehearse the ceremony and celebrate with our closest family and friends.',
    'The Barn at Gibbet Hill, Groton, MA',
    '2026-09-11',
    '18:30',
    120,
    'rehearsal',
    'Smart Casual',
    'Complimentary valet parking available.',
    10,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'event-farewell-brunch-001',
    'Day-After Brunch',
    'A relaxed morning brunch to cap off the weekend and say goodbye before everyone heads home.',
    'Lantern Restaurant, Groton, MA',
    '2026-09-13',
    '10:00',
    90,
    'brunch',
    'Casual',
    'Street parking available on Main St.',
    20,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );

-- Guest A (Alice + partner): invited to rehearsal dinner + day-after brunch
INSERT OR IGNORE INTO GuestEvent (id, guestId, eventId)
VALUES
  ('ge-alice-rehearsal',  'guest-test-alice',         'event-rehearsal-dinner-001'),
  ('ge-alice-brunch',     'guest-test-alice',         'event-farewell-brunch-001'),
  ('ge-alexp-rehearsal',  'guest-test-alice-partner', 'event-rehearsal-dinner-001'),
  ('ge-alexp-brunch',     'guest-test-alice-partner', 'event-farewell-brunch-001');

-- Guest B (Bob + partner): invited to rehearsal dinner only
INSERT OR IGNORE INTO GuestEvent (id, guestId, eventId)
VALUES
  ('ge-bob-rehearsal',    'guest-test-bob',           'event-rehearsal-dinner-001'),
  ('ge-bobp-rehearsal',   'guest-test-bob-partner',   'event-rehearsal-dinner-001');

-- Guest C (Carol): main wedding only — no GuestEvent rows needed.

COMMIT;
