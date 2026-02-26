# Data Model: Wedding RSVP Portal

**Date**: February 26, 2026  
**Branch**: `001-wedding-rsvp-portal`  
**Location**: `src/lib/db/schema.ts` (Drizzle ORM)

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐
│   invitation    │
└────────┬────────┘
         │ 1:N
         │
      ┌──┴──┐
      │     │
   ┌──┴──┐ ┌─────────────┐
   │guest│ │ guest_event │ (junction table for M:N)
   └──┬──┘ └──────┬──────┘
      │           │
      │        ┌──┴──────────────────┐
      │        │                     │
      ├────────┤                        │
      │    ┌───┴────────────┐    ┌──────┴──┐
      │    │  rsvp_response │    │  event  │
      │    └────────┬───────┘    └─────────┘
      │             │
      └─────────────┤
                 1:N
                    │
              ┌─────┴────────┐
              │   attendee   │
              └──────────────┘
```

---

## Core Entities

### 1. `guest`

Represents an individual person on the invitation list.

```typescript
// Drizzle schema
export const guest = sqliteTable('guest', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  invitationId: integer('invitation_id').notNull().references(() => invitation.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Unique constraint: no duplicate guests per invitation
export const guestConstraint = unique('guest_unique').on(guest.firstName, guest.lastName, guest.invitationId);
```

**Attributes**:
- `id`: Auto-incrementing primary key
- `firstName`: Guest's first name as it appears on invitation (required)
- `lastName`: Guest's last name as it appears on invitation (required)
- `invitationId`: Foreign key to `invitation` (required)
- `createdAt`: System timestamp (auto-generated)
- `updatedAt`: System timestamp (auto-updated on changes)

**Cardinality**: 1 invitation → many guests (e.g., couple on one invitation, multiple family members on another)

**Queries**:
```typescript
// Authenticate guest
SELECT id, firstName, lastName FROM guest 
WHERE firstName = $1 AND lastName = $2 AND invitationId IN (
  SELECT id FROM invitation WHERE eventIds CONTAINS $3
)

// Fetch all guests on an invitation
SELECT id, firstName, lastName FROM guest 
WHERE invitationId = $1 
ORDER BY firstName, lastName
```

---

### 2. `invitation`

Represents a single invitation unit (sent to individual, couple, or family).

```typescript
export const invitation = sqliteTable('invitation', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  maxGuests: integer('max_guests').notNull(),
  notes: text('notes'), // e.g., "Plus one for John", "Smith Family"
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});
```

**Attributes**:
- `id`: Primary key
- `maxGuests`: Total number of guests invited (including primary + plus-ones)
- `notes`: Optional text (couple notes about invitation context)
- `createdAt`, `updatedAt`: Timestamps

**Cardinality**: Used to group guests (e.g., "Smith Family" invitation contains 4 guests)

**Validation**:
- `maxGuests` ≥ 1 (minimum one invited guest)
- Must have at least one associated `guest` record

---

### 3. `event`

Represents a scheduled wedding-related event.

```typescript
export const event = sqliteTable('event', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(), // e.g., "Main Wedding Ceremony"
  description: text('description'),
  location: text('location'),
  eventDate: text('event_date').notNull(), // ISO 8601 datetime
  eventTime: text('event_time').notNull(), // HH:MM format
  duration: integer('duration'), // in minutes, e.g., 60
  type: text('type', { enum: ['main', 'rehearsal', 'brunch', 'other'] }).notNull().default('main'),
  dressCode: text('dress_code'),
  parkingInfo: text('parking_info'),
  sortOrder: integer('sort_order').notNull().default(0), // for ordering in UI
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});
```

**Attributes**:
- `id`: Primary key
- `name`: Event title (required, e.g., "Wedding Ceremony")
- `description`: Event details/agenda
- `location`: Venue/address
- `eventDate`: ISO 8601 date (required, e.g., "2026-06-27")
- `eventTime`: Time in HH:MM format (required, e.g., "18:00")
- `duration`: Event length in minutes (optional, e.g., 120 for reception)
- `type`: Enum categorizing event (main, rehearsal, brunch, other)
- `dressCode`: Attire guidance (e.g., "Black tie optional")
- `parkingInfo`: Parking instructions
- `sortOrder`: Position in schedule display (for UI ordering)
- `createdAt`, `updatedAt`: Timestamps

**Validation**:
- `eventDate` must be valid ISO 8601 and after "today"
- `eventTime` must be valid 24-hour format

---

### 4. `guest_event` (Junction Table)

Links guests to events they're invited to (M:N relationship).

```typescript
export const guestEvent = sqliteTable('guest_event', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  guestId: integer('guest_id').notNull().references(() => guest.id, { onDelete: 'cascade' }),
  eventId: integer('event_id').notNull().references(() => event.id, { onDelete: 'cascade' }),
});

