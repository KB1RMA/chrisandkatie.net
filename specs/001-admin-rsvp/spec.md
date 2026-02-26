# Feature Specification: Admin RSVP Management

**Feature Branch**: `001-admin-rsvp`  
**Created**: February 26, 2026  
**Status**: Draft  
**Input**: User description: "I need to add that all functionality should have an admin view for myself and my fiancee to manage and view RSVPs both to the wedding and to individual events"

## Clarifications

### Session 2026-02-26

- Q: Admin authentication method → A: Extend the existing NextAuth Credentials provider; attach a role to the session token; admin credentials (username + password) stored in environment variables
- Q: Admin role representation on session token → A: Use a `roles: string[]` array instead of a boolean flag, so the session shape is `{ roles: ['admin'] }` — enabling future role additions without schema changes
- Q: Cascade behavior when wedding RSVP changed to "not attending" → A: Show a confirmation prompt asking whether to also mark all per-event RSVPs as "not attending"; admin chooses before saving
- Q: Admin route protection strategy → A: Follow the existing pattern — each new admin page performs an inline `await auth()` + `redirect()` check directly in the server component, matching `/admin/guests` and `/admin/invitations`; no shared layout is introduced
- Q: Admin UI pattern → A: Extend the existing `AdminTabs` component in `src/components/admin/AdminTabs.tsx` with new tab entries; new views follow the same server component + dedicated `src/components/admin/` table/card component pattern as the existing admin pages
- Q: Dashboard empty/zero state when no RSVPs submitted → A: Show zeros with a brief contextual message (e.g., "No RSVPs received yet") to confirm the dashboard is working and data simply hasn't arrived

---

## Assumptions

- There are exactly two admin users: the couple (Chris and Katie). No additional admin access is needed.
- Admin authentication reuses the existing NextAuth v5 Credentials provider. Admin users are distinguished from guests by a `roles: ['admin']` array on the session token. Admin credentials (username and password) are stored in environment variables — no database table for admin users is needed.
- RSVPs for the main wedding and all additional events are stored in the same system used by the guest-facing RSVP portal.
- "Managing" an RSVP means the admin can update or override a guest's response on their behalf (e.g., a guest calls to update their RSVP after the deadline, or was marked incorrectly).
- All existing RSVP data (wedding + individual events) is immediately visible in the admin view without any migration or data re-entry.

## Existing Admin Patterns

This feature extends the admin area already present at `src/app/admin/`. New pages MUST follow these established conventions:

- **Route structure**: new pages live at `src/app/admin/[section]/page.tsx` under the existing `/admin` route tree
- **Auth check**: each page performs an inline `const session = await auth()` check and calls `redirect('/login?callbackUrl=/admin/[section]')` when the session is absent or does not carry the admin role — no shared layout is introduced
- **Navigation**: new sections are added as entries to the `adminTabs` array in `src/components/admin/AdminTabs.tsx`; the `AdminTabs` component is rendered consistently at the top of every admin page
- **Display components**: tabular or list views are implemented as dedicated components in `src/components/admin/` (e.g., `GuestTable.tsx`, `InvitationTable.tsx`), keeping page files focused on data fetching
- **Data fetching**: Drizzle queries run directly in server component page files; `export const dynamic = 'force-dynamic'` is set on all admin pages
- **Typography and styling**: consistent with existing admin pages using the `Marcellus` font and the project's Tailwind color palette

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View RSVP Summary Dashboard (Priority: P1)

One of the couple wants a quick snapshot of "where things stand" — how many people are coming to the wedding, how many have declined, how many haven't responded yet, and a breakdown of meal preferences. They open the admin dashboard and see all of this at a glance without having to scroll through individual guest records.

**Why this priority**: This is the highest-value view the couple will check repeatedly as the RSVP deadline approaches. It requires no editing capability — just read access to aggregated data — making it the simplest meaningful admin feature and the natural starting point.

**Independent Test**: Can be fully tested by logging in as an admin and verifying the dashboard displays accurate totals for attending, not attending, and no-response counts, along with correct meal preference breakdowns. The counts can be independently verified against the database.

**Acceptance Scenarios**:

