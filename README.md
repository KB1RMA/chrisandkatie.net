[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?logo=next.js)](./package.json)
[![ESLint](https://img.shields.io/badge/ESLint-enabled-blue?logo=eslint)](./eslint.config.js)
[![Prettier](https://img.shields.io/badge/Prettier-enabled-blue?logo=prettier)](./prettier.config.js)
[![TypeScript](https://img.shields.io/badge/TypeScript-enabled-blue?logo=typescript)](./tsconfig.json)

## Setup

Install dependencies (this will automatically generate the Prisma client):

```bash
npm install
```

Set up the local database:

```bash
npm run db:setup
```

This will create the SQLite database, apply migrations, and seed data.

## Develop

Run the Next.js development server:

```bash
npm run dev
```
