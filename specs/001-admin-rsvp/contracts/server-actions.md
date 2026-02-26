# Server Action Contracts: Admin RSVP Management

**Date**: February 26, 2026  
**Branch**: `001-admin-rsvp`  
**Location**: `src/app/admin/rsvp/actions.ts`

The admin RSVP feature exposes server-side mutations via Next.js Server Actions. All actions share the same security contract: they verify that the session's `roles` array includes `'admin'` before performing any mutation, and throw (or return an error) immediately if the check fails.

---

## Shared Security Contract

Every action in `src/app/admin/rsvp/actions.ts` MUST begin with:

```typescript
const session = await auth();

if (!(session?.user?.roles ?? []).includes('admin')) {
  throw new Error('Unauthorized');
}
```

No mutation proceeds without a verified admin session.

---

## `updateRsvpAttendance`

Updates a guest's `attendanceStatus` for a specific event.

**Signature**:
```typescript
async function updateRsvpAttendance(input: {
  guestId: string;
  eventId: string;
  attendanceStatus: 'attending' | 'not_attending';
}): Promise<{ success: true } | { success: false; error: string }>
```

**Behavior**:
- If an `RsvpResponse` row exists for `(guestId, eventId)`, updates `attendanceStatus` and `updatedAt`
- If no row exists, creates a new `RsvpResponse` row with `numberOfAttending: 0`
- Calls `revalidatePath('/admin/rsvp')` on success

**Validation**:
- `guestId` must reference an existing `Guest`
- `eventId` must reference an existing `Event`
- Guest must have a corresponding `GuestEvent` row (i.e., is invited to this event)

---

## `cascadeRsvpNotAttending`

Sets a guest's wedding RSVP to "not attending" and optionally cascades to all per-event RSVPs.

**Signature**:
```typescript
async function cascadeRsvpNotAttending(input: {
  guestId: string;
  cascadeToEvents: boolean;
}): Promise<{ success: true } | { success: false; error: string }>
```

**Behavior when `cascadeToEvents: false`**:
- Updates only the `RsvpResponse` for the main wedding event (`type === 'main'`) to `not_attending`

**Behavior when `cascadeToEvents: true`**:
- Updates the wedding `RsvpResponse` to `not_attending`
- Updates **all other** `RsvpResponse` rows for this guest to `not_attending`
- All updates run in a single Drizzle transaction
- Calls `revalidatePath('/admin/rsvp')` on success

---

## `updateAttendeeDetails`

Updates the attendees list within an existing RSVP response (meal choices, dietary restrictions).

**Signature**:
```typescript
async function updateAttendeeDetails(input: {
  rsvpResponseId: string;
  attendees: Array<{
    id: string;            // existing attendee id, or omit for new row
    name: string;
    mealOption: 'option_a' | 'option_b';
    dietaryRestrictions?: string;
  }>;
}): Promise<{ success: true } | { success: false; error: string }>
```

**Behavior**:
- Deletes all existing `Attendee` rows for `rsvpResponseId`
- Re-inserts the provided list (assign new UUIDs for new entries)
- Updates `rsvpResponses.updatedAt`
- Calls `revalidatePath('/admin/rsvp')` on success

**Rationale for delete-and-reinsert**: The attendee list is always submitted as a complete replacement, matching the guest-facing RSVP form behavior.

---

## Return Shape Convention

All actions return a discriminated union:

```typescript
type ActionResult =
  | { success: true }
  | { success: false; error: string };
```

The calling component checks `result.success` and surfaces `result.error` in the UI when `false`.
