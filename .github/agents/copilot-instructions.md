# chrisandkatie.net Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-26

## Active Technologies
- TypeScript with Next.js v16 (App Router) and React v19 + Auth.js (next-auth v5), Drizzle ORM with Cloudflare D1 SQL adapter, Zod for validation, react-hook-form for form handling, Tailwind CSS for styling (001-wedding-rsvp-portal)
- Cloudflare D1 (SQLite) with Drizzle ORM (001-wedding-rsvp-portal)
- TypeScript 5 / Next.js 16 App Router / React 19 + NextAuth v5, Drizzle ORM, Tailwind CSS, Vitest, Zod (001-admin-rsvp)
- Cloudflare D1 (SQLite) via Drizzle — no new tables or migrations (001-admin-rsvp)
- TypeScript (via Next.js 16.1.6) + Next.js 16 (App Router), React 19, Drizzle ORM 0.44, Next-Auth 5.0 beta, Zod 4.3, React Hook Form 7.71, TanStack Table 8.21 (002-event-dashboard)
- Cloudflare D1 (SQLite) via Drizzle ORM with existing schema (002-event-dashboard)
- TypeScript 5 / Next.js v16 (App Router) / React v19 + Next.js Auth v5, Drizzle ORM, `crypto.randomUUID()` (003-admin-layout-events-db)
- SQLite (local dev via Drizzle), Cloudflare D1 (production) (003-admin-layout-events-db)
- TypeScript 5.x — Next.js 16, React 19 + Next.js Auth v5 (`next-auth`), Drizzle ORM, Cloudflare D1 (SQLite) (001-fix-rsvp-login-bugs)
- SQLite via Cloudflare D1 — no schema changes required (001-fix-rsvp-login-bugs)
- TypeScript 5, Node.js 20 (Cloudflare Workers runtime) + Next.js 16.1.6 (App Router), React 19, Auth.js v5 (next-auth), Drizzle ORM, Zod v4, Vitest v4 (001-invitation-code)
- SQLite (local dev via Drizzle) / Cloudflare D1 (production) (001-invitation-code)
- TypeScript 5.x + Next.js 16 (App Router), React 19, Next Auth v5 (`next-auth@^5.0.0-beta.30`), Drizzle ORM 0.44, Zod 4, react-hook-form 7, Vitest 4 (004-invitation-auth-refactor)
- Cloudflare D1 (SQLite) via Drizzle ORM — no schema changes (004-invitation-auth-refactor)
- TypeScript 5.x + Next.js v16 (App Router), React v19, Drizzle ORM, Zod, react-hook-form, @hookform/resolvers/zod (001-event-rsvp)
- SQLite (local dev) / Cloudflare D1 (production) via Drizzle ORM (001-event-rsvp)

- TypeScript 5.9, React 19, Next.js 16.1 + Next.js App Router, Auth.js v5, Drizzle ORM + D1 adapter, Zod, react-hook-form, Tailwind CSS, OpenNext (Cloudflare) (001-wedding-rsvp-portal)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.9, React 19, Next.js 16.1: Follow standard conventions

## Recent Changes
- 001-event-rsvp: Added TypeScript 5.x + Next.js v16 (App Router), React v19, Drizzle ORM, Zod, react-hook-form, @hookform/resolvers/zod
- 004-invitation-auth-refactor: Added TypeScript 5.x + Next.js 16 (App Router), React 19, Next Auth v5 (`next-auth@^5.0.0-beta.30`), Drizzle ORM 0.44, Zod 4, react-hook-form 7, Vitest 4
- 004-invitation-auth-refactor: Added TypeScript 5.x + Next.js 16 (App Router), React 19, Next Auth v5 (`next-auth@^5.0.0-beta.30`), Drizzle ORM 0.44, Zod 4, react-hook-form 7, Vitest 4


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
