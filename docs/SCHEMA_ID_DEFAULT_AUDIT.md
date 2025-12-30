# Schema ID Default Audit

## Problem

There's a mismatch between Prisma schema defaults and database defaults:
- **Prisma Schema**: Uses `@default(cuid())` (client-side generation)
- **Database**: Uses `gen_random_uuid()` (server-side generation)

When the database has a default but Prisma schema doesn't match, Prisma requires you to provide the ID, causing errors like:
```
Argument `id` is missing.
```

## What Happened

### Contacts Model (Fixed)
- **Migration**: `20251215205429_add_uuid_default_to_contact_id`
- **Date**: Dec 15, 2025
- **Action**: Added `gen_random_uuid()` default to database
- **Schema Fix**: Changed from `@id` to `@id @default(dbgenerated("gen_random_uuid()"))`
- **Status**: ✅ Fixed

### Templates Model (Just Fixed)
- **Migration**: `20251229195538_add_default_to_templates_id`
- **Date**: Dec 29, 2025
- **Action**: Added `gen_random_uuid()` default to database
- **Schema Fix**: Changed from `@id` to `@id @default(dbgenerated("gen_random_uuid()"))`
- **Status**: ✅ Fixed

## Root Cause Analysis

### Why This Happened

1. **Migration Pattern**: Someone added database defaults via SQL migrations (`ALTER TABLE ... SET DEFAULT gen_random_uuid()`)
2. **Schema Not Updated**: The Prisma schema wasn't updated to match the database default
3. **Inconsistency**: Schema used `@default(cuid())` or no default, while database used `gen_random_uuid()`

### The Issue

When Prisma schema doesn't specify a default but the database does:
- Prisma expects you to provide the ID (because schema says no default)
- Database expects to generate it (because database has default)
- **Result**: Prisma validation fails because ID is "missing" (but database would have generated it)

## Current State Audit

### Models with `@default(dbgenerated("gen_random_uuid()"))` ✅
- `Contact` (line 402)
- `templates` (line 1167)

### Models with `@default(cuid())` ⚠️
- `contact_analyses` (line 132)

### Models with NO default (@id only) ⚠️
These are **at risk** if any migration added a database default:

- `bd_intels` (line 112) - Legacy, will be removed
- `contact_lists` (line 381)
- All other models with `@id` and no `@default()` specified

## Recommendation

### Immediate Action

1. **Audit all migrations** for `ALTER COLUMN "id" SET DEFAULT gen_random_uuid()`
2. **Check each model** to ensure schema matches database default
3. **Fix mismatches** by updating schema to use `@default(dbgenerated("gen_random_uuid()"))`

### Pattern to Follow

**Consistent Approach:**
- **Option 1**: Use `@default(dbgenerated("gen_random_uuid()"))` in schema + `gen_random_uuid()` in database (recommended for PostgreSQL)
- **Option 2**: Use `@default(cuid())` in schema + NO database default (Prisma generates client-side)

**Current Recommendation**: Use Option 1 (`gen_random_uuid()`) because:
- It's already the pattern in the database
- It's more efficient (server-side generation)
- It's consistent with PostgreSQL best practices

### How to Find Mismatches

```bash
# Find all migrations that add UUID defaults
grep -r "SET DEFAULT gen_random_uuid()" prisma/migrations/

# Find all models with @id but no default in schema
grep -A 2 "^model\|@id" prisma/schema.prisma | grep -B 1 "@id" | grep -v "@default"
```

## Prevention

### Best Practice

1. **Always update schema when adding database defaults**
2. **Run `prisma migrate dev` instead of manual SQL** (Prisma will sync schema automatically)
3. **If using manual migrations, update schema immediately after**
4. **Use `prisma db pull` to sync schema from database** (but be careful - it can overwrite customizations)

### Migration Checklist

When adding a default to an ID column:
- [ ] Add SQL: `ALTER TABLE "table" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();`
- [ ] Update schema: Change `@id` to `@id @default(dbgenerated("gen_random_uuid()"))`
- [ ] Test: Create a record without providing ID
- [ ] Verify: Check that Prisma doesn't require ID in create calls

## Summary

**What happened:**
- Migrations added `gen_random_uuid()` defaults to database
- Schema wasn't updated to match
- Prisma validation failed because schema said "no default" but database said "has default"

**Fix:**
- Updated schema to use `@default(dbgenerated("gen_random_uuid()"))` to match database
- This tells Prisma: "database will generate this, don't require it"

**Status:**
- ✅ Contacts: Fixed
- ✅ Templates: Fixed
- ⚠️ Other models: Need audit

