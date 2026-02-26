# Research: Wedding RSVP Portal

**Date**: February 26, 2026  
**Status**: Complete  
**Branch**: `001-wedding-rsvp-portal`

## Overview

No outstanding NEEDS CLARIFICATION items. All ambiguities from the initial specification were resolved during the clarification session (Session 2026-02-26). This document captures the key research findings and design decisions made during specification review.

## Authentication & Security Model

### Decision: Name-Based Lookup (MVP)

**What was decided**: Guests authenticate by entering their first and last name as printed on their invitation. The system verifies the name against a pre-loaded guest list stored in Cloudflare D1.

**Why chosen**:
- Minimal friction for guests (single field, no additional codes to track)
- Existing project uses Auth.js with Credentials provider—perfect fit for name-based lookup
- Matches wedding invitation UX patterns (guests are accustomed to identifying themselves by name)
- D1 edge database ensures sub-100ms lookup latency for name verification
- Pre-registered guest list eliminates security risk of unauthorized access

**Alternatives considered & rationale**:
- **PIN/Code approach**: Required sending codes to guests pre-event; added friction without proportional security gain for this use case
- **Email verification**: Many guests may not have provided email addresses; exceeds simplicity principle
- **QR code + name**: Ideal security posture but requires printing custom QR codes on invitations; deferred to future enhancement (SC-2026-02-26)

**Implementation approach**:
- Auth.js Credentials provider with custom verification function
- Database query: `SELECT id FROM guest WHERE firstName = ? AND lastName = ? AND invitationId IN (SELECT id FROM invitation WHERE eventIds CONTAINS ?)`
- Fail-open pattern: Generic error message for failed auth prevents enumeration attacks
- Session token stored in secure httpOnly cookie via next-auth

---

## Meal Preferences & Dietary Handling

### Decision: Dual-Field Approach

**What was decided**: Two predefined meal options (specific options TBD by couple) + free-form text field for dietary restrictions and special requests.

**Why chosen**:
- Simplifies catering head count (clean bucketing into Option A / Option B)
- Preserves flexibility for complex dietary needs (allergies, religious restrictions, cultural preferences)
- Reduces input fatigue for guests (radio button selection vs. typing meal choice)
- Backend receives structured + unstructured data for both reporting and accommodation

**Alternatives considered & rationale**:
- **Free-text only**: Hard to aggregate; catering teams need categorical counts
- **Predefined categories (3-5 options)**: Over-engineered for this use case; couple has clear binary choice
- **Dietary restrictions only (no meal choice)**: Insufficient for catering planning; doesn't capture preference between two options

**Implementation approach**:
- Meal options stored in `src/lib/constants.ts` as configurable array
- Frontend: Radio button group for options + textarea for dietary notes
- Zod schema enforces meal selection; dietary text optional
- Database: `attendee.mealOption` (enum) + `attendee.dietaryRestrictions` (text)

---

## RSVP Deadline & Modification Window

### Decision: Hard Deadline with Read-Only Access

**What was decided**: 
- All guests can RSVP and modify their response until **June 15, 2026 at 11:59 PM**
- After deadline: RSVPs locked (read-only mode), guests can view but not edit
- Guests retain full access to schedule and photo gallery after deadline

**Why chosen**:
- Industry standard for event planning (clear cutoff enables final catering order)
- Protects couple from last-minute attendance changes that affect meal/seating counts
- Guests retain information access (schedule, gallery) for reference closer to event date
- Clear UX signal: read-only form communicates deadline has passed

**Alternatives considered & rationale**:
- **Soft deadline with warning**: Creates ambiguity; couples need hard count 1 week before event
- **Per-guest rolling window**: Breaks head count predictability; unfair to late respondents
- **No deadline**: Impractical for catering (no commitment point)

**Implementation approach**:
- Deadline stored in `src/lib/constants.ts` as ISO 8601 datetime
- Middleware/server component checks: `new Date() < RSVPDeadline`
- If expired: Form fields disabled via Zod conditional validation + front-end disabled UI state
- Message shown: "RSVP deadline (June 15, 2026) has passed. Your response is locked. Contact the couple to make changes."

