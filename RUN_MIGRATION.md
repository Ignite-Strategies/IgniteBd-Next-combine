# 🚀 Run Prisma Migration for app.ignitegrowth.biz

## Option 1: Copy DATABASE_URL from Vercel to Local

1. Go to Vercel Dashboard → Your Project (`app.ignitegrowth.biz`) → Settings → Environment Variables
2. Copy the `DATABASE_URL` value
3. Create/update `.env.local`:
   ```bash
   DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"
   ```
4. Run migration:
   ```bash
   npx prisma migrate dev --name add_client_portal_auth_fields
   ```

## Option 2: Run Migration with DATABASE_URL in Command

```bash
DATABASE_URL="your-database-url-from-vercel" npx prisma migrate dev --name add_client_portal_auth_fields
```

Or use the script:
```bash
DATABASE_URL="your-database-url-from-vercel" ./scripts/runMigration.sh
```

## Option 3: Use Vercel CLI (if installed)

```bash
# Pull env vars from Vercel
vercel env pull .env.local

# Run migration
npx prisma migrate dev --name add_client_portal_auth_fields
```

## After Migration: Run Backfill Script

```bash
# Make sure DATABASE_URL is set
DATABASE_URL="your-database-url" node scripts/migrateNotesToAuth.js
```

This will:
- ✅ Move `firebaseUid` from notes JSON → `firebaseUid` field
- ✅ Move `portalUrl` from notes JSON → `clientPortalUrl` field  
- ✅ **Clean notes JSON** (remove `clientPortalAuth`)

## Verify

```sql
SELECT email, "firebaseUid", "clientPortalUrl", notes 
FROM contacts 
WHERE "firebaseUid" IS NOT NULL;
```

Expected: `firebaseUid` and `clientPortalUrl` are filled, `notes` no longer contains `clientPortalAuth`.

