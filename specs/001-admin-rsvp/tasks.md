# Tasks: Admin RSVP Management

**Input**: Design documents from `/specs/001-admin-rsvp/`  
**Branch**: `001-admin-rsvp`  
**Date**: February 26, 2026

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel with other tasks in the same phase (different files, no incomplete dependencies)
- **[Story]**: User story this task belongs to (US1–US4)
- Exact file paths included in every task description

---

## Phase 1: Setup

**Purpose**: Environment configuration needed before implementing the admin credential path

- [ ] T001 Add `ADMIN_USERNAME` and `ADMIN_PASSWORD` placeholder entries to `.dev.vars.example` with comments explaining they are used as First Name / Last Name in the existing login form

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core auth extension and security fixes that MUST be complete before any user story can be tested end-to-end

**⚠️ CRITICAL**: No user story work can produce a working admin session until T002 is complete. T003–T006 are all unblocked in parallel once T002 is done.

- [ ] T002 Extend `Session`, `User`, and `JWT` TypeScript interfaces with `roles?: string[]`; add admin credential branch to `authorize()` that returns `{ id: 'admin', name: 'Admin', roles: ['admin'] }` when credentials match `ADMIN_USERNAME`/`ADMIN_PASSWORD` env vars; add symmetric `roles` propagation to `jwt` and `session` callbacks in `src/lib/auth.ts`
- [ ] T003 [P] Fix auth guard in `src/app/admin/invitations/page.tsx` — replace `if (!session?.user?.guestId)` with `if (!(session?.user?.roles ?? []).includes('admin'))`
- [ ] T004 [P] Fix auth guard in `src/app/admin/guests/page.tsx` — replace `if (!session?.user?.guestId)` with `if (!(session?.user?.roles ?? []).includes('admin'))`
- [ ] T005 [P] Add `{ href: '/admin/rsvp', label: 'RSVPs' }` entry to the `adminTabs` array in `src/components/admin/AdminTabs.tsx`
- [ ] T006 [P] Write `describe('createAuth - admin credentials')` block in `src/lib/auth.test.ts` covering: returns `roles: ['admin']` on matching env vars; returns `null` when env vars are not set; falls through to guest lookup when credentials do not match; `guestId` is not set on admin token — verify all tests pass

**Checkpoint**: Admin login returns a session with `roles: ['admin']`; `/admin/invitations` and `/admin/guests` reject guest-authenticated sessions; RSVPs tab renders in `AdminTabs`

---

## Phase 3: User Story 1 — View RSVP Summary Dashboard (Priority: P1) 🎯 MVP

**Goal**: Admin logs in and immediately sees attending/not-attending/no-response counts for the wedding and each additional event, plus a meal preference breakdown

**Independent Test**: Log in as admin, navigate to `/admin/rsvp`, confirm headcounts match the database and all counts show as zero with "No RSVPs received yet" when no data exists

### Implementation for User Story 1

- [ ] T007 [P] [US1] Implement `EventSummaryCard` component in `src/components/admin/EventSummaryCard.tsx` — accepts `eventName`, `attending`, `notAttending`, `noResponse` props; renders a summary card using the project's Tailwind palette and Marcellus font conventions
- [ ] T008 [US1] Implement `RsvpDashboard` component in `src/components/admin/RsvpDashboard.tsx` — accepts an array of event summaries and a meal breakdown array; renders `EventSummaryCard` for each event and a meal counts section; displays "No RSVPs received yet" contextual message when all counts are zero
- [ ] T009 [US1] Implement `/admin/rsvp/page.tsx` — inline `auth()` guard checking `roles.includes('admin')`; `export const dynamic = 'force-dynamic'`; Drizzle queries for (a) per-event headcounts by joining `rsvpResponses` grouped by `eventId`/`attendanceStatus`, (b) "no response" count from `guestEvents` minus matched `rsvpResponses`, (c) meal breakdown from `attendees` joined to attending `rsvpResponses`; passes data to `RsvpDashboard`; renders `AdminTabs` at the top

**Checkpoint**: US1 is independently functional — dashboard displays live counts, zero-state message works, meal breakdown shows correctly

---

## Phase 4: User Story 2 — Browse and Search All Guest RSVPs (Priority: P2)

**Goal**: Admin can view every guest's RSVP status, filter by status or event, search by partial name, and drill into a guest's full RSVP details

