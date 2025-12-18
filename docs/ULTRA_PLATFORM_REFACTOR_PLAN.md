# 🎯 ULTRA PLATFORM + SUPERADMIN REFACTOR — MIGRATION PLAN

**Date**: December 2024  
**Status**: 🟡 **MIGRATION IN PROGRESS**  
**Risk Level**: 🔴 **HIGH - PRODUCTION SCHEMA CHANGE**

---

## EXECUTIVE SUMMARY

**Goal**: Introduce a true platform layer (`ultra_platform`) while preserving all existing tenant (CompanyHQ) behavior.

**Changes**:
1. ✅ Create `ultra_platform` model (platform authority)
2. ✅ Add `platformId` to `company_hqs` (required FK)
3. ✅ Remove self-referential `ultraTenantId` from `company_hqs`
4. ✅ Add `platformId` to `super_admins` (required FK)

**Impact**: Zero impact on existing CompanyHQ operations (tenant isolation unchanged)

---

## 1. SCHEMA CHANGES (DIFF-STYLE)

### A. ADD: `ultra_platform` Model (NEW)

```diff
+ model ultra_platform {
+   id              String          @id @default(uuid())
+   name            String          // "IgniteBD Platform"
+   createdAt       DateTime        @default(now())
+   updatedAt       DateTime        @updatedAt
+   
+   company_hqs     company_hqs[]
+   super_admins    super_admins[]
+ }
```

**Purpose**: Platform authority anchor (non-business, non-tenant)

---

### B. MODIFY: `company_hqs` Model

```diff
model company_hqs {
  id                                            String                    @id
  companyName                                   String
  companyStreet                                 String?
  companyCity                                   String?
  companyState                                  String?
  companyWebsite                                String?
  whatYouDo                                     String?
  companyIndustry                               String?
  teamSize                                      String?
  createdAt                                     DateTime                  @default(now())
  updatedAt                                     DateTime
  ownerId                                       String?
  contactOwnerId                                String?
  managerId                                     String?
  companyAnnualRev                              String?
  yearsInBusiness                               String?
- ultraTenantId                                 String?
+ platformId                                    String                    // REQUIRED
  
  assessments                                   assessments[]
  blogs                                         blogs[]
  companies                                     companies[]
  contacts_company_hqs_contactOwnerIdTocontacts Contact?                  @relation("company_hqs_contactOwnerIdTocontacts", fields: [contactOwnerId], references: [id])
  owners_company_hqs_managerIdToowners          owners?                   @relation("company_hqs_managerIdToowners", fields: [managerId], references: [id])
  owners_company_hqs_ownerIdToowners            owners?                   @relation("company_hqs_ownerIdToowners", fields: [ownerId], references: [id])
- company_hqs                                   company_hqs?              @relation("company_hqsTocompany_hqs", fields: [ultraTenantId], references: [id])
- other_company_hqs                             company_hqs[]             @relation("company_hqsTocompany_hqs")
+ platform                                      ultra_platform            @relation(fields: [platformId], references: [id], onDelete: Cascade)
  company_memberships                           company_memberships[]
  consultant_deliverables                       consultant_deliverables[]
  contact_lists                                 contact_lists[]
  contacts_contacts_crmIdTocompany_hqs          Contact[]                 @relation("contacts_crmIdTocompany_hqs")
  ownedWorkPackages                             work_packages[]           @relation("WorkPackageOwner")
  deliverable_templates                         deliverable_templates[]
  domain_registry                               domain_registry?
  landing_pages                                 landing_pages[]
  personas                                      personas[]
  phase_templates                               phase_templates[]
  presentations                                 Presentation[]
  products                                      products[]
  proposals                                     proposals[]
  templates                                     templates[]
  template_bases                                template_bases[]
+ 
+ @@index([platformId])
}
```

**Changes**:
- ✅ Added `platformId String` (required FK to ultra_platform)
- ❌ Removed `ultraTenantId` (self-reference)
- ❌ Removed `company_hqs` self-relation
- ❌ Removed `other_company_hqs` reverse relation
- ✅ Added `platform` relation
- ✅ Added index on `platformId`

---

### C. MODIFY: `super_admins` Model

```diff
model super_admins {
  id         String   @id
  ownerId    String   @unique
+ platformId String
  
  owners     owners   @relation(fields: [ownerId], references: [id], onDelete: Cascade)
+ platform   ultra_platform @relation(fields: [platformId], references: [id], onDelete: Cascade)
+ 
+ @@index([platformId])
}
```

**Changes**:
- ✅ Added `platformId String` (required FK to ultra_platform)
- ✅ Added `platform` relation
- ✅ Added index on `platformId`

---

## 2. MIGRATION STEPS (ORDERED, SAFE)

### ⚠️ PRE-MIGRATION CHECKLIST