---

## Guest List Management: Pre-Registered Only

### Decision: Strict Pre-Registration

**What was decided**: All guests (including plus-ones and family members) are pre-registered in the database before site launch. No dynamic guest addition via the portal.

**Why chosen**:
- Eliminates name verification ambiguity (couple controls exact spelling and data quality)
- Simplifies data model (no open-ended "other" guest slots to reconcile)
- Matches couple's existing guest database (all individuals already listed for RSVP tracking)
- Prevents typos/misspellings that would orphan RSVP data

**Alternatives considered & rationale**:
- **Primary guest adds others**: Creates duplicate/orphaned attendees if primary guest makes mistakes; hard to reconcile during catering
- **QR codes for open invitations**: Requires custom printing; out of scope for MVP
- **Flexible name entry**: Data quality issues; catering reconciliation nightmare

**Implementation approach**:
- `src/lib/db/schema.ts`: `guest` table with `firstName`, `lastName`, `invitationId` required fields
- `invitation` table has one-to-many relationship to `guest`
- During RSVP: Display all pre-registered guests on invitation; guest selects who attends
- No "add new attendee" input; all names come from database

---

## Error Handling & User Feedback

### Decision: Generic Error + Contact Info

**What was decided**: When guest name not found, show generic error message without revealing info about what names are in the system. Suggest checking spelling and contacting couple.

**Why chosen**:
- Prevents name enumeration attacks (attacker can't discover guest list)
- Reduces embarrassment if guest misspells their name (not accusatory)
- Redirects to couple for edge cases (nicknames, name variations not pre-registered)

**Error message pattern**:
> "Name not found. Please check the spelling of your name as it appears on your invitation, or contact the couple at [phone/email]."

**Implementation approach**:
- Catch name lookup failure in Auth.js Credentials provider
- Return generic `CredentialsSignin` error
- No database error details leak to client

---

## Performance & Scale

### Assumptions Validated

- **100-250 concurrent users**: Cloudflare Workers edge compute + D1 supports this easily
- **Sub-3-minute RSVP**: Network speed is bottleneck, not server logic
- **Schedule load <5s**: Static content after authentication; Suspense boundaries for concurrent data loading

### Implementation implications:
- Use React Server Components for auth check + guest data fetch (eliminates round-trip)
- Suspense boundaries for slow operations (fetch event list, photo list)
- No client-side API calls after initial submit; let Server Actions handle data consistency

---

## Database Locality & Auth Integration

### Auth.js + Drizzle + D1 Pattern

Leveraging existing project patterns:
- Auth.js Credentials provider custom callback has direct access to Drizzle client
- Query guest list at auth time in middleware/session callback
- Store guest ID in JWT payload for subsequent requests
- All RSVP mutations verify guest ID matches authenticated session

This ensures:
- No extra round-trips to fetch authorized guest data
- D1 edge execution keeps latency <100ms
- Session token embeds authorization context (guest ID, events invited to)

---

## Summary of Decisions

| Category | Decision | Rationale |
|----------|----------|-----------|
| Authentication | Name-based lookup | MVP simplicity; QR code deferred |
| Meal Selection | Two options + dietary text field | Clean head count + flexibility |
| Deadline | Hard cutoff June 15, 2026 11:59 PM | Industry standard; clear catering cutoff |
| Post-Deadline Access | Read-only RSVP; full schedule/gallery access | Inform guests without frustrating them |
| Guest List | Pre-registered only; no dynamic adds | Data quality; matches couple's database |
| Error Handling | Generic "name not found" message | Prevent enumeration; reduce embarrassment |
| Performance | D1 edge + RSC + Suspense | <100ms auth, <3min RSVP, <5s schedule |
| Session | Auth.js JWT with guest ID | Standard pattern; integrates with next-auth |