**Independent Test**: Log in as admin, navigate to `/admin/guests`, search for a guest by partial name, filter to "not responded", click through to a guest's detail view and confirm full attendee/meal data is shown

### Implementation for User Story 2

- [ ] T010 [US2] Add client-side name search input, RSVP status filter (attending / not attending / no response), and event filter (dropdown of all events) to `src/components/admin/GuestTable.tsx` — filter logic uses `.filter()` over the pre-fetched rows prop; no server round-trips
- [ ] T011 [US2] Implement guest RSVP detail page at `src/app/admin/guests/[guestId]/page.tsx` — inline `auth()` admin guard; Drizzle query fetching the guest with `rsvpResponses → attendees` and `guestEvents → event` relations; renders guest name, each event they are invited to with their per-event RSVP status, attendee names, meal choices, and dietary notes; links to the edit page at `/admin/guests/[guestId]/edit`; renders `AdminTabs` at the top

**Checkpoint**: US2 is independently functional — guest list filters work, guest detail shows full RSVP breakdown without requiring edit functionality

---

## Phase 5: User Story 3 — Update a Guest's RSVP on Their Behalf (Priority: P3)

**Goal**: Admin can edit any guest's RSVP status or attendee details at any time, bypassing the guest-facing deadline; changing to "not attending" prompts whether to cascade to per-event RSVPs

**Independent Test**: Use the edit form to change a guest's wedding RSVP to "not attending", confirm the cascade prompt appears, confirm/decline and verify the dashboard totals update on next load

### Tests for User Story 3

> **Write these tests FIRST and confirm they FAIL before implementing the actions**

- [ ] T012 [US3] Write `src/app/admin/rsvp/actions.test.ts` with three `describe` blocks — `updateRsvpAttendance` (6 cases: null session, non-admin role, upsert create path, upsert update path, guest not found, guest not invited to event); `cascadeRsvpNotAttending` (5 cases: non-admin role, cascade false, cascade true, transaction scope, guest not found); `updateAttendeeDetails` (5 cases: non-admin role, delete-then-reinsert, correct field values, `updatedAt` bumped, invalid `rsvpResponseId`) — use `vi.mock('@/lib/auth')` and `vi.mock('@/lib/db')` with a `createMockDb` factory following the pattern in `src/app/rsvp/actions.test.ts`

### Implementation for User Story 3

- [ ] T013 [US3] Implement server actions in `src/app/admin/rsvp/actions.ts` — `'use server'`; each action calls `auth()` and throws `'Unauthorized'` if `roles` does not include `'admin'`; `updateRsvpAttendance` upserts an `RsvpResponse` row; `cascadeRsvpNotAttending` updates wedding response and optionally all per-event responses in a single Drizzle transaction when `cascadeToEvents: true`; `updateAttendeeDetails` deletes existing `Attendee` rows then reinserts; all actions call `revalidatePath('/admin/rsvp')` on success; return `{ success: true } | { success: false; error: string }`
- [ ] T014 [US3] Implement `GuestRsvpDetail` client component in `src/components/admin/GuestRsvpDetail.tsx` — renders current RSVP status per event with inline edit controls; on save calls `updateRsvpAttendance` or `updateAttendeeDetails`; when wedding status changes to "not attending" and per-event RSVPs exist, shows a confirmation modal asking whether to cascade; on confirm calls `cascadeRsvpNotAttending` with `cascadeToEvents: true`, on decline calls with `cascadeToEvents: false`; surfaces `error` field from action result if `success: false`
- [ ] T015 [US3] Implement admin RSVP edit page at `src/app/admin/guests/[guestId]/edit/page.tsx` — inline `auth()` admin guard; fetches guest with full RSVP and event relations via Drizzle; renders `AdminTabs` and `GuestRsvpDetail`; confirms deadline bypass is in effect (no deadline check in admin path)

**Checkpoint**: US3 is independently functional — admin can update any RSVP, cascade prompt works, dashboard totals reflect changes, all T012 tests pass

---

## Phase 6: User Story 4 — View Per-Event RSVP Details (Priority: P4)

**Goal**: Admin can drill into a specific event from the dashboard and see a named list of all invited guests sorted by RSVP status

**Independent Test**: Click through from the dashboard to a per-event detail page; confirm only guests invited to that event are listed; confirm attending guests appear first, followed by not-attending, then no-response

### Implementation for User Story 4

