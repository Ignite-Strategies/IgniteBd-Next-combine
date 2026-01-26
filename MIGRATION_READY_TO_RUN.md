# Microsoft Migration - Ready to Run

## ✅ What's Been Done

1. **Step 4 Clean Up Complete**
   - Removed Microsoft logic from `/api/owner/hydrate`
   - Updated frontend to use `/api/microsoft/status`
   
2. **MicrosoftAccount Model Created**
   - Added to `prisma/schema.prisma`
   - Prisma client generated

3. **Migration Files Created**
   - Migration SQL file: `prisma/migrations/20260126180532_add_microsoft_account_model/migration.sql`
   - Data migration script: `scripts/migrate-microsoft-to-account.js`

## 🚀 To Run the Migration

### Step 1: Apply Database Schema Migration

**Option A: Using Prisma (Recommended)**
```bash
cd /Users/adamcole/Documents/Ignite/IgniteBd-Next-combine

# Load environment variables
export $(grep -v '^#' .env.local | grep -E '^(DATABASE_URL|DIRECT_DATABASE_URL)=' | xargs)

# Apply migration
npx prisma migrate deploy
```

**Option B: Using the Migration Script**
```bash
cd /Users/adamcole/Documents/Ignite/IgniteBd-Next-combine
npm run migrate
```

**Option C: Manual SQL (if Prisma fails)**
```bash
# Connect to your database and run:
psql $DIRECT_DATABASE_URL -f prisma/migrations/20260126180532_add_microsoft_account_model/migration.sql
```

### Step 2: Migrate Existing Data

After the schema migration succeeds, run the data migration:

```bash
cd /Users/adamcole/Documents/Ignite/IgniteBd-Next-combine
node scripts/migrate-microsoft-to-account.js
```

This will:
- Find all owners with Microsoft tokens
- Create `MicrosoftAccount` records
- Report migration statistics

### Step 3: Verify Migration

Check that data was migrated:

```bash
# Using Prisma Studio
npx prisma studio

# Or using a query
# Should see MicrosoftAccount records for owners that had Microsoft tokens
```

## 📋 Migration SQL

The migration creates:
- `MicrosoftAccount` table with all required fields
- Unique constraint on `ownerId` (one account per owner)
- Indexes on `ownerId` and `microsoftEmail`
- Foreign key to `owners` table with CASCADE delete

## ⚠️ Current Status

- ✅ Schema updated
- ✅ Migration file created
- ✅ Data migration script ready
- ⏳ **Database connection failed** - need to run migrations when database is accessible

## 🔄 Next Steps After Migration

1. Update code to use `MicrosoftAccount` instead of `owner.microsoft*` fields
2. Test all Microsoft features
3. Remove Microsoft fields from `owners` model
4. Create final migration to drop old columns
5. Consolidate hydrate/fetch API calls

## 📝 Files Modified

- `prisma/schema.prisma` - Added MicrosoftAccount model
- `app/api/owner/hydrate/route.js` - Removed Microsoft logic
- `app/(authenticated)/contacts/ingest/microsoft/page.jsx` - Uses `/api/microsoft/status`
- `scripts/migrate-microsoft-to-account.js` - Data migration script
- `prisma/migrations/20260126180532_add_microsoft_account_model/migration.sql` - Schema migration