1. **Given** an admin is logged in, **When** they view the dashboard, **Then** they see the total number of guests invited, attending, not attending, and not yet responded for the main wedding event
2. **Given** an admin views the dashboard, **When** the RSVP data includes meal preferences, **Then** they see a count breakdown of each meal option chosen across all attending guests
3. **Given** an admin views the dashboard, **When** additional events exist, **Then** each event shows its own attending/not-attending/no-response counts in a summary card or section
4. **Given** an admin views the dashboard, **When** the data changes (a guest submits or updates their RSVP), **Then** the dashboard reflects the updated totals on the next page load
5. **Given** an admin views the dashboard before any RSVPs have been submitted, **When** the page loads, **Then** all counts display as zero accompanied by a brief contextual message (e.g., "No RSVPs received yet") — no error state or blank UI is shown

---

### User Story 2 - Browse and Search All Guest RSVPs (Priority: P2)

The couple wants to see the full guest list with each person's RSVP status, so they can identify who has and hasn't responded, confirm headcounts, and answer questions like "is Sarah Davis coming?" without digging through emails or a spreadsheet.

**Why this priority**: The detailed guest list is the workhorse of event planning. It enables the couple to follow up with non-responders and confirm attendance numbers with the venue. Delivered independently, this view alone replaces spreadsheet tracking.

**Independent Test**: Can be fully tested by logging in as an admin, navigating to the guest list view, and using filters/search to locate specific guests and verify their RSVP details are accurate. Testable without any editing functionality.

**Acceptance Scenarios**:

1. **Given** an admin views the guest list, **When** the page loads, **Then** they see all guests with their name, RSVP status (attending/not attending/pending), and which events they are invited to
2. **Given** an admin searches by name, **When** they enter a partial name, **Then** the list filters to show only matching guests
3. **Given** an admin filters by RSVP status, **When** they select "not responded", **Then** only guests who have not yet submitted any RSVP are shown
4. **Given** an admin filters by event, **When** they select a specific additional event, **Then** only guests invited to that event are shown along with their per-event RSVP status
5. **Given** an admin clicks on a guest, **When** the detail view opens, **Then** they see the guest's full RSVP details including attendee names, meal preferences, dietary restrictions, and notes

---

### User Story 3 - Update a Guest's RSVP on Their Behalf (Priority: P3)

A guest calls the couple after the RSVP deadline to change their response, or a guest was accidentally marked as not attending when they are actually attending. The couple needs to update this record directly without asking the guest to log back in.

**Why this priority**: Overrides and manual corrections are an inevitable part of managing a wedding. Without this capability, the couple would need database access to make changes, which is not practical. Delivered after the read-only views are working, this completes the management workflow.

**Independent Test**: Can be fully tested by locating a guest in the admin view, updating their RSVP status or attendee details, saving the change, and verifying the updated data is reflected in both the admin view and the guest's own view.

**Acceptance Scenarios**:

1. **Given** an admin is viewing a guest's RSVP details, **When** they update the guest's attendance status and save, **Then** the change is persisted and the guest's view reflects the updated status
2. **Given** an admin updates a guest's attendee count or meal preferences, **When** they save the changes, **Then** the dashboard totals are recalculated to reflect the updated data
3. **Given** an admin updates an RSVP after the guest-facing deadline has passed, **When** they save the change, **Then** the update is accepted without restriction (admin edits bypass the deadline lock)
4. **Given** an admin updates a guest's RSVP for a specific additional event, **When** the change is saved, **Then** that event's RSVP totals on the dashboard update accordingly
5. **Given** an admin changes a guest's wedding RSVP to "not attending" and the guest has existing per-event RSVPs, **When** they attempt to save, **Then** a confirmation prompt appears asking whether to also clear all per-event RSVPs; if confirmed, all are set to "not attending"; if declined, only the wedding RSVP is updated

---

### User Story 4 - View Per-Event RSVP Details (Priority: P4)

The couple needs to give the rehearsal dinner venue a final headcount, or wants to confirm who is coming to the post-wedding brunch. They view a focused list of all guests invited to a specific event with their individual RSVP status for that event.

**Why this priority**: Event-level drill-down is essential for coordinating with vendors and venues on a per-event basis. While the main dashboard provides counts, vendors often need a named list. This is lower priority than the overall guest view because the dashboard already surfaces per-event counts.

**Independent Test**: Can be fully tested by navigating to a specific event's detail view and verifying that only guests invited to that event are listed, with accurate per-event RSVP statuses shown.

**Acceptance Scenarios**:

1. **Given** an admin selects a specific event from the dashboard, **When** the event detail view loads, **Then** they see a list of all guests invited to that event with each guest's RSVP status for that event
2. **Given** an admin views an event's guest list, **When** they sort by RSVP status, **Then** attending guests are grouped and listed before non-attending and pending guests
3. **Given** an admin views an event's guest list, **When** the guest has not yet responded, **Then** their status is clearly marked as pending/no response

