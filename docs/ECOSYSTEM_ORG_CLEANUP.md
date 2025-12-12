# EcosystemOrg Cleanup - Disconnect Identification

**Status**: ⚠️ **CONFLICT** - Old and new implementations coexist, causing disconnect

---

## The Problem

We refactored from `AssociationIngest` → `EcosystemOrg`, but **old code still exists** alongside new code. This creates a broken state where:

1. **UI components** call old API routes that reference a deleted Prisma model
2. **Old services** exist but aren't used
3. **New services** exist but UI doesn't use them yet
4. **Database model** only has the new `EcosystemOrg` (old `AssociationIngest` was removed)

---

## Current State: Old vs New

### ✅ NEW IMPLEMENTATION (EcosystemOrg)

**Prisma Model**: `EcosystemOrg`
- Location: `prisma/schema.prisma`
- Status: ✅ **Active in schema**

**API Route**: `/api/ecosystem/org/ingest`
- File: `src/app/api/ecosystem/org/ingest/route.ts`
- Status: ✅ **Works, but not connected to UI**

**Service**: `ecosystemOrgInference.ts`
- File: `src/lib/services/ecosystemOrgInference.ts`
- Status: ✅ **Works, used by new API route**

**UI Page**: `/ecosystem/associations`
- File: `src/app/(authenticated)/ecosystem/associations/page.tsx`
- Status: ❌ **Still calls OLD API route**

---

### ❌ OLD IMPLEMENTATION (AssociationIngest) - STILL EXISTS

**Prisma Model**: `AssociationIngest`
- Status: ❌ **DELETED from schema** (model removed)
- Problem: Code still references it

**API Route**: `/api/ecosystem/association/ingest`
- File: `src/app/api/ecosystem/association/ingest/route.ts`
- Status: ❌ **BROKEN** - References deleted `prisma.associationIngest` model
- Used by: UI page still calls this route

**Service**: `associationInference.ts`
- File: `src/lib/services/associationInference.ts`
- Status: ⚠️ **Orphaned** - Not used, but still exists

**Components**:
- `src/components/ecosystem/AssociationCard.tsx` - Uses `Association` interface (old)
- `src/components/ecosystem/AssociationDetailModal.tsx` - Uses `Association` interface (old)
- Status: ❌ **Mismatched** - Expect old model structure

---

## Disconnect Details

### 1. UI → API Disconnect

**File**: `src/app/(authenticated)/ecosystem/associations/page.tsx`
```typescript
// Line 29: Calls OLD route
const response = await api.get('/api/ecosystem/association/ingest');
```