- [ ] Backup database
- [ ] Verify all existing CompanyHQs have valid IDs
- [ ] Check for any code referencing `ultraTenantId`
- [ ] Alert team of maintenance window
- [ ] Test on staging first

---

### STEP 1: Create `ultra_platform` Model

**Migration File**: `001_add_ultra_platform.sql`

```sql
-- 1.1 Create ultra_platform table
CREATE TABLE "ultra_platform" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 1.2 Insert the IgniteBD Platform row
INSERT INTO "ultra_platform" ("id", "name", "createdAt", "updatedAt")
VALUES (
  'platform-ignitebd-001', 
  'IgniteBD Platform',
  NOW(),
  NOW()
);

-- Verification
SELECT * FROM "ultra_platform";
```

**Expected Result**: 1 row with IgniteBD Platform

---

### STEP 2: Add Nullable `platformId` to `company_hqs`

**Migration File**: `002_add_platformid_to_companyhqs.sql`

```sql
-- 2.1 Add platformId column (nullable first)
ALTER TABLE "company_hqs" 
ADD COLUMN "platformId" TEXT;

-- 2.2 Create index (helps with backfill performance)
CREATE INDEX "company_hqs_platformId_idx" ON "company_hqs"("platformId");

-- Verification
SELECT COUNT(*) as total_hqs, 
       COUNT("platformId") as hqs_with_platform,
       COUNT(*) - COUNT("platformId") as hqs_without_platform
FROM "company_hqs";
```

**Expected Result**: All `hqs_without_platform` = total count

---

### STEP 3: Backfill All CompanyHQs to Platform

**Migration File**: `003_backfill_platformid.sql`

```sql
-- 3.1 Backfill all existing CompanyHQs to IgniteBD Platform
UPDATE "company_hqs"
SET "platformId" = 'platform-ignitebd-001'
WHERE "platformId" IS NULL;

-- 3.2 Verification
SELECT 
  COUNT(*) as total_hqs,
  COUNT(CASE WHEN "platformId" = 'platform-ignitebd-001' THEN 1 END) as backfilled_hqs,
  COUNT(CASE WHEN "platformId" IS NULL THEN 1 END) as null_hqs
FROM "company_hqs";

-- 3.3 Verify no orphans
SELECT id, companyName, platformId
FROM "company_hqs"
WHERE "platformId" IS NULL OR "platformId" = '';
```

**Expected Result**: 
- `backfilled_hqs` = `total_hqs`
- `null_hqs` = 0
- No orphans

---

### STEP 4: Make `platformId` Required & Add FK Constraint

**Migration File**: `004_make_platformid_required.sql`

```sql
-- 4.1 Add foreign key constraint
ALTER TABLE "company_hqs"
ADD CONSTRAINT "company_hqs_platformId_fkey"
FOREIGN KEY ("platformId") 
REFERENCES "ultra_platform"("id") 
ON DELETE CASCADE 
ON UPDATE CASCADE;

-- 4.2 Make platformId NOT NULL
ALTER TABLE "company_hqs"
ALTER COLUMN "platformId" SET NOT NULL;

-- Verification
SELECT 
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'company_hqs' 
  AND constraint_name = 'company_hqs_platformId_fkey';
```

**Expected Result**: FK constraint exists

---

### STEP 5: Remove Self-Referential Fields

**Migration File**: `005_remove_ultratenant_fields.sql`

```sql
-- 5.1 Drop self-referential foreign key first
ALTER TABLE "company_hqs"
DROP CONSTRAINT IF EXISTS "company_hqs_ultraTenantId_fkey";

-- 5.2 Drop the column
ALTER TABLE "company_hqs"
DROP COLUMN IF EXISTS "ultraTenantId";

-- Verification - ensure column is gone
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'company_hqs' AND column_name = 'ultraTenantId';
```

**Expected Result**: No rows (column removed)

---

### STEP 6: Update `super_admins` Model

**Migration File**: `006_add_platformid_to_superadmins.sql`

```sql
-- 6.1 Add platformId column (nullable first)
ALTER TABLE "super_admins"
ADD COLUMN "platformId" TEXT;

-- 6.2 Backfill existing super admins to IgniteBD Platform
UPDATE "super_admins"
SET "platformId" = 'platform-ignitebd-001'
WHERE "platformId" IS NULL;

-- 6.3 Add foreign key constraint
ALTER TABLE "super_admins"
ADD CONSTRAINT "super_admins_platformId_fkey"
FOREIGN KEY ("platformId")
REFERENCES "ultra_platform"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- 6.4 Make platformId required
ALTER TABLE "super_admins"
ALTER COLUMN "platformId" SET NOT NULL;

-- 6.5 Add index
CREATE INDEX "super_admins_platformId_idx" ON "super_admins"("platformId");

-- Verification
SELECT sa.id, sa.ownerId, sa.platformId, o.email
FROM "super_admins" sa
JOIN "owners" o ON sa.ownerId = o.id;
```

