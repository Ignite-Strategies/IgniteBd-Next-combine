# Neon Database Connection Setup

## Overview

This project uses Neon PostgreSQL with **two connection modes**:

1. **DATABASE_URL** (pooled) - For runtime queries via pgbouncer
2. **DIRECT_DATABASE_URL** (unpooled) - For Prisma migrations (bypasses pgbouncer)

## Why Two Connections?

Neon's connection pooler (pgbouncer) doesn't support PostgreSQL advisory locks, which Prisma migrations require. Therefore:
- **Runtime queries** → Use pooled connection (faster, more efficient)
- **Migrations** → Use direct connection (supports advisory locks)

## Schema Configuration

The `prisma/schema.prisma` is configured correctly:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")           // Pooled connection (runtime)
  directUrl = env("DIRECT_DATABASE_URL")    // Unpooled connection (migrations)
}
```

Prisma automatically uses:
- `directUrl` when running migrations (`prisma migrate deploy`, `prisma migrate dev`)
- `url` for all other operations (queries, client generation, etc.)

## Environment Variables

### Local Development (.env.local)

```bash
# Pooled connection - for runtime queries
DATABASE_URL="postgresql://neondb_owner:npg_EG2wV8XQWmek@ep-summer-firefly-ad0yaaju-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Unpooled connection - for migrations only
DIRECT_DATABASE_URL="postgresql://neondb_owner:npg_EG2wV8XQWmek@ep-summer-firefly-ad0yaaju.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

**Note:** The only difference is:
- Pooled: `-pooler` in hostname → `ep-summer-firefly-ad0yaaju-**pooler**.c-2...`
- Unpooled: No `-pooler` in hostname → `ep-summer-firefly-ad0yaaju.c-2...`

### Vercel Environment Variables

Set both variables in Vercel Dashboard → Settings → Environment Variables:

1. **DATABASE_URL** - Pooled connection string (with `-pooler`)
2. **DIRECT_DATABASE_URL** - Unpooled connection string (without `-pooler`)

## Running Migrations

### Local Development

Prisma CLI loads from `.env` by default, but Next.js uses `.env.local` at runtime.

**Option 1: Export variables before running**
```bash
export $(cat .env.local | grep -E '^(DATABASE_URL|DIRECT_DATABASE_URL)=' | xargs)
npx prisma migrate deploy
```

**Option 2: Use the migration script (recommended)**
```bash
npm run migrate
# This uses scripts/migrate-deploy.js which handles DIRECT_DATABASE_URL
```

**Option 3: Add to .env file**
If you prefer Prisma CLI to use the same vars, also add them to `.env` (but keep `.env.local` for Next.js)

### Production/Vercel

The `migrate-deploy.js` script (used in `npm run migrate`) automatically:
- Uses `DIRECT_DATABASE_URL` if available (for migrations)
- Falls back to `DATABASE_URL` if `DIRECT_DATABASE_URL` is not set
- Logs which connection is being used

Build command in Vercel should use:
```bash
npm run migrate && npm run build
```

Or if using `build:full`:
```bash
npm run build:full  # Runs: prisma generate && npm run migrate && npm run build
```

## Sandbox Project

The `ignitebd-sandbox` project:
- Only needs `DATABASE_URL` (pooled)
- Does NOT run migrations (schema comments explicitly state this)
- Uses the same pooled connection string

## Troubleshooting

### Migration Timeout Errors (P1001)

If you see connection timeout errors during migrations:
- ✅ Ensure `DIRECT_DATABASE_URL` is set (unpooled connection)
- ✅ Verify the connection string does NOT have `-pooler` in the hostname
- ✅ Check that both variables are set in Vercel environment variables

### Validation Errors

If `npx prisma validate` fails with "DIRECT_DATABASE_URL not found":
- Prisma CLI loads from `.env` by default
- Either export the variables or add them to `.env`
- Next.js runtime will use `.env.local` automatically

## Summary

✅ **Keep both connections:**
- `DATABASE_URL` = pooled (with `-pooler`) → Runtime queries
- `DIRECT_DATABASE_URL` = unpooled (no `-pooler`) → Migrations

✅ **Schema is correct:**
- Both `url` and `directUrl` are configured in `schema.prisma`
- Prisma automatically selects the right connection

✅ **Migration script handles it:**
- `scripts/migrate-deploy.js` uses `DIRECT_DATABASE_URL` when available
- Used via `npm run migrate` in build process

