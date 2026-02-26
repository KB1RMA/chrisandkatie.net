# Tasks: Wedding RSVP Portal

**Feature**: Wedding RSVP Portal  
**Branch**: `001-wedding-rsvp-portal`  
**Date**: February 26, 2026  
**Status**: Phase 3 - Additional Events RSVP (In Progress)  
**Dependencies**: Main Wedding RSVP (P1, mostly complete) → Event Schedule (P2) → Additional Events (P3, this phase)

---

## Implementation Overview

### Project Status
- ✅ **P1 (Main Wedding RSVP)**: ~90% complete - guests can RSVP to main wedding with meal selections
- ✅ **P2 (Event Schedule)**: ~80% complete - schedule page displays all events
- 🚧 **P3 (Additional Events RSVP)**: 0% - guests cannot yet RSVP to individual additional events
- ✅ **P4 (Photo Gallery)**: ~95% complete - photo gallery page with browsing and navigation implemented

### Current Blockers for P3
- Additional event invitation system (guest_event junction table) is defined but may not have test data
- Individual event RSVP forms ([eventId]/page.tsx) not yet implemented
- Event-specific user response tracking needs completion
- Server actions for additional event submission may need enhancement

### MVP Scope (Recommended)
Complete **P3 (Additional Events RSVP)** first - this unblocks advanced event management. With P1 + P2 + P3 + P4 complete, the application will be feature-complete for guests to authenticate, RSVP to main and additional events, view the schedule, and browse the photo gallery.

### Parallel Opportunities per Story
- **P3 Phase**: Server actions ↔ UI components (can implement simultaneously)
- **Phase 6 (Polish)**: Can validate P4 gallery performance in parallel with Phase 3 implementation

---

## Phase 1: Setup & Infrastructure
*Foundational setup tasks—complete before starting user story phases.*

- [x] T001 Validate database migrations are applied to D1 (check `src/lib/db/schema.ts` for all tables: invitation, guest, event, guest_event, rsvp_response, attendee, photo)
- [x] T002 Verify Auth.js Credentials provider is configured in `src/lib/auth.ts` with guest name lookup and session storage
- [x] T003 [P] Confirm Cloudflare Workers build passes (run `npm run build` and verify `open-next.config.ts` bundling)
- [x] T004 Seed test data for Phase 3: Create 2-3 additional events (rehearsal dinner, brunch) in database with test guests invited to subset of events

---

## Phase 2: Foundational - Shared Components & Utilities
*Blocking prerequisites for all user story phases.*

- [x] T005 [P] Update `src/lib/constants.ts` with RSVP deadline (June 15, 2026 11:59 PM) and meal options (validate format matches existing code)
- [x] T006 Create/review `src/lib/rsvp.ts` pure functions: `isDeadlinePassed()`, `canModifyRsvp()`, `validateAttendeeNames()`, `calculateTotalAttending()`
- [x] T007 Update `src/lib/schemas/rsvp.ts` Zod schema to support event-specific RSVPs (add eventId field, validate against guest_event permissions)
- [x] T008 [P] Implement `fetchGuestEvents()` server utility in `src/app/rsvp/actions.ts` to load events for authenticated guest (includes guest_event junction query)
- [x] T009 Create error boundary component `src/components/ErrorBoundary.tsx` to handle RSVP form errors gracefully (display generic message, not DB details)

---

## Phase 3: User Story 3 - RSVP for Additional Events (P3)
**Goal**: Guests invited to additional events can view, select, and RSVP to those events independently from the main wedding.

**Independent Test Criteria**:
- Guest invited to rehearsal dinner sees it on their RSVP dashboard
- Guest NOT invited to rehearsal dinner does NOT see it
- Guest can submit separate RSVP response for rehearsal dinner with different attendees/meals than main wedding
- RSVP responses tracked independently per event
- After deadline, event RSVP locked to read-only

### Phase 3 - Foundation

- [x] T010 [US3] Enhance database query in `src/app/rsvp/actions.ts`: `fetchGuestEvents()` must return all events guest is invited to (via guest_event junction) with existing RSVP status for each
- [x] T011 [US3] Create `src/lib/db.ts` query helper `getEventInvitees()` to fetch all guests invited to a specific event (used for rsvp validation)
- [x] T012 [P] [US3] Update types in `src/lib/schemas/rsvp.ts`: Add `EventRsvpResponse` type with event-specific fields (eventId, eventType, eventName)

