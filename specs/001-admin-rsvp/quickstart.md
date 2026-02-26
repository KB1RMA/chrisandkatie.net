# Quickstart: Admin RSVP Management

**Branch**: `001-admin-rsvp`  
**Date**: February 26, 2026

---

## Prerequisites

- Node.js ≥ 20 (via `nvm` or system install)
- `npm` ≥ 10
- Wrangler CLI: `npm install -g wrangler`
- A Cloudflare account (for production deploys; not needed for local development)

---

## Local Development Setup

### 1. Clone and install

```bash
git clone <repo-url> chrisandkatie.net
cd chrisandkatie.net
git checkout 001-admin-rsvp
npm install
```

### 2. Configure environment variables

Copy the local development env file and add admin credentials:

```bash
cp .dev.vars.example .dev.vars    # or create .dev.vars if it doesn't exist
```

Add these two variables to `.dev.vars`:

```ini
ADMIN_USERNAME=<your-admin-username>
ADMIN_PASSWORD=<your-admin-password>
```

> **Note**: The admin login form reuses the guest name fields. `ADMIN_USERNAME` is entered as "First Name" and `ADMIN_PASSWORD` as "Last Name" on the `/login` page. These values are never stored in the database.

### 3. Run database migrations

```bash
npm run db:migrate
```

No new migrations are needed for this feature (no schema changes). This ensures the local D1 database is at the latest schema before testing.

### 4. Start the development server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

---

## Accessing the Admin Area

1. Navigate to [http://localhost:3000/login](http://localhost:3000/login)
2. Enter your `ADMIN_USERNAME` in the **First Name** field
3. Enter your `ADMIN_PASSWORD` in the **Last Name** field
4. Submit — you will be redirected to `/admin/rsvp` (the RSVP dashboard)

The admin tabs navigation will show: **Invitations** | **Guests** | **RSVPs**

---

## New Admin Pages

| URL | Description |
|-----|-------------|
| `/admin/rsvp` | RSVP summary dashboard — headcounts and meal breakdowns per event |
| `/admin/rsvp/[eventId]` | Per-event guest list with individual RSVP statuses |
| `/admin/guests/[guestId]` | Guest RSVP detail view |
| `/admin/guests/[guestId]/edit` | Edit a guest's RSVP on their behalf |

---

## Running Tests

```bash
npm run test          # run all tests
npm run test:coverage # run with coverage report
```

Tests covering the new server actions and auth type checks live in `tests/`.

---

## Linting and Type Checking

```bash
npm run lint          # ESLint
npm run type-check    # TypeScript
```

Both must pass before a PR is opened.

---

## Production Deployment

Admin credentials must be set as Cloudflare Workers secrets before deploying:

```bash
wrangler secret put ADMIN_USERNAME
wrangler secret put ADMIN_PASSWORD
```

Deploy:

```bash
npm run deploy
```
