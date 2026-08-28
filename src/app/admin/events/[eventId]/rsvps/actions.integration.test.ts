/**
 * Integration tests for the admin RSVP override.
 *
 * @vitest-environment node
 *
 * These run the real server action, repositories, Drizzle statements and D1
 * batch against a real (temporary, per-run) SQLite database built from the
 * project's own migration files. Only the session and Next.js cache
 * revalidation are stubbed — everything that touches data is the production
 * code path.
 *
 * The point is regression cover for the two hazards inherent in the
 * party-level storage model:
 *   1. A second, parallel response row for one party member would survive a
 *      later guest submission and double-count them.
 *   2. Creating a party's first response row moves every member of that party
 *      off `no_response`, which would silently drop party-mates from the
 *      seating chart.
 * Neither is visible to a mock-backed unit test.
 */
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  expect,
  test,
  describe,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { getPlatformProxy } from 'wrangler';
import * as schema from '@/lib/db/schema';
import type { DbClient } from '@/lib/db';

const holder = vi.hoisted(() => ({ db: null as DbClient | null }));

vi.mock('@/lib/db', () => ({
  getDb: () => holder.db,
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  getAuthIdentity: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// The guest-facing action enqueues a notification; no queue binding is needed
// because the send is optional-chained.
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => ({ env: {} }),
}));

import { auth, getAuthIdentity } from '@/lib/auth';
import {
  findMealBreakdownForEvent,
  getEventRsvpReconstruction,
} from '@/lib/db/repositories/rsvpResponses';
import {
  retrieveEventRsvp,
  submitEventRsvp,
} from '@/app/rsvp/(portal)/[eventId]/actions';
import { setPartyEventRsvp } from './actions';

const mockAuth = vi.mocked(auth);
const mockGetAuthIdentity = vi.mocked(getAuthIdentity);

const EVENT_ID = 'event-1';
const MAIN_EVENT_ID = 'event-main';
const NOW = '2026-02-01T00:00:00.000Z';

let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
let persistPath: string;

/**
 * Applies every migration file in order, so the test schema is the schema the
 * app actually deploys (and drifts when the migrations do).
 *
 * @param database - The D1 binding to apply migrations to.
 */
async function applyMigrations(database: D1Database): Promise<void> {
  const files = readdirSync('migrations')
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const statements = readFileSync(join('migrations', file), 'utf8')
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    for (const statement of statements) {
      await database.prepare(statement).run();
    }
  }
}

/** Marks the mocked session as an authenticated admin. */
function asAdmin(): void {
  mockAuth.mockResolvedValue(null);
  mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
}

/**
 * Marks the mocked session as a guest on the given invitation, as the
 * guest-facing RSVP form sees it.
 *
 * @param invitationId - The invitation the guest belongs to.
 */
function asGuest(invitationId: string): void {
  mockAuth.mockResolvedValue({
    user: { invitationId },
    expires: '2027-01-01T00:00:00.000Z',
  });
  mockGetAuthIdentity.mockReturnValue({ type: 'guest', invitationId });
}

/**
 * Seeds three parties invited to a non-main, RSVP-required event:
 * - Party A responded through the event RSVP form, both attending, with meals.
 * - Party B has not responded through that form and has no response row for
 *   the event, but is invited.
 * - Party C has not responded at all.
 *
 * @param db - The database client to seed.
 */