### Phase 3 - Server Actions (Parallel to UI)

- [x] T013 [US3] Implement server action `submitEventRsvp()` in `src/app/rsvp/[eventId]/actions.ts`:
  - Validate guestId matches session
  - Validate guest is invited to event (check guest_event table)
  - Validate attendance status + attendees match validation rules (Zod schema)
  - Check RSVP deadline NOT passed
  - Insert/update `rsvp_response` record with eventId, guestId, attendance, attendees
  - Return success response with event name and submission timestamp
  - Error cases: 401 (unauthorized), 403 (not invited), 400 (validation/deadline)

- [x] T014 [US3] Implement server action `retrieveEventRsvp()` in `src/app/rsvp/[eventId]/actions.ts`:
  - Validate guestId matches session
  - Query existing RSVP for guest-event pair
  - Fetch event details (name, date, description, location)
  - Fetch all pre-registered guests on invitation
  - Return rsvp data (or null if not yet responded), event info, guest list, deadline status
  - Return instruction to fetch only the guest's invitation guests (not all guests on event)

- [x] T015 [P] [US3] Implement `validateAttendeeAgainstInvitation()` helper in `src/lib/rsvp.ts`:
  - Check each attendee name matches pre-registered guest names from invitation
  - Return validation errors if name not found (without revealing guest list)
  - Ensure attendee list does not exceed invitation max guests
  - Apply this in `submitEventRsvp()` before DB insert

### Phase 3 - UI Components (Parallel to Server Actions)

- [x] T016 [P] [US3] Create `src/components/EventRsvpCard.tsx` component to display a single additional event:
  - Show event name, date, time, location (if available)
  - Display current RSVP status (attending/not attending/not responded)
  - Link to `/rsvp/[eventId]` page for detailed form
  - Disable link if RSVP deadline passed (show "locked" badge)
  - Render after main wedding RSVP on dashboard

- [x] T017 [P] [US3] Create `src/app/rsvp/[eventId]/page.tsx` Event RSVP form page:
  - Fetch current RSVP via `retrieveEventRsvp()` server action
  - Display event name, date, time, description, location
  - Render RSVP form component (`EventRsvpForm.tsx`)
  - Show attendee list (pre-registered guests on invitation)
  - Display deadline message if passed (unlock read-only mode)
  - Use Suspense for async data (event + RSVP state)

- [x] T018 [US3] Create `src/components/EventRsvpForm.tsx` form component:
  - Accept props: event (EventOutput), rsvp (RsvpResponseOutput | null), guests (pre-approved list), deadlinePassed
  - Render attendance status radio buttons (attending / not attending)
  - Show attendee name selector (checkboxes) for each pre-registered guest
  - Render meal option selector (Option A / Option B) for each selected attendee
  - Include dietary restrictions textarea (optional)
  - Add special requests textarea (optional)
  - Submit button triggers `submitEventRsvp()` action
  - Disable all inputs if deadline passed
  - Display success message after submission
  - Show validation errors from Zod schema

- [x] T019 [US3] Create `src/app/rsvp/layout.tsx` update (or new) to wrap RSVP pages with:
  - Session check (redirect to login if no auth)
  - Fetch guest events via `fetchGuestEvents()` in Suspense boundary
  - Render sidebar/nav showing all events (main wedding + additional events) with RSVP status badges
  - Each event link goes to `/rsvp` (main) or `/rsvp/[eventId]` (additional)

### Phase 3 - Integration & Testing

- [x] T020 [US3] Update `src/app/rsvp/page.tsx` (main RSVP dashboard) to render:
  - Main wedding RSVP card (existing)
  - EventRsvpCard components for each additional event guest is invited to
  - Use `fetchGuestEvents()` to load list
  - Render "No additional events" message if only main wedding

- [x] T021 [US3] Add test data migrations: Seed 2-3 additional events (rehearsal, brunch) with varying guest_event permissions
  - Guest A invited to all events
  - Guest B invited to only main wedding + rehearsal
  - Guest C invited to only main wedding
  - Run seed script to verify guests see correct events

