# Quick Fix for Vercel Migration Timeout

## Problem
Migrations timeout because Neon's connection pooler doesn't support advisory locks.

## Solution

### Step 1: Get Direct Connection String from Neon

1. Go to your Neon dashboard
2. Find your project → Settings → Connection Details
3. Copy the **Direct connection** string (NOT the pooled connection)
4. It should look like:
   ```
   postgresql://user:password@ep-xxx-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
   (Note: No `-pooler` in the hostname)

### Step 2: Add to Vercel Environment Variables

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add new variable:
   - **Name**: `DIRECT_DATABASE_URL`
   - **Value**: Your direct connection string from Step 1
   - **Environment**: Production, Preview, Development (all)
3. Save

### Step 3: Redeploy

The schema has been updated to use `directUrl` for migrations. After adding the environment variable, redeploy:

```bash
# Or just push a commit to trigger redeploy
git commit --allow-empty -m "chore: trigger redeploy with DIRECT_DATABASE_URL"
git push
```

## How It Works

- `DATABASE_URL` (pooled) - Used for regular queries (faster, connection pooling)
- `DIRECT_DATABASE_URL` (direct) - Used only for migrations (supports advisory locks)

Prisma automatically uses `directUrl` when running migrations, and `url` for everything else.

## Verification

After deployment, check the build logs. You should see:
```
✔ Applied migration `20250130000000_add_email_campaigns_tracking`
```

Instead of the timeout error.