---

### Edge Cases

- When an admin marks a guest as "not attending" the main wedding and that guest has existing per-event RSVPs, the system MUST show a confirmation prompt asking whether to also mark all per-event RSVPs as "not attending". The admin's choice determines whether the cascade occurs; no automatic clearing happens without confirmation.
- How does the system respond if an admin clears or resets a guest's RSVP entirely (as if they never submitted)?
- When no RSVPs have been submitted yet, the dashboard displays all counts as zero with a brief contextual message (e.g., "No RSVPs received yet") rather than a blank or error state.
- If the same person is listed on multiple invitations (data entry error), how is this surfaced or prevented in the admin view?

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST authenticate admin users via the existing NextAuth Credentials provider, with admin credentials (username/password) stored in environment variables and a `roles: ['admin']` array attached to the session token upon successful login
- **FR-002**: Admins MUST be able to view a summary dashboard showing total invited, attending, not attending, and no-response counts for the main wedding
- **FR-003**: Admins MUST be able to view a meal preference breakdown (count per option) across all attending guests on the dashboard
- **FR-004**: Admins MUST be able to view per-event RSVP summary counts (attending, not attending, no response) on the dashboard
- **FR-005**: Admins MUST be able to view a complete guest list with each guest's name, RSVP status, and event invitations
- **FR-006**: Admins MUST be able to search the guest list by name (partial match)
- **FR-007**: Admins MUST be able to filter the guest list by RSVP status (attending, not attending, no response)
- **FR-008**: Admins MUST be able to filter the guest list by a specific event to see only guests invited to that event
- **FR-009**: Admins MUST be able to view the full RSVP details for an individual guest, including all attendees, meal preferences, and dietary notes
- **FR-010**: Admins MUST be able to update a guest's RSVP status for the main wedding event
- **FR-011**: Admins MUST be able to update a guest's RSVP status for any individual additional event
- **FR-012**: Admins MUST be able to update attendee details (names, meal preferences, dietary restrictions) on behalf of a guest
- **FR-013**: Admin edits MUST bypass the guest-facing RSVP deadline, allowing changes to be made at any time
- **FR-015**: When an admin changes a guest's main wedding RSVP to "not attending" and that guest has per-event RSVPs on record, the system MUST display a confirmation prompt offering to cascade the change to all per-event RSVPs; the cascade MUST only occur if the admin explicitly confirms
- **FR-014**: Each admin page MUST perform an inline server-side `auth()` check and redirect to `/login?callbackUrl=/admin/[section]` when the session is absent or the session's `roles` array does not include `'admin'`; this follows the existing pattern used by `/admin/guests` and `/admin/invitations`
- **FR-016**: New admin sections MUST be registered as entries in the `adminTabs` array in `src/components/admin/AdminTabs.tsx` so they appear in the shared tab navigation rendered on every admin page
- **FR-017**: Display logic for new admin views MUST be implemented as dedicated components in `src/components/admin/` following the naming and structural conventions of `GuestTable.tsx` and `InvitationTable.tsx`

### Key Entities

- **Admin User**: One of the two designated admins (the couple). Authenticated via the existing NextAuth Credentials provider with `roles: ['admin']` on their session token. Has full read and write access to all RSVP data for all guests and events.
- **RSVP Summary**: Aggregated view of attendance counts and meal preferences across all guests for a given event or the overall wedding.
- **Guest RSVP Record**: A single guest's complete RSVP submission, including their attendance decision, all attendees in their party, meal preferences, and dietary notes, scoped to the main wedding or a specific additional event.
- **Event**: Either the main wedding or a named additional event (e.g., rehearsal dinner, post-wedding brunch). Each event has its own independent set of RSVP responses.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can obtain a complete RSVP headcount (attending, not attending, no response) for the main wedding and all additional events within 30 seconds of logging in, without navigating away from the dashboard
- **SC-002**: An admin can locate any individual guest's full RSVP details by name in under 15 seconds using search
- **SC-003**: An admin can update any guest's RSVP status and have the change reflected in the dashboard totals in a single session without technical assistance
- **SC-004**: An admin can produce a named attendee list for any individual additional event without exporting data or using external tools
- **SC-005**: The admin area is inaccessible to all guest users and unauthenticated visitors — zero unauthorized access incidents
