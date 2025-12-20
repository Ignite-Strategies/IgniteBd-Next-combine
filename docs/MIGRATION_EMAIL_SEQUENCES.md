# Migration: Email Sequences & Campaign Contact Lists

**Date:** 2025-01-27  
**Migration:** `20250127000000_add_campaign_contact_list_relation`

## Changes

### 1. Campaigns Table
- Added `contact_list_id` column (nullable TEXT)
- Added foreign key constraint to `contact_lists.id`
- Added index on `contact_list_id`

### 2. Contact Lists Table
- Added `type` column (TEXT, default: 'static')
- Added `filters` column (JSONB, nullable)
- Added `totalContacts` column (INTEGER, default: 0)
- Added `lastUpdated` column (TIMESTAMP, default: now)
- Added `isActive` column (BOOLEAN, default: true)
- Added `updatedAt` column (TIMESTAMP, auto-update)
- Added unique constraint on (`companyId`, `name`)
- Added index on `isActive`

### 3. Data Migration
- Calculates `totalContacts` for existing contact lists
- Sets default values for new columns on existing records

## How to Apply

### Option 1: Using Prisma Migrate (Recommended)
```bash
cd /Users/adamcole/Documents/Ignite/IgniteBd-Next-combine
npx prisma migrate deploy
```

### Option 2: Manual SQL Execution
If Prisma migrate has issues, you can run the SQL directly:

```bash
psql $DATABASE_URL -f prisma/migrations/20250127000000_add_campaign_contact_list_relation/migration.sql
```

### Option 3: Using Prisma Studio
1. Open Prisma Studio: `npx prisma studio`
2. Manually verify the schema changes

## Verification

After migration, verify:

1. **Campaigns table has contact_list_id:**
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'campaigns' AND column_name = 'contact_list_id';
```

2. **Contact lists have new columns:**
```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'contact_lists' 
AND column_name IN ('type', 'filters', 'totalContacts', 'isActive');
```

3. **Foreign key exists:**
```sql
SELECT conname, confrelid::regclass 
FROM pg_constraint 
WHERE conname = 'campaigns_contact_list_id_fkey';
```

4. **Total contacts calculated:**
```sql
SELECT id, name, "totalContacts" 
FROM contact_lists 
LIMIT 10;
```

## Rollback

If you need to rollback:

```sql
-- Remove foreign key
ALTER TABLE "campaigns" DROP CONSTRAINT IF EXISTS "campaigns_contact_list_id_fkey";

-- Remove index
DROP INDEX IF EXISTS "campaigns_contact_list_id_idx";

-- Remove column from campaigns
ALTER TABLE "campaigns" DROP COLUMN IF EXISTS "contact_list_id";

-- Remove new columns from contact_lists
ALTER TABLE "contact_lists" DROP COLUMN IF EXISTS "type";
ALTER TABLE "contact_lists" DROP COLUMN IF EXISTS "filters";
ALTER TABLE "contact_lists" DROP COLUMN IF EXISTS "totalContacts";
ALTER TABLE "contact_lists" DROP COLUMN IF EXISTS "lastUpdated";
ALTER TABLE "contact_lists" DROP COLUMN IF EXISTS "isActive";
ALTER TABLE "contact_lists" DROP COLUMN IF EXISTS "updatedAt";

-- Remove unique constraint
ALTER TABLE "contact_lists" DROP CONSTRAINT IF EXISTS "contact_lists_companyId_name_key";

-- Remove index
DROP INDEX IF EXISTS "contact_lists_isActive_idx";
```

## Notes

- The migration uses `IF NOT EXISTS` and `IF EXISTS` checks to be idempotent
- Existing contact lists will have `totalContacts` calculated automatically
- The `contact_list_id` is nullable, so existing campaigns won't break
- The foreign key uses `ON DELETE SET NULL` so deleting a contact list won't break campaigns

