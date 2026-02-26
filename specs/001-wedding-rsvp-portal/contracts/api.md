# API Contracts: Wedding RSVP Portal

**Date**: February 26, 2026  
**Branch**: `001-wedding-rsvp-portal`

## Overview

This document defines the request/response contracts for all APIs used by the Wedding RSVP Portal. The application is built entirely on Next.js App Router with server actions and route handlers operating on Cloudflare Workers edge runtime.

All responses follow JSON format with consistent error handling patterns. Dates use ISO 8601 format; times use 24-hour HH:MM format.

---

## Authentication Contracts

### POST /api/auth/signin (next-auth)

**Purpose**: Authenticate guest by first and last name

**Request**:
```typescript
interface LoginRequest {
  firstName: string;           // Min 1 char, trimmed
  lastName: string;            // Min 1 char, trimmed
  redirect?: boolean;          // Optional redirect after signin
  callbackUrl?: string;        // Optional return URL after signin
}
```

**Success Response (200)**:
```typescript
interface LoginResponse {
  url: string;                 // Redirect URL (typically "/rsvp")
  ok: boolean;
  error?: null;
}
```

**Error Response (401)**:
```typescript
interface LoginErrorResponse {
  error: string;               // "CredentialsSignin" or similar
  status: 401;
  ok: false;
}

// Example:
{
  "error": "Guest not found. Please check the spelling of your name.",
  "status": 401,
  "ok": false
}
```

**Side Effects**:
- Sets secure httpOnly cookie with session token
- Logs authentication attempt (server-side only)
- No email sent (name-based, no external verification)

**Rate Limiting**: Recommended max 10 login attempts per IP per 5 minutes

---

## RSVP Data Contracts

### Server Action: submitRsvp()

**Purpose**: Submit or update RSVP for a specific event

**Input**:
```typescript
interface SubmitRsvpInput {
  guestId: number;             // Current guest ID (from session)
  eventId: number;             // Event being RSVP'd for
  attendanceStatus: 'attending' | 'not_attending';
  attendees: AttendeeInput[];  // List of attendees (empty if not_attending)
  specialRequests?: string;    // Optional notes
}

interface AttendeeInput {
  name: string;                // Must match pre-registered guest name
  mealOption: 'option_a' | 'option_b';
  dietaryRestrictions?: string; // Free-form text (allergies, etc.)
}
```

**Output (Success)**:
```typescript
interface RsvpResponseOutput {
  id: number;
  guestId: number;
  eventId: number;
  attendanceStatus: 'attending' | 'not_attending';
  numberOfAttending: number;
  specialRequests: string | null;
  attendees: AttendeeOutput[];
  submittedAt: string;         // ISO 8601 datetime
  updatedAt: string;           // ISO 8601 datetime
}

interface AttendeeOutput {
  id: number;
  name: string;
  mealOption: 'option_a' | 'option_b';
  dietaryRestrictions: string | null;
  sortOrder: number;
}

// Example:
{
  "id": 42,
  "guestId": 1,
  "eventId": 5,
  "attendanceStatus": "attending",
  "numberOfAttending": 2,
  "specialRequests": null,
  "attendees": [
    {
      "id": 123,
      "name": "John Smith",
      "mealOption": "option_a",
      "dietaryRestrictions": null,
      "sortOrder": 0
    },
    {
      "id": 124,
      "name": "Jane Smith",
      "mealOption": "option_b",
      "dietaryRestrictions": "Vegetarian",
      "sortOrder": 1
    }
  ],
  "submittedAt": "2026-02-26T14:30:00Z",
  "updatedAt": "2026-02-26T14:30:00Z"
}
```

**Error Cases**:

**Unauthorized (401)**:
```typescript
{
  "error": "Unauthorized: Session not found",
  "code": "UNAUTHORIZED"
}
```

**Guest Mismatch (403)**:
```typescript
{
  "error": "Forbidden: Guest ID mismatch",
  "code": "FORBIDDEN"
}
```

**Validation Error (400)**:
```typescript
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "attendees.0.name",
      "message": "Name not found in invitation guest list"
    },
    {
      "field": "numberOfAttending",
      "message": "Cannot exceed invitation max guests (2)"
    }
  ]
}
```

