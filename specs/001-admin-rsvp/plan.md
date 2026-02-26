# Implementation Plan: Admin RSVP Management

**Branch**: `001-admin-rsvp` | **Date**: February 26, 2026 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/001-admin-rsvp/spec.md`

## Summary

Add a protected admin area that gives the couple a real-time RSVP dashboard, a searchable/filterable guest list, per-event attendance drill-downs, and the ability to update any guest's RSVP on their behalf. Admin authentication extends the existing NextAuth Credentials provider with `roles: ['admin']` in the JWT — no new DB tables. All new pages follow the established `/admin/*` server component pattern and extend the existing `AdminTabs` navigation. As a bundled security fix, the existing admin pages' auth guard is updated from the incorrect `guestId` check to a proper `roles.includes('admin')` check.

## Technical Context

**Language/Version**: TypeScript 5 / Next.js 16 App Router / React 19  
**Primary Dependencies**: NextAuth v5, Drizzle ORM, Tailwind CSS, Vitest, Zod  
**Storage**: Cloudflare D1 (SQLite) via Drizzle — no new tables or migrations  
**Testing**: Vitest (unit tests for server actions and auth helpers)  
**Target Platform**: Cloudflare Workers via OpenNext  
**Project Type**: Web application (admin feature within existing Next.js app)  
**Performance Goals**: Admin-only tool; two users; no throughput requirements  
**Constraints**: Cloudflare D1 edge runtime; `force-dynamic` on all admin pages; no client-side DB access  
**Scale/Scope**: 2 admin users; ~200 guests; ~10 events

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- ✅ **Framework-Led Delivery**: All new pages use Next.js App Router server components, `export const dynamic = 'force-dynamic'`, and `auth()` from NextAuth v5. No custom routing or middleware introduced.
- ✅ **Functional Core First**: Server actions and query helpers are pure functions. Mutations isolated to `actions.ts`. Dashboard aggregation is a declarative Drizzle query.
- ✅ **Specification-First Delivery**: All implementation work traces to `spec.md` FRs and user story acceptance scenarios.
- ✅ **Simplicity and Rule of Three**: No new abstractions introduced. New pages extend, not wrap, existing `AdminTabs` + server component pattern. Rule of Three not violated — no premature shared utilities.
- ✅ **Quality Gates**: TypeScript strict, ESLint, Prettier must pass. Vitest unit tests required for: (1) admin `authorize()` credential path in `auth.ts`, and (2) all three server actions in `src/app/admin/rsvp/actions.ts` — auth guard, `updateRsvpAttendance`, `cascadeRsvpNotAttending`, `updateAttendeeDetails`. See **Test Plan** below.

*Post-design re-check (Phase 1)*: ✅ All checks still pass. No new abstractions introduced by data model or contracts.

## Project Structure

### Documentation (this feature)

```text
specs/001-admin-rsvp/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── server-actions.md   ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks - not yet created)
```

### Source Code

```text
src/
├── lib/
│   └── auth.ts                          MODIFY — add roles?: string[] to Session/User/JWT types + authorize() admin path
│   └── auth.test.ts                     MODIFY — add describe block for admin credential path
│
├── app/
│   └── admin/
│       ├── invitations/
│       │   └── page.tsx                 MODIFY — fix auth guard: guestId → roles.includes('admin')
│       ├── guests/
│       │   ├── page.tsx                 MODIFY — fix auth guard + add search/filter props to GuestTable
│       │   └── [guestId]/
│       │       ├── page.tsx             NEW — guest RSVP detail view (P2 click-through / P3 read)
│       │       └── edit/
│       │           └── page.tsx         NEW — admin RSVP edit form (P3)
│       └── rsvp/
│           ├── page.tsx                 NEW — RSVP summary dashboard (P1)
│           ├── actions.ts               NEW — server actions: updateRsvpAttendance, cascadeRsvpNotAttending, updateAttendeeDetails
│           ├── actions.test.ts          NEW — unit tests for all three server actions
│           └── [eventId]/
│               └── page.tsx             NEW — per-event RSVP detail (P4)
│
└── components/
    └── admin/
        ├── AdminTabs.tsx                MODIFY — add 'RSVPs' tab entry
        ├── GuestTable.tsx               MODIFY — add client-side name search + status/event filter
        ├── RsvpDashboard.tsx            NEW — P1 dashboard: event summary cards + meal breakdown
        ├── EventSummaryCard.tsx         NEW — single event headcount card for dashboard
        ├── EventRsvpTable.tsx           NEW — P4 per-event guest list with status column
        └── GuestRsvpDetail.tsx          NEW — P3 guest detail + inline edit form with cascade modal
```

**Structure Decision**: Single Next.js App Router project (existing). New files slot into the established `/admin/*` route tree and `src/components/admin/` component directory. No new packages, directories outside `src/`, or build changes.

## Complexity Tracking

No constitution violations. All gates pass. No justification table required.

## Test Plan

### Conventions

All test files follow the project's established Vitest conventions:

- Co-located with the source file they test (`auth.test.ts` next to `auth.ts`, `actions.test.ts` next to `actions.ts`)
- `/** @vitest-environment node */` docblock at the top of every server-only test file
- `vi.mock('@/lib/auth')` and `vi.mock('@/lib/db')` declared before imports
- `import { expect, test, describe, beforeEach, vi } from 'vitest'` — globals imported explicitly
- `beforeEach(() => { vi.clearAllMocks(); })` in every `describe` block
- Test names start with `'should'`
- No mocking of units under test; mock only external dependencies (`auth`, `getDb`)

---

### `src/lib/auth.test.ts` — admin credential path

Adds a new `describe` block to the existing (or new) auth test file covering the admin branch of `authorize()`.

```text
describe('createAuth - admin credentials')
  should return a user with roles: ["admin"] when credentials match ADMIN_USERNAME and ADMIN_PASSWORD env vars
  should not return an admin user when ADMIN_USERNAME env var is not set
  should fall through to guest name lookup when credentials do not match admin env vars
  should not attach guestId to the returned user when credentials match admin env vars
```

**Mocks needed**: `getDb` (to assert it is not called during admin auth path); env vars set via `vi.stubEnv()`.

---

### `src/app/admin/rsvp/actions.test.ts` — server actions

New file. Three `describe` blocks, one per exported server action.

#### `describe('updateRsvpAttendance')`

```text
  should throw Unauthorized when session is null
  should throw Unauthorized when session roles array does not include "admin"
  should create a new RsvpResponse row when none exists for the guestId/eventId pair
  should update attendanceStatus on an existing RsvpResponse
  should return { success: false } when the guest does not exist
  should return { success: false } when the guest is not invited to the event (no GuestEvent row)
```

#### `describe('cascadeRsvpNotAttending')`

```text
  should throw Unauthorized when session lacks admin role
  should update only the main wedding RsvpResponse when cascadeToEvents is false
  should update the wedding RsvpResponse and all per-event RsvpResponses when cascadeToEvents is true
  should run cascade updates in a single database transaction
  should return { success: false } when the guest does not exist
```

#### `describe('updateAttendeeDetails')`

```text
  should throw Unauthorized when session lacks admin role
  should delete all existing Attendee rows for the rsvpResponseId before reinserting
  should insert the provided attendees list with correct field values
  should update rsvpResponse.updatedAt on success
  should return { success: false } when rsvpResponseId does not exist
```

**Mocks needed**: `vi.mock('@/lib/auth')` returning configurable sessions; `vi.mock('@/lib/db')` returning a `createMockDb` helper (following the pattern in `src/app/rsvp/actions.test.ts`).
