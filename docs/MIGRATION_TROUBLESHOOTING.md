# Migration Troubleshooting Guide

## Issue: Advisory Lock Timeout with Neon Pooler

### Problem
When deploying, migrations fail with:
```
Error: P1002
The database server was reached but timed out.
Timed out trying to acquire a postgres advisory lock
```

### Root Cause
Neon's connection pooler (`-pooler` in connection string) doesn't support PostgreSQL advisory locks, which Prisma uses during migrations.

### Solution

#### Option 1: Use Direct Connection for Migrations (Recommended)

For migrations, use a direct connection string (without `-pooler`):

1. **In your deployment environment (Vercel/CI)**, set a separate `DIRECT_DATABASE_URL`:
   ```
   DIRECT_DATABASE_URL=postgresql://user:password@ep-xxx-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
   (Note: Remove `-pooler` from the hostname)

2. **Update `prisma/schema.prisma`** to use direct connection for migrations:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
     directUrl = env("DIRECT_DATABASE_URL") // For migrations
   }
   ```

3. **In Vercel**, add `DIRECT_DATABASE_URL` environment variable with the direct connection string.

#### Option 2: Run Migration Manually

If the migration is already applied locally but deployment fails:

1. Check if migration was already applied:
   ```bash
   npx prisma migrate status
   ```

2. If migration shows as applied, mark it as resolved:
   ```bash
   npx prisma migrate resolve --applied "20250130000000_add_email_campaigns_tracking"
   ```

#### Option 3: Use Prisma Migrate Deploy with Direct Connection

In your build script, temporarily use direct connection:

```bash
# In package.json build script
DATABASE_URL=$DIRECT_DATABASE_URL npx prisma migrate deploy
```

### Verification

After applying the fix, verify:
```bash
npx prisma migrate status
```

Should show: "Database schema is up to date!"

### Current Migration Status

The migration `20250130000000_add_email_campaigns_tracking` includes:
- 4 new enums (CampaignStatus, CampaignType, SequenceStatus, EmailEventType)
- 4 new tables (campaigns, email_sequences, sequence_steps, email_events)
- Enhanced email_activities table with campaign/sequence links

### Quick Fix for Vercel Deployment

1. Go to Vercel project settings → Environment Variables
2. Add `DIRECT_DATABASE_URL` with direct connection (no pooler)
3. Update `prisma/schema.prisma` to use `directUrl` (see Option 1)
4. Redeploy

### Alternative: Skip Migration if Already Applied

If the migration was already applied manually or in a previous deployment:

```bash
# Mark as applied without running
npx prisma migrate resolve --applied "20250130000000_add_email_campaigns_tracking"
```

Then push the resolved state.