**Deadline Passed (400)**:
```typescript
{
  "error": "RSVP deadline has passed (June 15, 2026 11:59 PM UTC)",
  "code": "DEADLINE_PASSED"
}
```

**Validation Rules**:
- If `attendanceStatus` = "not_attending", `attendees` must be empty → error if not
- If `attendanceStatus` = "attending", `attendees` must have ≥1 item → error if empty
- `attendees.length` must be ≤ `invitation.maxGuests` → error if exceeded
- Each attendee `name` must match pre-registered guest (exact match, case-insensitive) → error with suggestions
- `mealOption` must be one of [option_a, option_b] → error if invalid
- Must be before June 15, 2026 11:59:59 PM UTC → error with deadline message

---

### Server Action: retrieveRsvp()

**Purpose**: Fetch current RSVP for a guest-event pair (for view/edit)

**Input**:
```typescript
interface RetrieveRsvpInput {
  guestId: number;
  eventId: number;
}
```

**Output (Success, 200)**:
```typescript
interface RetrieveRsvpOutput {
  rsvp: RsvpResponseOutput | null; // null if no RSVP yet
  event: EventOutput;
  guests: GuestOutput[];           // All guests on invitation (for form rendering)
  deadlineReached: boolean;        // true if June 15, 2026 11:59 PM has passed
}

interface EventOutput {
  id: number;
  name: string;
  description: string | null;
  location: string | null;
  eventDate: string;               // YYYY-MM-DD
  eventTime: string;               // HH:MM
  type: 'main' | 'rehearsal' | 'brunch' | 'other';
}

interface GuestOutput {
  id: number;
  firstName: string;
  lastName: string;
}
```

**Example**:
```json
{
  "rsvp": null,
  "event": {
    "id": 5,
    "name": "Main Wedding Ceremony & Reception",
    "description": "Join us for the ceremony and celebration",
    "location": "Central Park Pavilion, New York",
    "eventDate": "2026-06-27",
    "eventTime": "18:00",
    "type": "main"
  },
  "guests": [
    { "id": 1, "firstName": "John", "lastName": "Smith" },
    { "id": 2, "firstName": "Jane", "lastName": "Smith" }
  ],
  "deadlineReached": false
}
```

**Error Cases**: Same as submitRsvp (401, 403)

---

## Schedule/Event Contracts

### Server Component: fetchSchedule()

**Purpose**: Load all events for authenticated guest's dashboard

**Input**:
```typescript
interface FetchScheduleInput {
  guestId: number;
}
```

**Output**:
```typescript
interface FetchScheduleOutput {
  events: ScheduleEventOutput[];
  currentEvent?: ScheduleEventOutput; // Set if event is happening now
}

interface ScheduleEventOutput {
  id: number;
  name: string;
  description: string | null;
  location: string | null;
  eventDate: string;               // YYYY-MM-DD
  eventTime: string;               // HH:MM
  duration: number | null;         // minutes
  dressCode: string | null;
  parkingInfo: string | null;
  type: 'main' | 'rehearsal' | 'brunch' | 'other';
  rsvpStatus?: 'attending' | 'not_attending' | 'not_responded';
}

// Example:
[
  {
    "id": 5,
    "name": "Main Wedding Ceremony & Reception",
    "description": "Ceremony at 6 PM, followed by cocktails and dinner",
    "location": "Central Park Pavilion, New York, NY 10024",
    "eventDate": "2026-06-27",
    "eventTime": "18:00",
    "duration": 240,
    "dressCode": "Black tie optional",
    "parkingInfo": "Valet parking available. Street parking on Park Ave South.",
    "type": "main",
    "rsvpStatus": "attending"
  }
]
```

**Ordering**: By `eventDate`, then `eventTime` (chronological)

**Current Event Logic**: Set if current time is between event start and end (start < now < start + duration)

---

## Gallery Contracts

### Server Component: fetchPhotos()

**Purpose**: Load all gallery photos, optionally filtered by album

**Input**:
```typescript
interface FetchPhotosInput {
  album?: string; // Optional filter by album name
  limit?: number; // Optional pagination (default 50)
  offset?: number; // Optional pagination (default 0)
}
```