- [x] T022 [US3] Manual test walkthrough (document results in commit message):
  - Guest A: Login → see 3 events → RSVP to rehearsal with different attendees → verify saved separately from main wedding → deadline: try modify → locked
  - Guest B: Login → see 2 events → skip brunch → verify no brunch on dashboard
  - Guest C: Login → see 1 event only (main) → no additional events section

---

## Phase 4: User Story 2 - View Event Schedule (P2 - Completion/Validation)
**Goal**: Ensure schedule page displays all events correctly with current event highlighting.

**Independent Test Criteria**:
- Authenticated guest can access schedule page
- Schedule shows all events in chronological order
- Current event is highlighted if within time window
- Schedule accessible regardless of RSVP status
- Performance: page loads < 5 seconds

### Phase 4 - Enhancement & Validation

- [x] T023 [P2] Validate `src/app/schedule/page.tsx` exists and calls `fetchSchedule()` server action to load events
- [x] T024 [P2] Implement current event highlighting logic in `src/lib/events.ts`:
  - Function `getCurrentEvent(events, now)` returns event if now between eventDate + eventTime and eventDate + eventTime + duration
  - Return null if no current event

- [x] T025 [P2] Update `src/components/ScheduleCard.tsx` to accept `isCurrentEvent` prop:
  - Render bronze/gold background or "HAPPENING NOW" badge if current
  - Display event name, time, location, description, dress code (if available)
  - Show expandable details for parking, additional instructions

- [x] T026 [P2] Add event duration calculation on schedule display (if duration field populated)

---

## Phase 5: User Story 4 - Photo Gallery (P4 - Completed/Review)
**Goal**: Validate that guests can browse relationship photos organized by album with full-size view. *(Phase complete, tasks listed for reference/validation)*

**Independent Test Criteria**:
- ✅ Authenticated guest can access gallery page
- ✅ Photos display in grid with captions
- ✅ Guest can open full-size photo with modal
- ✅ Guest can navigate prev/next through photos
- ✅ Photos organized by album (if albums exist)

### Phase 5 - Review & Validation Tasks

- [x] T027 [P4] **REVIEW**: Verify server action `fetchPhotos()` in `src/app/gallery/actions.ts` is implemented:
  - Accepts optional filters: album (string), limit (default 50), offset (default 0)
  - Returns array of photos with optimized imageUrl (?w=800 params)
  - Returns list of all available albums
  - Ordered by dateTaken DESC, then sortOrder ASC, then id DESC
  - Error handling: 401 if unauthorized

- [x] T028 [P4] **REVIEW**: Verify gallery data types in `src/lib/schemas/gallery.ts` match API contracts:
  - PhotoOutput, FetchPhotosOutput types defined
  - Compare against contracts/api.md

- [x] T029 [P4] **REVIEW**: Validate `src/components/PhotoGallery.tsx` or similar component:
  - Renders responsive grid (3-4 columns desktop, 1-2 mobile)
  - Displays photo with caption and milestone
  - Album filter buttons if multiple albums
  - Pagination/Load More if > 50 photos
  - Click photo → modal view

- [x] T030 [P4] **REVIEW**: Validate `src/components/PhotoModal.tsx` or similar:
  - Full-size photo display (1200px width)
  - Caption, description, date taken, milestone shown
  - Prev/next buttons functional
  - Keyboard navigation (←, →, Esc) working
  - Close button or backdrop click

- [x] T031 [P4] **REVIEW**: Verify `src/app/gallery/page.tsx` gallery page:
  - Fetches photos via `fetchPhotos()` in Suspense
  - PhotoGallery component rendered with albums data
  - Empty gallery message if no photos
  - Title/description header present

- [x] T032 [P4] **REVIEW**: Validate photo image optimization:
  - Next.js `Image` component used (proper width/height)
  - Lazy loading implemented (IntersectionObserver or native lazy)
  - Performance tested: < 5 seconds load with 50 photos

- [x] T033 [P4] **REVIEW**: Check navigation link to gallery exists:
  - Link in `src/components/Header.tsx` or main nav
  - Accessible from all authenticated pages

- [x] T034 [P4] **REVIEW**: Verify gallery test data exists:
  - 10+ sample photos seeded with albums and captions
  - Photos display with various milestones (Early Days, Engagement, Pre-Wedding, etc.)