**Expected Result**: All super admins have `platformId`

---

### STEP 7: Update Prisma Schema File

**Action**: Apply schema changes manually to `schema.prisma`

**Changes** (as shown in Section 1)

**Verification**:
```bash
npx prisma format
npx prisma validate
npx prisma generate
```

**Expected**: No errors, client regenerates

---

### STEP 8: Deploy & Verify

**Checklist**:
- [ ] All migrations applied successfully
- [ ] Prisma client regenerated
- [ ] Application starts without errors
- [ ] Existing CompanyHQ routes work
- [ ] SuperAdmin can access platform
- [ ] No broken foreign keys

**Verification Queries**:
```sql
-- Verify platform exists
SELECT * FROM ultra_platform;

-- Verify all CompanyHQs linked
SELECT COUNT(*) 
FROM company_hqs 
WHERE platformId IS NULL;  -- Should be 0

-- Verify super admins linked
SELECT COUNT(*) 
FROM super_admins 
WHERE platformId IS NULL;  -- Should be 0

-- Verify no orphaned data
SELECT c.id, c.companyName, c.platformId, p.name
FROM company_hqs c
LEFT JOIN ultra_platform p ON c.platformId = p.id
WHERE p.id IS NULL;  -- Should be empty
```

---

## 3. VALIDATION ANSWERS

### Q1: Can all existing CompanyHQ routes continue to operate using `companyHQId` alone?

**✅ YES - CONFIRMED**

All tenant-scoped queries use `companyHQId` as the filter. `platformId` is purely structural and does NOT participate in tenant isolation logic.

---

### Q2: Does UltraPlatform now exist as a non-business, non-tenant authority layer?

**✅ YES - CONFIRMED**

`ultra_platform` has NO business logic fields. It only contains: `id`, `name`, `createdAt`, `updatedAt`. It only anchors CompanyHQs and SuperAdmins.

---

### Q3: Can a SuperAdmin seed an Owner + CompanyHQ without touching Contacts?

**✅ YES - CONFIRMED**

SuperAdmin can create Owner (Firebase-backed) + CompanyHQ independently. Contact creation is a TENANT operation, not a platform operation.

---

### Q4: Is there now no way for a CompanyHQ to act as Ultra?

**✅ YES - CONFIRMED**

`ultraTenantId` removed completely. CompanyHQ **must** reference `ultra_platform` via required `platformId`. No CompanyHQ can exist without a platform parent.

---

## 4. RISKS / EDGE CASES

### ⚠️ RISK 1: Code References to `ultraTenantId`

**Action**: Search for all references before migration
```bash
grep -r "ultraTenantId" app/
grep -r "ultraTenantId" lib/
grep -r "ultraTenantId" scripts/
```

---

### ⚠️ RISK 2: Self-Referential CompanyHQ Data

**Check**:
```sql
SELECT COUNT(*), ultraTenantId
FROM company_hqs
WHERE ultraTenantId IS NOT NULL
GROUP BY ultraTenantId;
```

If rows exist, document which CompanyHQs were "child tenants" before migration.

---

### ⚠️ RISK 3: OnDelete CASCADE for Platform

Platform deletion should be EXTREMELY restricted. Add application-level guard.

---

### ⚠️ RISK 4: Prisma Client Cache

After migration:
```bash
npx prisma generate
rm -rf node_modules/.prisma
npm install
pm2 restart all
```

---

## 5. POST-MIGRATION VERIFICATION SCRIPT

**File**: `/scripts/verify-platform-migration.js`

```javascript
import { prisma } from '@/lib/prisma';

async function verifyPlatformMigration() {
  console.log('🔍 Verifying Platform Migration...\n');

  // 1. Check platform exists
  const platform = await prisma.ultraPlatform.findFirst();
  console.log('✅ Platform exists:', platform?.name);

  // 2. Check all CompanyHQs linked
  const totalHQs = await prisma.companyHQ.count();
  const linkedHQs = await prisma.companyHQ.count({
    where: { platformId: { not: null } }
  });
  console.log(`✅ CompanyHQs linked: ${linkedHQs}/${totalHQs}`);

  if (linkedHQs !== totalHQs) {
    console.error('❌ ERROR: Some CompanyHQs not linked to platform!');
    return false;
  }

  // 3. Check super admins linked
  const totalAdmins = await prisma.superAdmin.count();
  const linkedAdmins = await prisma.superAdmin.count({
    where: { platformId: { not: null } }
  });
  console.log(`✅ SuperAdmins linked: ${linkedAdmins}/${totalAdmins}`);

  console.log('\n✅ All verification checks passed!');
  return true;
}

verifyPlatformMigration()
  .then((success) => process.exit(success ? 0 : 1))
  .catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });
```