**Output**:
```typescript
interface FetchPhotosOutput {
  photos: PhotoOutput[];
  albums: string[];            // List of all available albums
  total: number;               // Total photo count (before pagination)
}

interface PhotoOutput {
  id: number;
  imageUrl: string;
  caption: string | null;
  description: string | null;
  dateTaken: string | null;    // YYYY-MM-DD or null
  milestone: string | null;    // e.g., "First date", "Engagement"
  album: string | null;
  sortOrder: number;
}

// Example:
{
  "photos": [
    {
      "id": 1,
      "imageUrl": "https://cdn.example.com/wedding-photos/01.jpg?w=800",
      "caption": "Our first date",
      "description": "Coffee shop on 5th Avenue",
      "dateTaken": "2018-03-15",
      "milestone": "First date",
      "album": "Early Days",
      "sortOrder": 0
    },
    {
      "id": 2,
      "imageUrl": "https://cdn.example.com/wedding-photos/02.jpg?w=800",
      "caption": "The proposal",
      "description": "At the top of the Empire State Building",
      "dateTaken": "2023-12-24",
      "milestone": "Engagement",
      "album": "Engagement",
      "sortOrder": 0
    }
  ],
  "albums": ["Early Days", "Engagement", "Pre-Wedding"],
  "total": 47
}
```

**Ordering**: By `dateTaken DESC` (newest first), then `sortOrder ASC`, then `id DESC`

**Image Optimization**: All `imageUrl` values use query params for size (e.g., `?w=800` for web, `?w=1200` for full-size modal)

---

## Admin Endpoints (Out of Scope)

These are documented for future reference but NOT implemented in the guest-facing feature:

- `GET /api/admin/rsvp/summary` - Head counts and meal breakdown
- `PATCH /api/admin/event/:eventId` - Update event details
- `POST /api/admin/batch-import` - Import guest list from CSV

---

## Error Handling Standard

All error responses follow a consistent format:

```typescript
interface ErrorResponse {
  error: string;                   // User-friendly message
  code: string;                    // Machine-readable code (UNAUTHORIZED, VALIDATION_ERROR, etc.)
  status: number;                  // HTTP status code
  details?: ErrorDetail[];         // Optional array of field-level errors
  timestamp: string;               // ISO 8601 when error occurred
}

interface ErrorDetail {
  field: string;
  message: string;
  code?: string;                   // Optional error code for field
}
```

**Common Status Codes**:
- `200` - Success
- `400` - Validation error (bad input)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (logged in but not authorized)
- `404` - Not found (resource doesn't exist)
- `500` - Server error (unexpected failure)

---

## Performance & Caching

**Cache Headers**:
- `/schedule` - 5-minute cache (static schedule)
- `/gallery` - 1-hour cache (rarely changed)
- RSVP endpoints - No caching (user-specific data)

**Response Time SLOs**:
- Login: <500ms (name lookup in D1)
- RSVP submit: <1000ms (insert + email if added later)
- Schedule fetch: <500ms (indexed query)
- Gallery: <500ms (50 photos)

---

## Security

**Authentication**:
- All endpoints require valid next-auth session (except GET /login)
- Session stored in secure, httpOnly, SameSite=Lax cookie
- CSRF protection via next-auth built-in

**Authorization**:
- Guest can only access/modify their own RSVP data
- Guest ID from session token must match request
- No cross-guest data exposure (even in error messages)

**Input Validation**:
- All name inputs trimmed and sanitized
- All dates validated as ISO 8601
- All enum values checked against allowed list
- Zod schemas enforced server-side before DB writes

**Output Sanitization**:
- No internal DB IDs exposed in error messages
- No sensitive timing information leaked (e.g., "25 people already RSVP'd")
- No guest names visible to other guests (privacy)

---

## Summary Table

| Endpoint/Action | Purpose | Request | Response | Error Codes |
|-----------------|---------|---------|----------|------------|
| POST /api/auth/signin | Guest authentication | firstName, lastName | JWT + cookie | 401 (not found) |
| submitRsvp | Submit/update RSVP | guestId, eventId, attendance, attendees | RsvpResponseOutput | 400, 401, 403 |
| retrieveRsvp | Fetch RSVP for edit | guestId, eventId | RsvpResponseOutput + event + guests | 401, 403 |
| fetchSchedule | Load event schedule | guestId | ScheduleEventOutput[] | 401, 403 |
| fetchPhotos | Load gallery | (album?) | PhotoOutput[] + albums | 401 |