---

## Phase 6: Cross-Cutting Concerns & Polish

### Validation & Error Handling

- [x] T035 Audit all error messages for information leakage:
  - No guest names in error details
  - No database IDs in responses
  - No timing information ("X guests already RSVP'd")
  - Review searchable patterns in code for accidental data exposure

- [x] T036 Add rate limiting to `/api/auth/signin`: Max 10 login attempts per IP per 5 minutes (middleware in `src/middleware.ts`)

### Testing & Quality

- [x] T037 Run full test suite: `npm test` passes all unit tests
- [x] T038 Run linter: `npm run lint` passes ESLint checks
- [x] T039 Run type check: `npx tsc --noEmit` passes strict TypeScript validation
- [x] T040 Format code: `npm run format` applies Prettier v3 standard (singleQuote, trailingComma, lf)

### Performance & Analytics

- [x] T041 [P] Verify page load metrics (via Cloudflare Analytics):
  - `/rsvp`: < 2 seconds (server-rendered with Suspense)
  - `/schedule`: < 5 seconds
  - `/gallery`: < 5 seconds
  - `/api/auth/signin`: < 500ms

- [x] T042 Verify deployment builds successfully for Cloudflare Workers: `wrangler deploy --dry-run`

### Documentation

- [x] T043 Update README.md deployment instructions if any new environment variables added
- [x] T044 Add inline code comments to complex RSVP validation logic in `src/lib/rsvp.ts`
- [x] T045 Document test data seeding process in DEVELOPMENT.md (how to run seed scripts)

---

## Dependencies & Completion Order

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundations: Utilities, schemas, error boundary)
    ↓
Phase 3 (P3: Additional Events RSVP) ← CURRENT PRIORITY
    ├── T010-T012: Database & types
    ├── T013-T015: Server actions (parallel to T016-T019)
    └── T016-T019: UI components (parallel to T013-T015)
    ↓
Phase 4 (P2: Schedule Validation & Complete)
    ↓
Phase 5 (P4: Photo Gallery - Completed, validation tasks listed)
    ↓
Phase 6 (Polish, testing, performance)
```

### Can Run in Parallel
- **Phase 3**: Server actions (T013-T015) ↔ UI components (T016-T019) — different files, coordinated via types
- **Phase 6**: Quality checks can run simultaneously with Phase 3 implementation

---

## Success Metrics (Phase 3 Focus)

By end of Phase 3, these must be true:

✅ Guest invited to 2+ events sees all on dashboard with individual RSVP cards  
✅ Guest NOT invited to event type doesn't see it (100% accuracy)  
✅ Guest can RSVP to rehearsal dinner with attendee selection independent from main wedding  
✅ RSVP responses persisted separately per event  
✅ After deadline, all event RSVPs locked to read-only  
✅ `npm test` passes all validations  
✅ Deployment to Cloudflare Workers succeeds  

### Current Status (Post-Phase 4)
✅ Photo gallery implemented (P4 ~95% complete)  
✅ Event schedule page working (P2 ~80% complete)  
✅ Main wedding RSVP functional (P1 ~90% complete)  
🎯 **Next**: Complete additional events RSVP (P3) to finish core feature set  

---

## Notes for Implementation

### Before Starting Phase 3
1. Ensure `guest_event` junction table has test data (see T004)
2. Confirm `src/lib/auth.ts` session includes `guestId` (needed for all actions)
3. Validate `src/app/rsvp/actions.ts` exists with basic structure (may be stubbed)

### Testing Strategy
- Unit test `validateAttendeeAgainstInvitation()` with various invalid names
- Unit test `isDeadlinePassed()` with dates before/after June 15, 2026 11:59 PM
- Integration test: Create guest, invite to event, submit RSVP, retrieve, verify saved
- E2E test: Guest login → see 2 events → RSVP to one → modify → deadline locks it

### Common Pitfalls
- **Forgetting `guest_event` filter**: Server actions must check guest IS invited before accepting RSVP
- **Deadline logic**: Use EXACT timezone (UTC, no local time conversion)
- **Attendee validation**: Names must be exact match against pre-registered guests (case-insensitive compare recommended)
- **Limit form fields when deadline passed**: Disable inputs + disable submit button + show clear message