async function seed(db: DbClient): Promise<void> {
  await db.insert(schema.invitations).values([
    { id: 'inv-a', totalInvited: 2, mailingAddress: 'The Alphas' },
    { id: 'inv-b', totalInvited: 2, mailingAddress: 'The Bravos' },
    { id: 'inv-c', totalInvited: 1, mailingAddress: 'The Charlies' },
  ]);

  await db.insert(schema.guests).values([
    {
      id: 'g-alice',
      invitationId: 'inv-a',
      firstName: 'Alice',
      lastName: 'Alpha',
    },
    {
      id: 'g-alex',
      invitationId: 'inv-a',
      firstName: 'Alex',
      lastName: 'Alpha',
    },
    {
      id: 'g-bob',
      invitationId: 'inv-b',
      firstName: 'Bob',
      lastName: 'Bravo',
    },
    {
      id: 'g-bridget',
      invitationId: 'inv-b',
      firstName: 'Bridget',
      lastName: 'Bravo',
    },
    {
      id: 'g-carol',
      invitationId: 'inv-c',
      firstName: 'Carol',
      lastName: 'Charlie',
    },
  ]);

  await db.insert(schema.events).values({
    id: EVENT_ID,
    name: 'Rehearsal Dinner',
    eventDate: '2026-09-11',
    startTime: '17:00',
    endTime: '23:00',
    type: 'other',
    sortOrder: 0,
    rsvpRequired: true,
  });

  await db.insert(schema.guestEvents).values(
    ['g-alice', 'g-alex', 'g-bob', 'g-bridget', 'g-carol'].map((guestId) => ({
      id: `ge-${guestId}`,
      guestId,
      eventId: EVENT_ID,
    })),
  );

  await db.insert(schema.rsvpResponses).values({
    id: 'rsvp-a',
    guestId: 'g-alice',
    eventId: EVENT_ID,
    attendanceStatus: 'attending',
    numberOfAttending: 2,
    specialRequests: 'Near the band',
    submittedAt: NOW,
    updatedAt: NOW,
  });

  await db.insert(schema.attendees).values([
    {
      id: 'att-alice',
      rsvpResponseId: 'rsvp-a',
      name: 'Alice Alpha',
      mealOption: 'option_a',
      dietaryRestrictions: 'Gluten free',
      sortOrder: 0,
    },
    {
      id: 'att-alex',
      rsvpResponseId: 'rsvp-a',
      name: 'Alex Alpha',
      mealOption: 'option_b',
      sortOrder: 1,
    },
  ]);
}

/**
 * Returns the live database client, failing loudly if the suite set-up did not
 * run — keeps the test body free of non-null assertions.
 */
function db(): DbClient {
  if (!holder.db) {
    throw new Error('Database not initialised');
  }

  return holder.db;
}

/** Reads the reconstructed status for every invited guest, keyed by guest id. */
async function statuses(): Promise<Record<string, string>> {
  const { rows } = await getEventRsvpReconstruction(EVENT_ID);

  return rows.reduce<Record<string, string>>(
    (acc, row) => ({ ...acc, [row.guestId]: row.status }),
    {},
  );
}

/**
 * Reads the concurrency token the RSVP page would render for a guest's party —
 * the party's latest response timestamp, or null if it has not responded.
 *
 * @param guestId - Any guest on the party.
 * @returns The party's last-seen updatedAt.
 */
async function partyToken(guestId: string): Promise<string | null> {
  const { rows } = await getEventRsvpReconstruction(EVENT_ID);

  return (
    rows.find((row) => row.guestId === guestId)?.partyRsvpUpdatedAt ?? null
  );
}

/** Reads the stored response rows for the event, with their attendee names. */
async function storedResponses() {
  const rows = await db().query.rsvpResponses.findMany({
    with: { attendees: true },
  });

  return rows.map((row) => ({
    id: row.id,
    guestId: row.guestId,
    attendanceStatus: row.attendanceStatus,
    numberOfAttending: row.numberOfAttending,
    specialRequests: row.specialRequests,
    attendeeNames: row.attendees.map((attendee) => attendee.name).sort(),
  }));
}

/**
 * Reads the RSVP for an event exactly as the guest-facing page would for the
 * given invitation — via `retrieveEventRsvp`, not the admin reconstruction.
 * `retrieveEventRsvp` picks the party member to act as from the invitation's
 * guest-event rows itself (there is no guestId in a guest session), so the
 * resolved guestId is returned rather than chosen by the caller.
 *
 * Used to confirm an admin override is visible to — and safe to resubmit
 * from — the guest-facing flow, not just to the admin-side readers.
 *
 * @param invitationId - The invitation to authenticate as.
 */
async function guestPageView(invitationId: string) {
  asGuest(invitationId);

  const result = await retrieveEventRsvp(EVENT_ID);

  return {
    guestId: result.guestId,
    status: result.rsvp?.attendanceStatus ?? null,
    numberOfAttending: result.rsvp?.numberOfAttending ?? null,
    attendeeNames: result.attendees.map((attendee) => attendee.name).sort(),
  };
}

