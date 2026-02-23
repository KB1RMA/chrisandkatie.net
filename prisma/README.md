# Database Setup with Prisma 7 and Driver Adapters

## Local Development (SQLite)

Prisma 7 with driver adapters (`@prisma/adapter-libsql`) has a quirk: `prisma migrate` and `prisma db push` don't work properly because they don't use the adapter layer. Instead, migration SQL must be applied manually using `sqlite3`.

### Workflow

1. **Create a new migration** (generates SQL but doesn't apply it):
   ```bash
   npm run db:migrate:create
   ```

2. **Apply the latest migration** (manually runs SQL):
   ```bash
   npm run db:migrate:apply
   ```

3. **Complete setup from scratch** (reset database and seed):
   ```bash
   npm run db:setup
   ```

4. **Seed guest data**:
   ```bash
   npm run db:seed
   ```

### Why This Is Necessary

- Prisma CLI commands run without the adapter layer
- `@prisma/adapter-libsql` only works at runtime with Prisma Client
- Direct `sqlite3` commands bypass Prisma and modify the database file directly

## Production (Cloudflare D1)

For production, use Wrangler's migration commands which properly interact with D1:

```bash
# Apply migrations to remote D1 database
wrangler d1 migrations apply prisma-demo-db --remote

# Seed remote database
npm run db:seed:remote
```

## Database Schema

The database includes:
- **Auth.js models**: User, Account, Session, VerificationToken
- **Guest model**: Wedding guest list with name, address, and event visibility settings

All guests have `visibleEvents` set to `"[0,1,2,3]"` by default (all events visible).
