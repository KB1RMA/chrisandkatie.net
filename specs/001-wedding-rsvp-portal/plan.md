# Implementation Plan: Wedding RSVP Portal

**Branch**: `001-wedding-rsvp-portal` | **Date**: February 26, 2026 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-wedding-rsvp-portal/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

The Wedding RSVP Portal is a guest-facing web application that guides invited guests through the RSVP process for a wedding and additional events, provides a schedule reference, and displays a photo gallery. The system uses name-based authentication with a pre-loaded guest list, collects meal selections and dietary restrictions, enforces a hard RSVP deadline (June 15, 2026), and uses React Server Components with Suspense for a modern experience on Next.js with Cloudflare Workers serverless deployment.

## Technical Context

**Language/Version**: TypeScript with Next.js v16 (App Router) and React v19  
**Primary Dependencies**: Auth.js (next-auth v5), Drizzle ORM with Cloudflare D1 SQL adapter, Zod for validation, react-hook-form for form handling, Tailwind CSS for styling  
**Storage**: Cloudflare D1 (SQLite) with Drizzle ORM  
**Testing**: Vitest with React Testing Library (based on existing project configuration)  
**Target Platform**: Cloudflare Workers (Edge runtime via next-on-pages/open-next configuration)  
**Project Type**: Full-stack web application using Next.js App Router with server and client components  
**Performance Goals**: Sub-3-minute RSVP completion time; 100-250 concurrent users during peak periods; schedule page loads within 5 seconds  
**Constraints**: RSVP modifications only until June 15, 2026 11:59 PM; name-based authentication requires exact guest list pre-load; mobile-first responsive design required  
**Scale/Scope**: ~100-250 invited guests; 10+ pages (auth, RSVP form, schedule, gallery, admin views); estimated 30-40 database queries per RSVP flow

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- ✅ Framework-led delivery confirmed (Next.js App Router conventions for pages, components, API routes, and auth)
- ✅ Functional core approach identified: Pure RSVP calculation logic, data transformation utilities, and sealed form validation with Zod; side effects isolated to server actions and API routes
- ✅ Specification-first scope is concise and traceable: 4 prioritized user stories with acceptance scenarios, 36 functional requirements, 10 success criteria, 5 edge cases resolved
- ✅ Simplicity check passes: No premature abstraction; shared utilities will only be introduced after 3 similar uses; form handling unified via react-hook-form + Zod
- ✅ Quality gates defined: ESLint, Prettier v3, TypeScript strict mode, Vitest for unit and integration tests; no test expansion requested in spec

**GATE RESULT: PASS** - All core principles validated. No violations requiring complexity justification.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx              # Guest login page (name-based auth)
│   ├── rsvp/
│   │   ├── layout.tsx                # Protected RSVP layout
│   │   ├── page.tsx                  # Main RSVP dashboard
│   │   ├── wedding/
│   │   │   └── page.tsx              # Wedding RSVP form
│   │   ├── [eventId]/
│   │   │   └── page.tsx              # Individual event RSVP form
│   │   └── actions.ts                # Server actions for RSVP submission
│   ├── schedule/
│   │   ├── page.tsx                  # Event schedule page
│   │   └── actions.ts                # Server actions for schedule queries
│   ├── gallery/
│   │   └── page.tsx                  # Photo gallery
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts          # Auth.js configuration
│   │   └── rsvp/
│   │       ├── submit/
│   │       │   └── route.ts          # RSVP submission API
│   │       └── retrieve/
│   │           └── route.ts          # RSVP retrieval API
│   └── layout.tsx                     # Root layout with providers
├── components/
│   ├── RSVPForm.tsx                  # Reusable RSVP form component
│   ├── EventSelector.tsx             # Event selection UI
│   ├── MealOptions.tsx               # Meal preference selector
│   ├── ScheduleCard.tsx              # Schedule event card
│   ├── PhotoGallery.tsx              # Gallery grid component
│   ├── LoginForm.tsx                 # Authentication form (updated)
│   ├── auth/
│   │   ├── ProtectedLayout.tsx       # Client-side auth guard
│   │   └── SessionProvider.tsx       # Auth.js session provider
│   └── admin/                        # Out of scope for this spec
├── lib/
│   ├── auth.ts                       # Auth.js configuration (updated)
│   ├── db.ts                         # Drizzle client instance
│   ├── rsvp.ts                       # RSVP business logic (pure functions)
│   ├── constants.ts                  # RSVP deadline, meal options, etc.
│   ├── email.ts                      # Optional: email notifications
│   ├── schemas/
│   │   ├── rsvp.ts                   # Zod schema for RSVP validation
│   │   ├── attendance.ts             # Attendance selection schema
│   │   └── login.ts                  # Login form schema
│   └── db/
│       └── schema.ts                 # Drizzle schema (updated with Event, RSVP, Attendee tables)
```

**Structure Decision**: Single Next.js App Router project following framework conventions. All RSVP flows use protected layouts with Next.js Auth middleware. Server components and Suspense handle async data loading. Form validation unified via Zod schemas consumed by react-hook-form and server actions.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