- [ ] T016 [P] [US4] Implement `EventRsvpTable` component in `src/components/admin/EventRsvpTable.tsx` — accepts an array of `{ guestName, attendanceStatus }` rows sorted attending → not_attending → no_response; renders a table with name and status columns; "pending" label for no-response rows
- [ ] T017 [US4] Implement per-event RSVP detail page at `src/app/admin/rsvp/[eventId]/page.tsx` — inline `auth()` admin guard; `export const dynamic = 'force-dynamic'`; fetches the event by `params.eventId`; fetches all `guestEvents` for that event with guest names; fetches matching `rsvpResponses`; derives status for each guest (attending / not_attending / no response); passes sorted rows to `EventRsvpTable`; renders `AdminTabs` at the top; links back to `/admin/rsvp`

**Checkpoint**: Clicking an event card on the dashboard loads the per-event list; status sort order is correct; pending guests are clearly labelled

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verify all quality gates pass across the complete feature

- [ ] T018 [P] Run `npm run type-check` and resolve all TypeScript errors introduced by the `roles` type extension and new components/pages
- [ ] T019 [P] Run `npm run lint` and resolve all ESLint and Prettier violations across modified and new files
- [ ] T020 Run `npm test` and confirm all tests in `src/lib/auth.test.ts` and `src/app/admin/rsvp/actions.test.ts` pass with no failures
- [ ] T021 Run quickstart.md validation end-to-end — verify admin login, dashboard zero-state and live counts, guest search/filter, guest detail drill-through, RSVP edit with cascade prompt, and per-event detail view all work as described in acceptance scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user stories**
  - T002 must complete before T003–T006
  - T003–T006 can all run in parallel after T002
- **Phase 3 (US1)**: Depends on Phase 2 — T007 → T008 → T009 (sequential within phase)
- **Phase 4 (US2)**: Depends on Phase 2 — T010 → T011 (sequential within phase); independent of US1
- **Phase 5 (US3)**: Depends on Phase 2 — T012 (write tests, fail first) → T013 → T014 → T015; independent of US1/US2
- **Phase 6 (US4)**: Depends on Phase 2 — T016 → T017; independent of US1/US2/US3
- **Phase 7 (Polish)**: Depends on all desired user stories complete

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories — can start the moment Phase 2 is complete
- **US2 (P2)**: No dependency on other stories — can start in parallel with US1
- **US3 (P3)**: No dependency on other stories — tests must be written before implementation; can start in parallel with US1/US2
- **US4 (P4)**: No dependency on other stories — can start in parallel with all others

### Parallel Opportunities per Phase

**Phase 2** — after T002 completes:
```
T003  src/app/admin/invitations/page.tsx  ← run together
T004  src/app/admin/guests/page.tsx       ←
T005  src/components/admin/AdminTabs.tsx  ←
T006  src/lib/auth.test.ts               ←
```

**Phase 5** — US3 tests must fail before implementation:
```
T012  write tests → confirm failure → proceed to T013
```

**Phase 7** — quality gates:
```
T018  npm run type-check  ← run together
T019  npm run lint        ←
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational)
2. Complete Phase 3 (US1 — dashboard)
3. **STOP and VALIDATE**: confirm dashboard shows live RSVP counts and zero-state message
4. Decision point: deploy dashboard as useful read-only tool before adding self-service editing

### Incremental Delivery

1. Phase 1 + Phase 2 → admin login works, existing pages secured ✓
2. Phase 3 (US1) → dashboard live → **demo-able MVP**
3. Phase 4 (US2) → searchable guest list + detail view
4. Phase 5 (US3) → RSVP editing with cascade confirmation
5. Phase 6 (US4) → per-event drill-down
6. Phase 7 → final quality gates

Each phase adds usable value without breaking the previous phases.

---

## Summary

| Phase | Tasks | User Story | Parallel |
|-------|-------|------------|---------|
| 1 Setup | T001 | — | — |
| 2 Foundational | T002–T006 | — | T003–T006 after T002 |
| 3 Dashboard | T007–T009 | US1 P1 | T007 has no dependencies |
| 4 Guest List | T010–T011 | US2 P2 | — |
| 5 RSVP Edit | T012–T015 | US3 P3 | T012 (tests) must fail first |
| 6 Per-Event | T016–T017 | US4 P4 | — |
| 7 Polish | T018–T021 | — | T018+T019 |
| **Total** | **21 tasks** | **4 stories** | |
