# Migration Guide

## Overview

This document covers database migrations, schema updates, and data cleanup procedures for IgniteBD.

---

## Auth Normalization Migration

### What Was Done

1. ✅ **Schema Updated** - Added `clientPortalUrl` field to Contact model
2. ✅ **Database Synced** - Ran `prisma db push` to add new fields
3. ✅ **Data Migrated** - Ran `migrateNotesToAuth.js` to backfill:
   - Extracted `firebaseUid` from `notes.clientPortalAuth` → `firebaseUid` field
   - Extracted `portalUrl` from `notes.clientPortalAuth` → `clientPortalUrl` field
   - **Cleaned notes JSON** - Removed `clientPortalAuth` from notes

### Results

- ✅ **1 contact migrated**: `joel.gulick@businesspointlaw.com`
- ✅ **firebaseUid**: `gGkeaOGm...` (now in proper field)
- ✅ **notes cleaned**: No more `clientPortalAuth` JSON

### Verification

Check your database:
```sql
SELECT email, "firebaseUid", "clientPortalUrl", notes 
FROM contacts 
WHERE "firebaseUid" IS NOT NULL;
```

Expected:
- ✅ `firebaseUid` is filled
- ✅ `clientPortalUrl` is filled  
- ✅ `notes` does NOT contain `clientPortalAuth`

### Going Forward

All new invites will:
- ✅ Write to `firebaseUid` field (NOT notes)
- ✅ Write to `clientPortalUrl` field (NOT notes)
- ✅ Keep `notes` clean for actual notes/context

---

## Running Prisma Migrations

### Option 1: Copy DATABASE_URL from Vercel to Local

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

### Option 2: Run Migration with DATABASE_URL in Command

```bash
DATABASE_URL="your-database-url-from-vercel" npx prisma migrate dev --name add_client_portal_auth_fields
```

Or use the script:
```bash
DATABASE_URL="your-database-url-from-vercel" ./scripts/runMigration.sh
```

### Option 3: Use Vercel CLI (if installed)

```bash
# Pull env vars from Vercel
vercel env pull .env.local

# Run migration
npx prisma migrate dev --name add_client_portal_auth_fields
```

### After Migration: Run Backfill Script

```bash
# Make sure DATABASE_URL is set
DATABASE_URL="your-database-url" node scripts/migrateNotesToAuth.js
```

This will:
- ✅ Move `firebaseUid` from notes JSON → `firebaseUid` field
- ✅ Move `portalUrl` from notes JSON → `clientPortalUrl` field  
- ✅ **Clean notes JSON** (remove `clientPortalAuth`)

### Verify

```sql
SELECT email, "firebaseUid", "clientPortalUrl", notes 
FROM contacts 
WHERE "firebaseUid" IS NOT NULL;
```

Expected: `firebaseUid` and `clientPortalUrl` are filled, `notes` no longer contains `clientPortalAuth`.

---

## Clean Up Notes JSON

### Problem

The `notes` field still contains `clientPortalAuth` JSON data that should be in proper Prisma fields.

### ✅ Verification: Are we updating the right contactId?

**YES** - The API route uses:
```javascript
await prisma.contact.update({
  where: { id: contactId },  // ✅ Using contactId from request body
  data: {
    firebaseUid: firebaseUser.uid,
    clientPortalUrl: clientPortalUrl,
  },
});
```

The `contactId` comes from the request body and is validated against the contact's email.

### 🔧 Steps to Clean Up

#### Step 1: Run Prisma Migration
```bash
# Make sure DATABASE_URL is set in .env.local
npx prisma migrate dev --name add_client_portal_auth_fields
```

This adds:
- `firebaseUid String? @unique`
- `clientPortalUrl String? @default("https://clientportal.ignitegrowth.biz")`
- `isActivated Boolean @default(false)`
- `activatedAt DateTime?`

#### Step 2: Run Migration Script
```bash
node scripts/migrateNotesToAuth.js
```

This script:
- ✅ Extracts `clientPortalAuth.firebaseUid` → `firebaseUid` field
- ✅ Extracts `clientPortalAuth.portalUrl` → `clientPortalUrl` field
- ✅ **Removes `clientPortalAuth` from notes JSON**
- ✅ Keeps other notes data intact

#### Step 3: Verify Cleanup
```sql
SELECT 
  id,
  email,
  "firebaseUid",
  "clientPortalUrl",
  notes,
  "isActivated"
FROM contacts
WHERE "firebaseUid" IS NOT NULL;
```

**Expected:**
- ✅ `firebaseUid` is filled
- ✅ `clientPortalUrl` is filled
- ✅ `notes` does NOT contain `clientPortalAuth` JSON

#### Alternative: Manual SQL Cleanup

If you prefer SQL, run `scripts/cleanNotesSQL.sql` directly in your database.

### 🎯 After Cleanup

All new invites will:
- ✅ Write to `firebaseUid` field (NOT notes)
- ✅ Write to `clientPortalUrl` field (NOT notes)
- ✅ Keep `notes` clean for actual notes/context

---

## Migration Checklist

### Before Migration
- [ ] Backup database
- [ ] Review schema changes
- [ ] Test migration script on local database
- [ ] Verify environment variables are set

### During Migration
- [ ] Run Prisma migration
- [ ] Run data migration script
- [ ] Verify data integrity

### After Migration
- [ ] Verify all contacts have proper fields
- [ ] Check that notes JSON is clean
- [ ] Test API routes that use new fields
- [ ] Update any code that references old structure

---

## Common Migration Issues

### Issue: Migration fails with "relation already exists"
**Cause:** Field already exists in database  
**Fix:** Check if migration was already run, or manually drop the field first

### Issue: Data migration script fails
**Cause:** Invalid JSON in notes field  
**Fix:** Add error handling for malformed JSON, skip those records

### Issue: Missing environment variables
**Cause:** DATABASE_URL not set  
**Fix:** Set DATABASE_URL in .env.local or pass as environment variable

---

## Related Documentation

- **`docs/AUTHENTICATION.md`** - Complete authentication guide
- **`docs/CLIENT_OPERATIONS.md`** - Client operations guide
- **`scripts/migrateNotesToAuth.js`** - Migration script

---

**Last Updated**: November 2025  
**Status**: ✅ Auth Normalization Complete  
**Next Steps**: Monitor for any edge cases, update client portal if needed