// Ensure no duplicate guest-event pairs
export const guestEventConstraint = unique('guest_event_unique').on(
  guestEvent.guestId,
  guestEvent.eventId
);
```

**Purpose**: Defines which guests are invited to which events (e.g., not all guests invited to rehearsal dinner).

**Queries**:
```typescript
// Fetch events for a guest
SELECT e.* FROM event e
INNER JOIN guest_event ge ON e.id = ge.eventId
WHERE ge.guestId = $1
ORDER BY e.eventDate, e.eventTime

// Fetch guests invited to an event
SELECT g.* FROM guest g
INNER JOIN guest_event ge ON g.id = ge.guestId
WHERE ge.eventId = $1
ORDER BY g.firstName
```

---

### 5. `rsvp_response`

Represents a guest's RSVP for a specific event.

```typescript
export const rsvpResponse = sqliteTable('rsvp_response', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  guestId: integer('guest_id').notNull().references(() => guest.id, { onDelete: 'cascade' }),
  eventId: integer('event_id').notNull().references(() => event.id, { onDelete: 'cascade' }),
  attendanceStatus: text('attendance_status', { enum: ['attending', 'not_attending'] }).notNull(),
  numberOfAttending: integer('number_attending').notNull().default(0),
  specialRequests: text('special_requests'),
  submittedAt: text('submitted_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// One RSVP per guest per event
export const rsvpConstraint = unique('rsvp_unique').on(
  rsvpResponse.guestId,
  rsvpResponse.eventId
);
```

**Attributes**:
- `id`: Primary key
- `guestId`: Foreign key (guest who submitted RSVP)
- `eventId`: Foreign key (event being RSVP'd for)
- `attendanceStatus`: "attending" or "not_attending" (required)
- `numberOfAttending`: Count of attendees (0 if not attending)
- `specialRequests`: Optional notes/requests from guest
- `submittedAt`: First submission timestamp
- `updatedAt`: Last modification timestamp

**Validation**:
- If `attendanceStatus` = "not_attending", then `numberOfAttending` = 0
- If `attendanceStatus` = "attending", then `numberOfAttending` > 0
- `numberOfAttending` ≤ total guests invited on that invitation
- One RSVP response per guest-event combination (upsert pattern on subsequent submissions)

**Queries**:
```typescript
// Upsert RSVP (create or update)
INSERT INTO rsvp_response (guestId, eventId, attendanceStatus, numberOfAttending, specialRequests)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT(guestId, eventId) DO UPDATE SET
  attendanceStatus = $3,
  numberOfAttending = $4,
  specialRequests = $5,
  updatedAt = CURRENT_TIMESTAMP;

// Retrieve guest's RSVP for an event
SELECT * FROM rsvp_response
WHERE guestId = $1 AND eventId = $2

// Check if deadline passed
SELECT MAX(updatedAt) FROM rsvp_response
WHERE eventId = $1 AND updatedAt < '2026-06-15T23:59:59Z'
```

---

### 6. `attendee`

Represents an individual person attending an event (part of a guest's party).

```typescript
export const attendee = sqliteTable('attendee', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  rsvpResponseId: integer('rsvp_response_id').notNull().references(() => rsvpResponse.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // Pre-registered guest name or primary guest name
  mealOption: text('meal_option', { enum: ['option_a', 'option_b'] }).notNull(),
  dietaryRestrictions: text('dietary_restrictions'), // Free-form text: allergies, etc.
  sortOrder: integer('sort_order').notNull().default(0), // Order in list (primary guest first)
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});
```

**Attributes**:
- `id`: Primary key
- `rsvpResponseId`: Foreign key to RSVP response
- `name`: Full name of attendee (must match pre-registered guest name from `guest` table)
- `mealOption`: Select from two predefined meal options (option_a, option_b)
- `dietaryRestrictions`: Free-form text (allergies, cultural restrictions, vegan, etc.)
- `sortOrder`: Position in party (0 = primary, 1+ = plus-ones)
- `createdAt`: Timestamp

**Validation**:
- `name` must exactly match a pre-registered guest name on the invitation
- `mealOption` must be one of the two valid options
- Number of attendees ≤ `invitation.maxGuests`

**Queries**:
```typescript
// Fetch all attendees for an RSVP
SELECT * FROM attendee
WHERE rsvpResponseId = $1
ORDER BY sortOrder

// Get meal count for catering
SELECT mealOption, COUNT(*) as count FROM attendee
WHERE rsvpResponseId IN (
  SELECT id FROM rsvp_response WHERE eventId = $1
)
GROUP BY mealOption

// List all dietary restrictions for an event
SELECT DISTINCT dietaryRestrictions FROM attendee
WHERE rsvpResponseId IN (
  SELECT id FROM rsvp_response WHERE eventId = $1 AND dietaryRestrictions IS NOT NULL
)
```

---

### 7. `photo` (Gallery)

Represents a photo in the relationship photo gallery.

```typescript
export const photo = sqliteTable('photo', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  imageUrl: text('image_url').notNull(), // Cloudflare Image or storage URL
  caption: text('caption'),
  description: text('description'),
  dateTaken: text('date_taken'), // ISO 8601 date
  milestone: text('milestone'), // e.g., "First date", "Engagement", "Wedding day"
  album: text('album'), // Grouping for filtering
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});
```

**Attributes**:
- `id`: Primary key
- `imageUrl`: URL to optimized image (Cloudflare Media or similar)
- `caption`: Short caption shown with photo
- `description`: Longer description/story
- `dateTaken`: Date photo was taken (for chronological sorting)
- `milestone`: Tag for relationship milestone (optional grouping)
- `album`: Album/category name (e.g., "Early Days", "Engagement", "Pre-Wedding")
- `sortOrder`: Display order within album
- `createdAt`: Upload timestamp

**Queries**:
```typescript
// Fetch all photos for gallery
SELECT * FROM photo
ORDER BY COALESCE(dateTaken, createdAt) DESC

// Fetch photos by album
SELECT * FROM photo
WHERE album = $1
ORDER BY sortOrder, dateTaken DESC

// Fetch available albums
SELECT DISTINCT album FROM photo
WHERE album IS NOT NULL
ORDER BY album
```

---

## Key Relationships & Constraints

| Constraint | Reason |
|-----------|--------|
| Guest → Invitation (N:1) | Multiple guests per invitation; cascade delete ensures data consistency |
| Guest → Event (M:N via junction) | Guests can attend multiple events; not all guests invited to all events |
| Guest → RSVP (1:N) | One guest can have multiple RSVPs (one per event) |
| RSVP → Attendee (1:N) | One RSVP contains multiple attendees (primary + guests from party) |
| Attendee.name must match pre-registered Guest.firstName + Guest.lastName | Prevents typos; ensures data reconciliation |

---

## Computed Fields & Aggregations

These are not stored but computed during queries:

```typescript
// Total head count for main wedding
SELECT COUNT(*) as totalAttending FROM attendee a
INNER JOIN rsvp_response r ON a.rsvpResponseId = r.id
INNER JOIN event e ON r.eventId = e.id
WHERE e.type = 'main' AND r.attendanceStatus = 'attending'

// Meal breakdown for catering
SELECT 
  mealOption,
  COUNT(*) as count,
  COUNT(*) * COALESCE(mealCost, 0) as estimatedCost
FROM attendee
WHERE rsvpResponseId IN (
  SELECT id FROM rsvp_response WHERE eventId = $1
)
GROUP BY mealOption

// Unanswered RSVPs (for admin)
SELECT COUNT(*) as unansweredCount FROM guest g
WHERE NOT EXISTS (
  SELECT 1 FROM rsvp_response r WHERE r.guestId = g.id AND r.eventId = $1
)
```

---

## Migration Path

Initial migration (v1):
1. Create `invitation`, `guest` with test data
2. Create `event` with schedule data
3. Create `guest_event` junction table with permissions
4. Create `rsvp_response`, `attendee` (initially empty until RSVPs arrive)
5. Create `photo` with gallery data

No schema changes anticipated during implementation (schema is stable based on spec).

---

## Drizzle Integration Points

**In `src/lib/db/schema.ts`**:
```typescript
import { sqliteTable, integer, text, unique, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// [All entities above defined here]

// Export for use in queries
export type Guest = typeof guest.$inferSelect;
export type Invitation = typeof invitation.$inferSelect;
export type Event = typeof event.$inferSelect;
export type RsvpResponse = typeof rsvpResponse.$inferSelect;
export type Attendee = typeof attendee.$inferSelect;
export type Photo = typeof photo.$inferSelect;
```

**Indexes for performance**:
```typescript
export const guestIndexInvitation = index('guest_idx_invitation').on(guest.invitationId);
export const guestEventIndexGuest = index('guest_event_idx_guest').on(guestEvent.guestId);
export const guestEventIndexEvent = index('guest_event_idx_event').on(guestEvent.eventId);
export const rsvpIndexGuest = index('rsvp_idx_guest').on(rsvpResponse.guestId);
export const rsvpIndexEvent = index('rsvp_idx_event').on(rsvpResponse.eventId);
export const attendeeIndexRsvp = index('attendee_idx_rsvp').on(attendee.rsvpResponseId);
export const photoIndexAlbum = index('photo_idx_album').on(photo.album);
```