**Problem**: 
- UI calls `/api/ecosystem/association/ingest`
- That route tries to use `prisma.associationIngest` (doesn't exist)
- Should call `/api/ecosystem/org/ingest` instead

**Fix**: Update API call to use new route

---

### 2. API Route → Model Disconnect

**File**: `src/app/api/ecosystem/association/ingest/route.ts`
```typescript
// Line 131: Tries to create deleted model
const associationIngest = await prisma.associationIngest.create({
  // ...
});

// Line 217: Tries to query deleted model
const associations = await prisma.associationIngest.findMany({
  // ...
});
```

**Problem**: 
- Route references `prisma.associationIngest`
- Model was deleted from schema
- This will throw runtime errors

**Fix**: Delete this file or migrate to use `prisma.ecosystemOrg`

---

### 3. Components → Interface Disconnect

**Files**: 
- `src/components/ecosystem/AssociationCard.tsx`
- `src/components/ecosystem/AssociationDetailModal.tsx`

**Old Interface**:
```typescript
export interface Association {
  id: string;
  rawName: string;
  normalizedName: string;
  description?: string | null;
  industryTags: string[];
  memberTypes: string[];
  memberSeniority?: string | null;
  missionSummary?: string | null;
  authorityLevel?: number | null;
  valueProposition?: string | null;
  personaAlignment?: Record<string, number> | null;
  bdRelevanceScore?: number | null;
  rawWebsite?: string | null;
  rawLocation?: string | null;
  createdAt: Date;
}
```

**New Model** (EcosystemOrg):
```typescript
{
  id: string;
  sourceType: EcosystemOrgSourceType;
  rawName: string;
  rawWebsite?: string | null;
  rawLocation?: string | null;
  normalizedName: string;
  organizationType: OrganizationType;  // NEW FIELD
  description?: string | null;
  whatTheyDo?: string | null;          // NEW FIELD (replaces missionSummary?)
  howTheyMatter?: string | null;        // NEW FIELD
  industryTags: string[];
  authorityLevel?: number | null;
  sizeEstimate?: string | null;         // NEW FIELD
  memberTypes: string[];
  personaAlignment?: Record<string, number> | null;
  bdRelevanceScore?: number | null;
  createdAt: Date;
  // REMOVED: memberSeniority, missionSummary, valueProposition
}
```

**Problem**: 
- Interface mismatch - components expect old fields
- Missing new fields (organizationType, whatTheyDo, howTheyMatter, sizeEstimate)
- Has fields that don't exist in new model (memberSeniority, missionSummary, valueProposition)

**Fix**: Update components to use `EcosystemOrg` type

---

### 4. Orphaned Service

**File**: `src/lib/services/associationInference.ts`

**Status**: ⚠️ **Orphaned** - Not imported or used anywhere

**Problem**: Dead code that should be deleted

**Fix**: Delete this file

---

## Cleanup Checklist

### Step 1: Delete Old Files
- [ ] Delete `src/app/api/ecosystem/association/ingest/route.ts`
- [ ] Delete `src/lib/services/associationInference.ts`

### Step 2: Update UI Components
- [ ] Update `src/app/(authenticated)/ecosystem/associations/page.tsx`
  - [ ] Change API call from `/api/ecosystem/association/ingest` → `/api/ecosystem/org/ingest`
  - [ ] Update response handling (was `associations`, now `orgs`)
- [ ] Update `src/components/ecosystem/AssociationCard.tsx`
  - [ ] Replace `Association` interface with `EcosystemOrg` type
  - [ ] Update field mappings (remove old fields, add new fields)
- [ ] Update `src/components/ecosystem/AssociationDetailModal.tsx`
  - [ ] Replace `Association` interface with `EcosystemOrg` type
  - [ ] Update field mappings

### Step 3: Verify
- [ ] Test upload CSV → Should create `EcosystemOrg` records
- [ ] Test GET request → Should return `orgs` array
- [ ] Test UI display → Should show all fields correctly
- [ ] Check no references to `AssociationIngest` in codebase

---

## Migration Notes

**Field Mappings** (Old → New):
- `memberSeniority` → **REMOVED** (not in new model)
- `missionSummary` → `whatTheyDo` (similar concept)
- `valueProposition` → **REMOVED** (not in new model)
- **NEW**: `organizationType` (ASSOCIATION, COMMERCIAL, MEDIA, NONPROFIT, GOVERNMENT)
- **NEW**: `whatTheyDo` (detailed activities)
- **NEW**: `howTheyMatter` (BD relevance explanation)
- **NEW**: `sizeEstimate` (organization size)

**API Response Changes**:
- Old: `{ success: true, associations: [...] }`
- New: `{ success: true, orgs: [...] }`

---

## Files to Review

### Old Code (Delete):
- `src/app/api/ecosystem/association/ingest/route.ts`
- `src/lib/services/associationInference.ts`

### Update Required:
- `src/app/(authenticated)/ecosystem/associations/page.tsx`
- `src/components/ecosystem/AssociationCard.tsx`
- `src/components/ecosystem/AssociationDetailModal.tsx`

### New Code (Keep):
- `src/app/api/ecosystem/org/ingest/route.ts` ✅
- `src/lib/services/ecosystemOrgInference.ts` ✅
- `prisma/schema.prisma` (EcosystemOrg model) ✅

---

**Last Updated**: 2025-01-XX  
**Status**: ⚠️ Requires cleanup before refactor

