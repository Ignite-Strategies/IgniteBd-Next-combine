# Work Package Refactor - Implementation Summary

## ✅ Schema Changes Implemented

### 1. Company-First Architecture
- ✅ `companyId` is now **required** (was optional)
- ✅ `companyId` has cascade delete (if company is deleted, work packages are deleted)

### 2. Owner & Member Relations
- ✅ Removed `contactId` field
- ✅ Added `workPackageOwnerId` (required) - foreign key to Contact
- ✅ Added `workPackageMemberId` (optional) - foreign key to Contact (1-to-1 for now)
- ✅ Relations:
  - `workPackageOwner` → Contact (required, Restrict delete)
  - `workPackageMember` → Contact (optional, SetNull on delete)

### 3. Bolt-On Capabilities
- ✅ Added `status` field (WorkPackageStatus enum, defaults to ACTIVE)
- ✅ Added `metadata` JSON field for extensibility
- ✅ Added `tags` String[] array for categorization

### 4. Updated Relations

**Contact Model:**
```prisma
workPackagesOwned    work_packages[]  @relation("WorkPackageOwner")
workPackagesAsMember work_packages[]  @relation("WorkPackageMember")
```

**Companies Model:**
```prisma
work_packages  work_packages[]  // Now required relationship
```

## 📋 Migration Required

### Step 1: Data Migration Script Needed

```sql
-- 1. Add new fields (nullable initially)
ALTER TABLE work_packages 
  ADD COLUMN "workPackageOwnerId" TEXT,
  ADD COLUMN "workPackageMemberId" TEXT,
  ADD COLUMN "status" TEXT DEFAULT 'ACTIVE',
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "tags" TEXT[] DEFAULT '{}';

-- 2. Migrate data: contactId → workPackageOwnerId
UPDATE work_packages 
SET "workPackageOwnerId" = "contactId";

-- 3. Auto-populate companyId from contact's company where missing
UPDATE work_packages wp
SET "companyId" = c."contactCompanyId"
FROM contacts c
WHERE wp."workPackageOwnerId" = c.id
  AND wp."companyId" IS NULL
  AND c."contactCompanyId" IS NOT NULL;

-- 4. Make companyId required (after ensuring all have companies)
-- Note: This will fail if any work packages still have NULL companyId
ALTER TABLE work_packages 
  ALTER COLUMN "companyId" SET NOT NULL,
  ALTER COLUMN "workPackageOwnerId" SET NOT NULL;

-- 5. Remove old contactId field (after migration)
ALTER TABLE work_packages DROP COLUMN "contactId";
```

### Step 2: Update API Routes

Files to update:
- `src/app/api/workpackages/route.js`
- `src/app/api/workpackages/import/mapped/route.js`
- `src/app/api/workpackages/client/[contactId]/route.js`
- All other work package API routes

Changes needed:
- Replace `contactId` with `workPackageOwnerId` in requests/responses
- Make `companyId` required in validation
- Update queries to use new field names
- Add support for `workPackageMemberId` (optional)

### Step 3: Update Frontend Components

Files to update:
- `src/app/(authenticated)/workpackages/csv/page.jsx`
- `src/components/workpackages/*`
- All work package creation/editing components

Changes needed:
- Update ContactSelector to set `workPackageOwnerId`
- Add optional member selection UI
- Update display to show owner vs member
- Update company-first selection flow

### Step 4: Update Client Portal

Files to update:
- Client portal access validation
- Work package display components

Changes needed:
- Validate access via company membership
- Support both owner and member access
- Update queries to use new field names

## 🔍 Key Differences from Original Proposal

1. **No `ownerContactId`**: Used `workPackageOwnerId` to avoid confusion with CompanyHQ ownership
2. **Simple Member Field**: For now, just one optional member (1-to-1). Can expand to junction table later if needed
3. **Direct Foreign Keys**: Using foreign key fields instead of separate junction table for simplicity

## ✅ Benefits

1. **Company-First**: All work packages now belong to companies
2. **Clear Ownership**: `workPackageOwnerId` explicitly defines the owner
3. **Member Support**: `workPackageMemberId` allows one additional member (expandable later)
4. **Extensibility**: `metadata` and `tags` for future features
5. **Better Queries**: Direct company filtering (no joins needed)

## ⚠️ Breaking Changes

1. **API**: `contactId` → `workPackageOwnerId` in all requests
2. **Required Fields**: `companyId` is now required
3. **Queries**: Must use new field names
4. **Client Portal**: Access validation logic needs update

## 🎯 Next Steps

1. ✅ Schema updated
2. ⏳ Create migration script
3. ⏳ Update API routes
4. ⏳ Update frontend components
5. ⏳ Update client portal
6. ⏳ Test with existing data
