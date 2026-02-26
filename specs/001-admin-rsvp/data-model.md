# Data Model: Admin RSVP Management

**Date**: February 26, 2026  
**Branch**: `001-admin-rsvp`

---

## Schema Changes

No new database tables are required. This feature adds:

1. **TypeScript type extensions** in `src/lib/auth.ts`
2. **No migration required** — admin identity is token-only (env vars)

---

## Auth Type Extensions

`src/lib/auth.ts` — extend the three existing module augmentations:

```typescript
declare module 'next-auth' {
  interface Session {
    user: {
      guestId?: string;
      firstName?: string;
      roles?: string[];          // NEW — e.g. ['admin']
    } & DefaultSession['user'];
  }

  interface User {
    guestId?: string;
    firstName?: string;
    roles?: string[];            // NEW
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    guestId?: string;
    firstName?: string;
    roles?: string[];            // NEW
  }
}
```

The `authorize()` callback in the Credentials provider is extended with a second credential path:

```typescript
// NEW: Admin credential check (runs before guest lookup)
const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;

if (
  adminUsername &&
  adminPassword &&
  credentials.firstName === adminUsername &&
  credentials.lastName === adminPassword
) {
  return {
    id: 'admin',
    name: 'Admin',
    email: null,
    roles: ['admin'],
  };
}

// existing guest lookup continues below...
```

The `jwt` and `session` callbacks gain symmetric handling for `roles`:

```typescript
async jwt({ token, user }) {
  if (user?.roles) {
    token.roles = user.roles;
  }
  // ...existing guestId/firstName handling
}

async session({ session, token }) {
  if (token.roles && session.user) {
    session.user.roles = token.roles as string[];
  }
  // ...existing guestId/firstName handling
}
```

Admin guard helper pattern used in every admin page:

```typescript
const isAdmin = (session?.user?.roles ?? []).includes('admin');

if (!isAdmin) {
  redirect('/login?callbackUrl=/admin/...');
}
```

---

## Existing Tables Used (Read/Write)

### `RsvpResponse` — canonical RSVP data

| Field | Type | Notes |
|-------|------|-------|
| `id` | `text` PK | |
| `guestId` | `text` FK → `Guest` | |
| `eventId` | `text` FK → `Event` | |
| `attendanceStatus` | `'attending' \| 'not_attending'` | Source of truth for headcounts |
| `numberOfAttending` | `integer` | Party size |
| `specialRequests` | `text?` | |
| `submittedAt` | `text` | ISO timestamp |
| `updatedAt` | `text` | ISO timestamp |

**Dashboard query**: group by `eventId` + `attendanceStatus`, count rows.  
**"No response"**: guests in `GuestEvent` with no `RsvpResponse` row for that event.

### `Attendee` — per-person meal detail within an RSVP

| Field | Type | Notes |
|-------|------|-------|
| `id` | `text` PK | |
| `rsvpResponseId` | `text` FK → `RsvpResponse` | |
| `name` | `text` | |
| `mealOption` | `'option_a' \| 'option_b'` | Dashboard meal breakdown source |
| `dietaryRestrictions` | `text?` | |
| `sortOrder` | `integer` | |

**Meal breakdown query**: join `Attendee` → `RsvpResponse` → `Event`, filter to attending responses, count by `mealOption`.

### `Event` — the wedding and additional events

| Field | Type | Notes |
|-------|------|-------|
| `id` | `text` PK | |
| `name` | `text` | Display name |
| `type` | `'main' \| 'rehearsal' \| 'brunch' \| 'other'` | `type === 'main'` identifies the wedding |
| `sortOrder` | `integer` | Dashboard card order |

### `GuestEvent` — invitation list per event

Used to calculate "total invited" per event and to derive "no response" (guests in `GuestEvent` with no `RsvpResponse`).

### `Guest` — guest master record

| Field | Type | Notes |
|-------|------|-------|
| `id` | `text` PK | |
| `firstName` | `text` | |
| `lastName` | `text` | |
| `invitationId` | `text` | |
| `attending` | `boolean?` | Legacy field — **not used** by admin dashboard |
| `mealChoice` | `text?` | Legacy field — **not used** by admin dashboard |

---

## Key Query Patterns

### Dashboard summary per event

```typescript
// Pseudocode — implemented in the admin page server component
const summaryByEvent = await db
  .select({
    eventId: rsvpResponses.eventId,
    status: rsvpResponses.attendanceStatus,
    count: sql<number>`count(*)`,
  })
  .from(rsvpResponses)
  .groupBy(rsvpResponses.eventId, rsvpResponses.attendanceStatus);

// "No response" = total invited (from guestEvents) − responded (from rsvpResponses)
```

### Meal option breakdown

```typescript
const mealBreakdown = await db
  .select({
    mealOption: attendees.mealOption,
    count: sql<number>`count(*)`,
  })
  .from(attendees)
  .innerJoin(rsvpResponses, eq(attendees.rsvpResponseId, rsvpResponses.id))
  .where(eq(rsvpResponses.attendanceStatus, 'attending'))
  .groupBy(attendees.mealOption);
```

### Guest RSVP detail (for edit view)

```typescript
const guestDetail = await db.query.guests.findFirst({
  where: eq(guests.id, guestId),
  with: {
    rsvpResponses: {
      with: { attendees: true, event: true },
    },
    guestEvents: {
      with: { event: true },
    },
  },
});
```

---

## Environment Variables (New)

| Variable | Purpose |
|----------|---------|
| `ADMIN_USERNAME` | Admin login identifier (used as "first name" field in the existing credential form) |
| `ADMIN_PASSWORD` | Admin login secret (used as "last name" field in the existing credential form) |

These are added to `.dev.vars` (local) and Cloudflare Workers secrets (production).
