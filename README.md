[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?logo=next.js)](./package.json)
[![ESLint](https://img.shields.io/badge/ESLint-enabled-blue?logo=eslint)](./eslint.config.js)
[![Prettier](https://img.shields.io/badge/Prettier-enabled-blue?logo=prettier)](./prettier.config.js)
[![TypeScript](https://img.shields.io/badge/TypeScript-enabled-blue?logo=typescript)](./tsconfig.json)

## Setup

Install dependencies:

```bash
npm install
```

### Local Database

Set up the local SQLite database with migrations and seed data:

```bash
npm run db:migrate:local  # Apply database migrations
npm run db:seed:local    # Seed guest and invitation data
npm run db:seed:test-data   # Seed test fixtures for integration testing (tests/fixtures/test-data.sql)
```

### Production Database

To seed guest data to the production D1 database (after tables have been created):

```bash
npm run db:seed:d1
```

### Schema Changes

After modifying the database schema in `src/lib/db/schema.ts`, generate a new migration:

```bash
npm run db:generate
```

This creates a new SQL migration file in `migrations/`. Apply it with:

```bash
npm run db:migrate:local   # Local
npm run db:migrate:d1      # Production (requires --remote flag)
```

## Develop

Run the Next.js development server:

```bash
npm run dev
```