/**
 * Counts attendee rows that do not belong to any stored response — rows that
 * would be invisible to every reader while still occupying the table.
 */
async function orphanAttendeeCount(): Promise<number> {
  const [allAttendees, responses] = await Promise.all([
    db().query.attendees.findMany(),
    db().query.rsvpResponses.findMany(),
  ]);
  const responseIds = new Set(responses.map((response) => response.id));

  return allAttendees.filter(
    (attendee) => !responseIds.has(attendee.rsvpResponseId),
  ).length;
}

beforeAll(async () => {
  persistPath = mkdtempSync(join(tmpdir(), 'rsvp-integration-'));
  proxy = await getPlatformProxy({ persist: { path: persistPath } });

  await applyMigrations(proxy.env.DB);
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
  rmSync(persistPath, { recursive: true, force: true });
});

beforeEach(async () => {
  vi.clearAllMocks();

  const client = drizzle(proxy.env.DB, { schema });

  // Order matters: children before parents.
  await client.delete(schema.attendees);
  await client.delete(schema.rsvpResponses);
  await client.delete(schema.guestEvents);
  await client.delete(schema.guests);
  await client.delete(schema.events);
  await client.delete(schema.invitations);

  holder.db = client;

  await seed(client);
});

describe('setPartyEventRsvp (integration)', () => {
  test('should seed a state the reconstruction reads as expected', async () => {
    expect(await statuses()).toEqual({
      'g-alice': 'attending',
      'g-alex': 'attending',
      'g-bob': 'no_response',
      'g-bridget': 'no_response',
      'g-carol': 'no_response',
    });
  });

  test('should decline one member of a responding party without touching the other', async () => {
    asAdmin();

    const result = await setPartyEventRsvp({
      eventId: EVENT_ID,
      guestId: 'g-alex',
      expectedUpdatedAt: await partyToken('g-alex'),
      statuses: [
        { guestId: 'g-alice', attending: true },
        { guestId: 'g-alex', attending: false },
      ],
    });

    expect(result).toEqual({ success: true });
    expect(await statuses()).toMatchObject({
      'g-alice': 'attending',
      'g-alex': 'not_attending',
    });
  });

  test('should keep the meal choice of a member who stays attending', async () => {
    // Rewriting the party must not discard meal data the party already gave;
    // the Meal Preferences panel on the same page reads these rows.
    asAdmin();

    await setPartyEventRsvp({
      eventId: EVENT_ID,
      guestId: 'g-alex',
      expectedUpdatedAt: await partyToken('g-alex'),
      statuses: [
        { guestId: 'g-alice', attending: true },
        { guestId: 'g-alex', attending: false },
      ],
    });

    const attendee = await db().query.attendees.findFirst();

    expect(attendee).toMatchObject({
      name: 'Alice Alpha',
      mealOption: 'option_a',
      dietaryRestrictions: 'Gluten free',
    });
    await expect(findMealBreakdownForEvent(EVENT_ID)).resolves.toEqual([
      { mealOption: 'option_a', count: 1 },
    ]);
  });

  test('should preserve the party-level special requests', async () => {
    asAdmin();

    await setPartyEventRsvp({
      eventId: EVENT_ID,
      guestId: 'g-alex',
      expectedUpdatedAt: await partyToken('g-alex'),
      statuses: [
        { guestId: 'g-alice', attending: true },
        { guestId: 'g-alex', attending: false },
      ],
    });

    const [response] = await storedResponses();

    expect(response.specialRequests).toBe('Near the band');
  });

  test('should not create a second response row for the party', async () => {
    // Hazard 1: a parallel row would survive a later guest submission.
    asAdmin();

    await setPartyEventRsvp({
      eventId: EVENT_ID,
      guestId: 'g-alex',
      expectedUpdatedAt: await partyToken('g-alex'),
      statuses: [
        { guestId: 'g-alice', attending: true },
        { guestId: 'g-alex', attending: false },
      ],
    });

    const responses = await storedResponses();

    expect(responses).toHaveLength(1);
    expect(responses[0].id).toBe('rsvp-a');
    // The attendee rows must hang off that same row, not a detached id.
    expect(await orphanAttendeeCount()).toBe(0);
    expect(responses[0].attendeeNames).toEqual(['Alice Alpha']);
  });

  test('should record a decline with no attendee rows when the whole party declines', async () => {
    asAdmin();

    await setPartyEventRsvp({
      eventId: EVENT_ID,
      guestId: 'g-alice',
      expectedUpdatedAt: await partyToken('g-alice'),
      statuses: [
        { guestId: 'g-alice', attending: false },
        { guestId: 'g-alex', attending: false },
      ],
    });

    const [response] = await storedResponses();

    expect(response).toMatchObject({
      attendanceStatus: 'not_attending',
      numberOfAttending: 0,
      attendeeNames: [],
    });
    expect(await statuses()).toMatchObject({
      'g-alice': 'not_attending',
      'g-alex': 'not_attending',
    });
  });

  test('should not decline the party-mates of a party that never responded', async () => {
    // Hazard 2: creating this party's first response row moves every member
    // off no_response. Bridget's status must come out exactly as submitted —
    // anything else drops her from the seating chart.
    asAdmin();

    await setPartyEventRsvp({
      eventId: EVENT_ID,
      guestId: 'g-bob',
      expectedUpdatedAt: await partyToken('g-bob'),
      statuses: [
        { guestId: 'g-bob', attending: false },
        { guestId: 'g-bridget', attending: true },
      ],
    });

    expect(await statuses()).toMatchObject({
      'g-bob': 'not_attending',
      'g-bridget': 'attending',
    });
  });

  test('should leave other parties untouched', async () => {
    asAdmin();

    await setPartyEventRsvp({
      eventId: EVENT_ID,
      guestId: 'g-bob',
      expectedUpdatedAt: await partyToken('g-bob'),
      statuses: [
        { guestId: 'g-bob', attending: false },
        { guestId: 'g-bridget', attending: true },
      ],
    });

    expect(await statuses()).toMatchObject({
      'g-alice': 'attending',
      'g-alex': 'attending',
      'g-carol': 'no_response',
    });
  });

  test('should be idempotent when applied twice from a fresh page each time', async () => {
    asAdmin();

    const statusList = [
      { guestId: 'g-alice', attending: true },
      { guestId: 'g-alex', attending: false },
    ];

    await setPartyEventRsvp({
      eventId: EVENT_ID,
      guestId: 'g-alex',
      expectedUpdatedAt: await partyToken('g-alex'),
      statuses: statusList,
    });
    await setPartyEventRsvp({
      eventId: EVENT_ID,
      guestId: 'g-alex',
      expectedUpdatedAt: await partyToken('g-alex'),
      statuses: statusList,
    });

    const responses = await storedResponses();

    expect(responses).toHaveLength(1);
    expect(responses[0].attendeeNames).toEqual(['Alice Alpha']);
  });

  test('should not leave a duplicate attendee when a party holds two response rows', async () => {
    // Two members of one party can each end up with their own response row.
    // The override rewrites one of them, so the other must not keep a copy of
    // the same person — the meal breakdown counts attendee rows, not people.
    await db().insert(schema.rsvpResponses).values({
      id: 'rsvp-a2',
      guestId: 'g-alex',
      eventId: EVENT_ID,
      attendanceStatus: 'attending',
      numberOfAttending: 1,
      submittedAt: NOW,
      updatedAt: NOW,
    });
    await db().insert(schema.attendees).values({
      id: 'att-alice-dup',
      rsvpResponseId: 'rsvp-a2',
      name: 'Alice Alpha',
      mealOption: 'option_a',
      sortOrder: 0,
    });

    asAdmin();

    await setPartyEventRsvp({
      eventId: EVENT_ID,
      guestId: 'g-alex',
      expectedUpdatedAt: await partyToken('g-alex'),
      statuses: [
        { guestId: 'g-alice', attending: true },
        { guestId: 'g-alex', attending: false },
      ],
    });

    const names = (await storedResponses()).flatMap(
      (response) => response.attendeeNames,
    );

    expect(names).toEqual(['Alice Alpha']);
    await expect(findMealBreakdownForEvent(EVENT_ID)).resolves.toEqual([
      { mealOption: 'option_a', count: 1 },
    ]);
  });

  test('should keep the guest-facing page in sync when the edited guest owns a second response row', async () => {
    // Same two-row setup as above, but this time assert what the guest-facing
    // page itself reads and can safely resubmit — not just what the admin
    // reconstruction reports. retrieveEventRsvp always resolves to the party
    // member findGuestEventsForEvent returns first (here, g-alice, seeded
    // before g-alex), so a write that lands on g-alex's row instead of that
    // member's row would be invisible here even though storedResponses()
    // above sees it fine.
    await db().insert(schema.rsvpResponses).values({
      id: 'rsvp-a2',
      guestId: 'g-alex',
      eventId: EVENT_ID,
      attendanceStatus: 'attending',
      numberOfAttending: 1,
      submittedAt: NOW,
      updatedAt: NOW,
    });
    await db().insert(schema.attendees).values({
      id: 'att-alice-dup',
      rsvpResponseId: 'rsvp-a2',
      name: 'Alice Alpha',
      mealOption: 'option_a',
      sortOrder: 0,
    });

    asAdmin();

    // Edited from g-alex's row — the row the guest page does NOT read.
    await setPartyEventRsvp({
      eventId: EVENT_ID,
      guestId: 'g-alex',
      expectedUpdatedAt: await partyToken('g-alex'),
      statuses: [
        { guestId: 'g-alice', attending: true },
        { guestId: 'g-alex', attending: false },
      ],
    });

    const view = await guestPageView('inv-a');

    expect(view.guestId).toBe('g-alice');
    expect(view.status).toBe('attending');
    expect(view.numberOfAttending).toBe(1);
    expect(view.attendeeNames).toEqual(['Alice Alpha']);

    // Resubmitting from the page the guest actually sees must not resurrect
    // Alex as a duplicate under the other response row.
    await submitEventRsvp({
      guestId: view.guestId,
      eventId: EVENT_ID,
      attendanceStatus: 'attending',
      attendees: [{ name: 'Alice Alpha' }, { name: 'Alex Alpha' }],
    });

    const namesAfterResubmit = (await storedResponses()).flatMap(
      (response) => response.attendeeNames,
    );

    expect(namesAfterResubmit.sort()).toEqual(['Alex Alpha', 'Alice Alpha']);
    expect(
      namesAfterResubmit.filter((name) => name === 'Alice Alpha'),
    ).toHaveLength(1);
  });

  test('should not revert a guest submission made after the page was rendered', async () => {
    // The editor writes a status for every party member, so a save built from a
    // stale page would silently undo whatever changed in the meantime.
    const staleToken = await partyToken('g-alex');
    const staleStatuses = [
      { guestId: 'g-alice', attending: true },
      { guestId: 'g-alex', attending: false },
    ];

    // The party declines through the guest form after the admin loaded the page.
    asGuest('inv-a');
    await submitEventRsvp({
      guestId: 'g-alice',
      eventId: EVENT_ID,
      attendanceStatus: 'not_attending',
      attendees: [],
    });

    asAdmin();

    const result = await setPartyEventRsvp({
      eventId: EVENT_ID,
      guestId: 'g-alex',
      expectedUpdatedAt: staleToken,
      statuses: staleStatuses,
    });

    expect(result).toEqual({
      success: false,
      error:
        "This party's RSVP changed since this page was loaded. Refresh and try again.",
    });
    // Alice must still be declined, not resurrected by the stale snapshot.
    expect(await statuses()).toMatchObject({
      'g-alice': 'not_attending',
      'g-alex': 'not_attending',
    });
  });

  test('should succeed once the editor is reopened with the current state', async () => {
    asGuest('inv-a');
    await submitEventRsvp({
      guestId: 'g-alice',
      eventId: EVENT_ID,
      attendanceStatus: 'not_attending',
      attendees: [],
    });

    asAdmin();

    const result = await setPartyEventRsvp({
      eventId: EVENT_ID,
      guestId: 'g-alex',
      expectedUpdatedAt: await partyToken('g-alex'),
      statuses: [
        { guestId: 'g-alice', attending: false },
        { guestId: 'g-alex', attending: true },
      ],
    });

    expect(result).toEqual({ success: true });
    expect(await statuses()).toMatchObject({
      'g-alice': 'not_attending',
      'g-alex': 'attending',
    });
  });

  test('should reject a save claiming a party has not responded when it has', async () => {
    // Party B has no response row at render time; one appears before the save.
    asGuest('inv-b');
    await submitEventRsvp({
      guestId: 'g-bob',
      eventId: EVENT_ID,
      attendanceStatus: 'attending',
      attendees: [{ name: 'Bob Bravo', mealOption: 'option_a' }],
    });

    asAdmin();

    const result = await setPartyEventRsvp({
      eventId: EVENT_ID,
      guestId: 'g-bob',
      expectedUpdatedAt: null,
      statuses: [
        { guestId: 'g-bob', attending: false },
        { guestId: 'g-bridget', attending: false },
      ],
    });

    expect(result.success).toBe(false);
    expect(await statuses()).toMatchObject({ 'g-bob': 'attending' });
  });

  test('should reject a status list that reaches outside the party', async () => {
    asAdmin();

    const result = await setPartyEventRsvp({
      eventId: EVENT_ID,
      guestId: 'g-alice',
      expectedUpdatedAt: await partyToken('g-alice'),
      statuses: [
        { guestId: 'g-alice', attending: true },
        { guestId: 'g-alex', attending: true },
        { guestId: 'g-carol', attending: false },
      ],
    });

    expect(result).toEqual({
      success: false,
      error: 'The submitted guest list does not match this party.',
    });
    expect(await statuses()).toMatchObject({ 'g-carol': 'no_response' });
  });

  test('should not write anything when the caller is not an admin', async () => {
    asGuest('inv-a');

    await expect(
      setPartyEventRsvp({
        eventId: EVENT_ID,
        guestId: 'g-alex',
        expectedUpdatedAt: await partyToken('g-alex'),
        statuses: [
          { guestId: 'g-alice', attending: true },
          { guestId: 'g-alex', attending: false },
        ],
      }),
    ).rejects.toThrow('Unauthorized');

    expect(await statuses()).toMatchObject({ 'g-alex': 'attending' });
  });

  test('should reject an edit for the main event without touching stored data', async () => {
    // The main event's guest-facing wizard writes only Guest.attending and
    // never looks at RsvpResponse — an override recorded here would be
    // invisible to guests. Seeds a real main-type event and party so the
    // rejection is proven to come from the event-type gate, not some other
    // missing-data path.
    await db().insert(schema.events).values({
      id: MAIN_EVENT_ID,
      name: 'Wedding Reception',
      eventDate: '2026-09-12',
      startTime: '17:00',
      endTime: '23:00',
      type: 'main',
      sortOrder: 0,
      rsvpRequired: true,
    });
    await db()
      .insert(schema.guestEvents)
      .values(
        ['g-alice', 'g-alex'].map((guestId) => ({
          id: `ge-main-${guestId}`,
          guestId,
          eventId: MAIN_EVENT_ID,
        })),
      );

    asAdmin();

    const result = await setPartyEventRsvp({
      eventId: MAIN_EVENT_ID,
      guestId: 'g-alex',
      expectedUpdatedAt: null,
      statuses: [
        { guestId: 'g-alice', attending: true },
        { guestId: 'g-alex', attending: false },
      ],
    });

    expect(result).toEqual({
      success: false,
      error:
        'Main event attendance is managed through the RSVP wizard and cannot be edited here.',
    });

    const allResponses = await db().query.rsvpResponses.findMany();

    expect(
      allResponses.some((response) => response.eventId === MAIN_EVENT_ID),
    ).toBe(false);
  });
});