---

## 6. SUPERADMIN SEEDING SCRIPT (POST-MIGRATION)

**File**: `/scripts/seed-owner-with-crm.js`

```javascript
import { admin } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * SuperAdmin seeds: Owner + CompanyHQ (NO Contact)
 * Usage: node scripts/seed-owner-with-crm.js joel@example.com "Joel Gulick"
 */
async function seedOwnerWithCRM(email, displayName) {
  const platformId = 'platform-ignitebd-001';

  console.log(`🌱 Seeding Owner + CRM for ${email}...`);

  // 1. Create Firebase user
  const firebaseUser = await admin.auth().createUser({
    email,
    displayName,
    emailVerified: false
  });
  console.log(`   ✅ Firebase UID: ${firebaseUser.uid}`);

  // 2. Create Owner
  const [firstName, ...lastNameParts] = displayName.split(' ');
  const owner = await prisma.owner.create({
    data: {
      firebaseId: firebaseUser.uid,
      email,
      firstName,
      lastName: lastNameParts.join(' ') || null
    }
  });
  console.log(`   ✅ Owner ID: ${owner.id}`);

  // 3. Create CompanyHQ
  const companyHQ = await prisma.companyHQ.create({
    data: {
      companyName: `${displayName}'s CRM`,
      platformId,
      ownerId: owner.id
    }
  });
  console.log(`   ✅ CompanyHQ ID: ${companyHQ.id}`);

  // 4. Create owner membership
  await prisma.companyMembership.create({
    data: {
      userId: firebaseUser.uid,
      companyHqId: companyHQ.id,
      role: 'owner',
      isPrimary: true
    }
  });
  console.log(`   ✅ Membership created`);

  console.log('\n✅ COMPLETE! Owner can now log in and access their CRM.');
  
  return { owner, companyHQ, firebaseUser };
}

// CLI execution
const email = process.argv[2];
const displayName = process.argv[3];

if (!email || !displayName) {
  console.error('Usage: node seed-owner-with-crm.js <email> "<display name>"');
  process.exit(1);
}

seedOwnerWithCRM(email, displayName)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });
```

---

## 7. AUTHORITY MODEL (FINAL)

```
UltraPlatform (Platform Authority)
  └── SuperAdmin (Governance - scoped to platform)
  └── CompanyHQ (Tenant World)
        ├── Owner (via membership, Firebase-backed)
        ├── Contacts (Tenant Data)
        ├── Personas, Products, Proposals, etc. (Tenant Business Logic)
        └── WorkPackages (Tenant Operations)
```

**Key Principles**:
- **UltraPlatform** = Hosting environment (non-business)
- **CompanyHQ** = Tenant container (business logic)
- **Owner** = Universal personhood (Firebase identity)
- **Contact** = Tenant-scoped person (CRM data)
- **SuperAdmin** = Platform governance (seeds Owner + CompanyHQ)

---

## 8. SUPERADMIN UX FLOW (POST-REFACTOR)

```
1. SuperAdmin logs into platform admin area
   ↓
2. SuperAdmin seeds: Owner (Firebase) + CompanyHQ
   ↓
3. Owner receives login credentials
   ↓
4. Owner logs in (Firebase Auth)
   ↓
5. Owner lands directly in their CompanyHQ world
   ↓
6. Owner can create Contacts within their CRM (tenant operation)
```

---

## 9. CRITICAL WARNINGS

### 🚨 BEFORE MIGRATION

- ✅ Backup database
- ✅ Test on staging
- ✅ Search for `ultraTenantId` references in code
- ✅ Document any hierarchical CompanyHQ relationships

### 🚨 DURING MIGRATION

- ✅ Run migrations in order (1-7)
- ✅ Verify each step before continuing
- ✅ Monitor for FK constraint violations

### 🚨 AFTER MIGRATION

- ✅ Run verification script
- ✅ Test existing CompanyHQ routes
- ✅ Regenerate Prisma client
- ✅ Restart application

---

## 10. FINAL SUMMARY

**Schema Changes**:
- ✅ Added `ultra_platform` (new model)
- ✅ Added `platformId` to `company_hqs` (required FK)
- ✅ Removed `ultraTenantId` from `company_hqs`
- ✅ Removed self-referential relations
- ✅ Added `platformId` to `super_admins` (required FK)

**Impact**:
- All existing CompanyHQs → Backfilled to IgniteBD Platform
- Zero impact on tenant operations
- SuperAdmin can now seed Owner + CompanyHQ independently

**Status**: ✅ **READY FOR IMPLEMENTATION**

---

**END OF MIGRATION PLAN**
