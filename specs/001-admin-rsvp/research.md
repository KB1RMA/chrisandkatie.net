# Research: Admin RSVP Management

**Date**: February 26, 2026  
**Branch**: `001-admin-rsvp`  
**Purpose**: Resolve all NEEDS CLARIFICATION items from Technical Context before Phase 1 design

---

## Decision 1 — Admin Identity Storage

**Question**: Where and how is admin status stored? The spec says admin credentials live in env vars with a role on the session token, but the current `users` table and `JWT` type have no such field.

**Decision**: Add `roles?: string[]` to the `Session`, `User`, and `JWT` type extensions in `src/lib/auth.ts`. During `authorize()`, add a second credential check: if the submitted username and password match `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars, return a user object with `roles: ['admin']` and no `guestId`. No `users` DB record is created or looked up for admin logins — the admin identity is entirely token-based. Using an array (rather than a boolean flag) allows future roles (e.g., `'planner'`) to be added without a type change.

**Rationale**: This avoids any DB table for admin users, matches the spec's intent (two hardcoded admins, credentials in env), and keeps auth entirely within the existing NextAuth Credentials provider. The env vars approach means admin credentials can be rotated without a DB migration.

**Alternatives considered**:
- Add `isAdmin` column to the `User` DB table → rejected: unnecessary DB coupling for two users who never need individual records
- Use `isAdmin: boolean` instead of roles array → rejected: boolean flags don't compose; a `roles` array costs nothing extra and avoids a future type change
- Separate `/admin/login` form outside NextAuth → rejected: duplicates auth infrastructure

---

## Decision 2 — RSVP Data Source for Dashboard and Guest List

**Question**: The schema has two RSVP tracking mechanisms: `guests.attending` / `guests.mealChoice` (simple boolean on the guest row) and `rsvpResponses` / `attendees` (detailed per-event table). Which is canonical for the admin dashboard?

**Decision**: Use `rsvpResponses` + `attendees` as the canonical data source for all admin views. The `rsvpResponses` table has per-event granularity via `eventId`, an `attendanceStatus` enum (`attending` / `not_attending`), and a link to `attendees` rows with per-person `mealOption`. This is the detailed RSVP system; `guests.attending` / `guests.mealChoice` are legacy simple fields from an earlier schema iteration.

**"No response" calculation**: A guest has not responded to an event when they have a row in `guestEvents` (they are invited) but no corresponding row in `rsvpResponses` for that event.

**Rationale**: `rsvpResponses` is event-scoped, which is required to answer per-event dashboard questions. The `attendees` table holds the meal option breakdowns needed for FR-003.

**Alternatives considered**:
- Use `guests.attending` for wedding headcount → rejected: doesn't support per-event breakdown and is inconsistently populated

---

## Decision 3 — Guest List Search and Filtering (P2)

**Question**: Should guest name search and status/event filters be implemented server-side (new query params) or client-side (filter over pre-fetched data)?

**Decision**: Client-side filtering over server-fetched data. The guest list will never exceed ~200 rows. The page fetches all guests with their RSVP statuses in one Drizzle query on the server; the client `GuestTable` component (already the pattern for `AdminGuestsPage`) handles filtering via local React state. This matches the existing `GuestTable` / `InvitationTable` pattern.

**Rationale**: Avoids introducing URL query param handling, keeps the page consistent with existing admin pages, and is more than sufficient for 200 records.

**Alternatives considered**:
- Server-side filtering via `?status=&event=` search params → rejected: unnecessary complexity for dataset of this size

---

## Decision 4 — RSVP Edit Server Actions (P3)

**Question**: How should admin RSVP edits be submitted? The spec requires updating `attendanceStatus`, attendee details, and per-event responses on behalf of a guest.

**Decision**: Use Next.js Server Actions (`'use server'`) defined in `src/app/admin/rsvp/actions.ts`. Each action will:
1. Call `auth()` and verify `session?.user?.roles?.includes('admin') === true` — any attempt without the admin role throws immediately
2. Perform the Drizzle mutation
3. Call `revalidatePath('/admin/rsvp')` to invalidate the dashboard

The cascade confirmation (when marking wedding RSVP as "not attending") will be handled client-side: the form component shows a confirmation modal, and if confirmed, calls a `cascadeRsvpNotAttending(guestId)` server action that updates the wedding `rsvpResponse` and all per-event `rsvpResponses` for that guest in a single transaction.

**Rationale**: Server Actions are the idiomatic Next.js App Router pattern for form mutations. Defining them in a co-located `actions.ts` matches `src/app/admin/invitations/actions.ts` (existing pattern).

**Alternatives considered**:
- API route (`/api/admin/rsvp`) → rejected: Server Actions are preferred in App Router and already used in the codebase

---

## Decision 5 — Security Fix: Existing Admin Auth Check

**Question**: The existing admin pages (`/admin/guests`, `/admin/invitations`) check `if (!session?.user?.guestId)` — this allows any logged-in guest to access admin. This must be fixed as part of this feature.

**Decision**: Update the auth guard in both existing admin pages and all new admin pages to check `if (!session?.user?.roles?.includes('admin'))`. This is a breaking security fix bundled with the feature. The existing pages will be updated as part of the implementation scope.

**Rationale**: FR-014 requires that admin pages are inaccessible to guest-authenticated users. The current check is insufficient.

---

## Technical Summary

| Unknown | Resolution |
|---------|------------|
| `roles` storage | JWT token only; set during `authorize()` via `ADMIN_USERNAME`/`ADMIN_PASSWORD` env vars as `roles: ['admin']` |
| RSVP data source | `rsvpResponses` + `attendees` tables (canonical); `guests.attending` legacy field not used |
| "No response" calculation | Guests in `guestEvents` with no matching `rsvpResponses` row for that event |
| Guest list filtering | Client-side in the table component (dataset ≤200 rows) |
| RSVP edit mutations | Server Actions in `src/app/admin/rsvp/actions.ts` |
| Auth type extensions | `roles?: string[]` added to `Session`, `User`, `JWT` interfaces in `auth.ts` |
| Existing admin auth bug | Fix `?guestId` guard → `roles?.includes('admin')` guard in all admin pages (bundled scope) |
| Cascade confirmation | Client-side modal triggers `cascadeRsvpNotAttending()` server action |