describe('admin override and guest submission together (integration)', () => {
  test('should let a later guest submission overwrite the admin override cleanly', async () => {
    // Hazard 1, end to end: the guest form upserts on (guest, event) and
    // replaces that row's attendees. If the admin write had landed on a
    // different row, the overridden person would linger as an extra attendee.
    asAdmin();

    await setPartyEventRsvp({
      eventId: EVENT_ID,
      guestId: 'g-alex',
      expectedUpdatedAt: await partyToken('g-alex'),
      statuses: [
        { guestId: 'g-alice', attending: true },
        { guestId: 'g-alex', attending: false },
      ],
    });

    asGuest('inv-a');

    await submitEventRsvp({
      guestId: 'g-alice',
      eventId: EVENT_ID,
      attendanceStatus: 'attending',
      attendees: [
        { name: 'Alice Alpha', mealOption: 'option_a' },
        { name: 'Alex Alpha', mealOption: 'option_b' },
      ],
    });

    const responses = await storedResponses();

    expect(responses).toHaveLength(1);
    expect(responses[0].attendeeNames).toEqual(['Alex Alpha', 'Alice Alpha']);
    expect(await statuses()).toMatchObject({
      'g-alice': 'attending',
      'g-alex': 'attending',
    });
  });

  test('should let an admin override a party that submitted through the guest form', async () => {
    asGuest('inv-b');

    await submitEventRsvp({
      guestId: 'g-bob',
      eventId: EVENT_ID,
      attendanceStatus: 'attending',
      attendees: [
        { name: 'Bob Bravo', mealOption: 'option_a' },
        { name: 'Bridget Bravo', mealOption: 'option_b' },
      ],
    });

    asAdmin();

    await setPartyEventRsvp({
      eventId: EVENT_ID,
      guestId: 'g-bridget',
      expectedUpdatedAt: await partyToken('g-bridget'),
      statuses: [
        { guestId: 'g-bob', attending: true },
        { guestId: 'g-bridget', attending: false },
      ],
    });

    const partyResponses = (await storedResponses()).filter((response) =>
      ['g-bob', 'g-bridget'].includes(response.guestId),
    );

    expect(partyResponses).toHaveLength(1);
    expect(partyResponses[0].attendeeNames).toEqual(['Bob Bravo']);
    expect(await statuses()).toMatchObject({
      'g-bob': 'attending',
      'g-bridget': 'not_attending',
    });
    // Meal selection is a main-event-only concept: submitEventRsvp discards
    // mealOption for a non-main event, so only Party A's seeded meals (one of
    // each) remain; Bob's submitted option_a was never stored, and Bridget's
    // option_b is gone with her attendee row.
    await expect(findMealBreakdownForEvent(EVENT_ID)).resolves.toEqual([
      { mealOption: 'option_a', count: 1 },
      { mealOption: 'option_b', count: 1 },
    ]);
  });

  test('should reflect an admin override on the guest-facing page, prefilled to match', async () => {
    // The general (single-row) case of the guest-page round trip: an admin
    // decline must read back as a decline through retrieveEventRsvp, since
    // that is what pre-fills the guest's own RSVP form.
    asAdmin();

    await setPartyEventRsvp({
      eventId: EVENT_ID,
      guestId: 'g-alice',
      expectedUpdatedAt: await partyToken('g-alice'),
      statuses: [
        { guestId: 'g-alice', attending: false },
        { guestId: 'g-alex', attending: false },
      ],
    });

    expect(await guestPageView('inv-a')).toMatchObject({
      guestId: 'g-alice',
      status: 'not_attending',
      numberOfAttending: 0,
      attendeeNames: [],
    });

    // And the admin's own view (party-level special requests, reconstructed
    // per-guest status) agrees with what the guest would see.
    expect(await statuses()).toMatchObject({
      'g-alice': 'not_attending',
      'g-alex': 'not_attending',
    });
  });

  test('should drop an attendee row for a party member not invited to this event', async () => {
    // buildPartyEventRsvpWrite only writes rows for event-invited `members`,
    // so an admin edit of the rest of the party silently deletes any stored
    // attendee row for a person who is on the invitation but not on this
    // event's guest list. Documents the current (surprising) behavior rather
    // than asserting it is desired — see the PR review.
    await db()
      .delete(schema.guestEvents)
      .where(eq(schema.guestEvents.id, 'ge-g-alex'));

    asAdmin();

    await setPartyEventRsvp({
      eventId: EVENT_ID,
      guestId: 'g-alice',
      expectedUpdatedAt: await partyToken('g-alice'),
      statuses: [{ guestId: 'g-alice', attending: true }],
    });

    const responses = await storedResponses();

    expect(responses).toHaveLength(1);
    // Alex was never named in `statuses` (he is not invited to this event)
    // yet his previously-stored attendee row is gone along with the rewrite.
    expect(responses[0].attendeeNames).toEqual(['Alice Alpha']);
  });
});
