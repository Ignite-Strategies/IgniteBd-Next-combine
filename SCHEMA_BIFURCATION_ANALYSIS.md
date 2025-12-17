# Schema Bifurcation Analysis: contactCompanyId vs companyId

## The Problem

The Contact model has **TWO fields** that should represent the same thing but don't:

1. **`contactCompanyId`** (line 287)
   - ✅ **Foreign Key** with proper relation: `@relation(fields: [contactCompanyId], references: [id])`
   - ✅ **Official field** per `docs/contacts/CONTACT_MODEL.md`
   - ✅ **Has database constraint** - ensures referential integrity

2. **`companyId`** (line 316)
   - ❌ **NOT a foreign key** - no `@relation` defined
   - ⚠️ **Enrichment field** - just a string field
   - ❌ **No database constraint** - can have values that don't match any company
   - ⚠️ **From refactor attempt** - `docs/archive/ENRICHMENT_REFACTOR_SUMMARY.md` shows attempt to make this primary

## What Happened

According to `docs/archive/ENRICHMENT_REFACTOR_SUMMARY.md`:
- There was a refactor attempt to make `companyId` the primary field
- `contactCompanyId` was supposed to become "DEPRECATED: Legacy field"
- But the schema was never fully updated - `contactCompanyId` still has the FK relation
- Routes set BOTH fields to keep them in sync, but they're not always in sync

## Current State

**Schema Reality:**
- `contactCompanyId` = FK with relation ✅
- `companyId` = enrichment field, no FK ❌

**Route Behavior:**
- Routes set BOTH fields when updating
- But enrichment might only set `companyId`
- Filtering was checking both, but `companyId` isn't a FK

**Data Reality:**
- Joel has `contactCompanyId: null` (FK not set)
- Joel has `companyId: "212c4aa6..."` (enrichment data)
- These are out of sync!

## The Fix

**Option 1: Remove `companyId` from Contact model** (Recommended)
- Keep only `contactCompanyId` as the FK
- Remove `companyId` field entirely
- Migration: Copy `companyId` → `contactCompanyId` where `contactCompanyId` is null
- Cleaner, single source of truth

**Option 2: Make `companyId` the FK and remove `contactCompanyId`**
- Add `@relation` to `companyId`
- Remove `contactCompanyId`
- More disruptive, requires renaming everywhere

**Option 3: Keep both but ensure sync**
- Add trigger/constraint to keep them in sync
- More complex, still confusing

## Recommendation

**Option 1** - Remove `companyId`, use only `contactCompanyId`:
1. Migration script to sync: `UPDATE contacts SET "contactCompanyId" = "companyId" WHERE "contactCompanyId" IS NULL AND "companyId" IS NOT NULL`
2. Remove `companyId` field from schema
3. Update all routes to only use `contactCompanyId`
4. Cleaner, simpler, single source of truth
