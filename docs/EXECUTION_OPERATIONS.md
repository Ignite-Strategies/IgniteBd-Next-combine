# Execution Operations - Routing & Architecture Analysis

## Overview

This document tracks the execution-related functionality in IgniteBD, specifically:
1. **Execution Hub** - View and manage work package execution
2. **Create Deliverables** - Create deliverables from work packages
3. **WorkPackage Routing** - How workpackages are associated with contacts vs contactCompanies

---

## Current State Analysis

### 1. Execution Hub (`/client-operations/execution`)

**File:** `src/app/(authenticated)/client-operations/execution/page.jsx`

**Purpose:** List view of all work packages for execution tracking

**Current Implementation:**
- Loads work packages filtered by `companyHQId` (from localStorage)
- Shows minimal data: title, description, contact name, phase/item counts
- Routes to `/workpackages/${workPackageId}` when clicking "View Execution Dashboard"

**API Call:**
```javascript
GET /api/workpackages?companyHQId=${companyHQId}
```

**Filtering:**
- Currently filters by `companyHQId` through contact relationship:
  ```javascript
  where.contact = {
    crmId: companyHQId,
  }
  ```

**Issues Found:**
- ⚠️ API tries to include `contactCompany` but WorkPackage schema doesn't have direct relation
- ⚠️ Only filters by `companyHQId`, no filtering by `contactCompanyId` option

---

### 2. Create Deliverables (`/client-operations/create-deliverables`)

**File:** `src/app/(authenticated)/client-operations/create-deliverables/page.jsx`

**Purpose:** Step-by-step flow to create deliverables from work packages

**Current Flow:**
1. **Step 1:** Select Contact (via ContactSelector)
2. **Step 2:** Select Work Package (filtered by `contactId`)
3. **Step 3:** Choose deliverable type (persona, blog, page, deck, template, event_targets)

**API Calls:**
```javascript
// Load work packages for contact
GET /api/workpackages?contactId=${contactId}

// Load single work package with phases/items
GET /api/workpackages?id=${workPackageId}

// Create workpackage item if needed
POST /api/workpackages/items
```

**Routing:**
- Routes to builder pages with context:
  - `/builder/persona/new?workPackageId=${id}&itemId=${itemId}`
  - `/builder/blog/new?workPackageId=${id}&itemId=${itemId}`
  - etc.

**Issues Found:**
- ⚠️ Filters work packages by `contactId` only
- ⚠️ No option to filter by `contactCompanyId` (which would be cleaner)

---

## WorkPackage Association Analysis

### Current Schema

**WorkPackage Model:**
```prisma
model WorkPackage {
  id        String   @id @default(cuid())
  contactId String   // Required - links to Contact
  contact   Contact  @relation(...)
  
  companyId String?  // Optional - links to Company (legacy?)
  company   Company? @relation(...)
  
  // ... other fields
}
```

**Contact Model:**
```prisma
model Contact {
  id               String   @id @default(cuid())
  contactCompanyId String?  // Links to Company they work for
  contactCompany   Company? @relation(...)
  crmId            String   // CompanyHQId (tenant identifier)
  // ... other fields
}
```

### Current Association Pattern

**WorkPackage → Contact → ContactCompany (indirect)**
- WorkPackage has `contactId` (required)
- Contact has `contactCompanyId` (optional)
- WorkPackage can access contactCompany via `contact.contactCompany`

**Issues:**
1. ❌ **No direct `contactCompanyId` on WorkPackage** - Must go through contact
2. ❌ **API tries to include `contactCompany` directly** - But schema doesn't support it
3. ⚠️ **Filtering by contactCompany requires join** - Less efficient

---

## Proposed Refactor: ContactCompany-First Approach

### Concept

**Goal:** Filter work packages by `contactCompanyId` (cleaner, more efficient) while maintaining `contactId` for hydration and user login.

### Why ContactCompany-First?

1. **Business Logic:** Work packages are typically scoped to a company, not an individual contact
2. **Efficiency:** Direct filtering by `contactCompanyId` is faster than joining through contacts
3. **Cleaner Queries:** Can filter all work packages for a company in one query
4. **Scalability:** Better for companies with multiple contacts

### Why Keep ContactId?

1. **Hydration:** Need to know which contact is associated for client portal login
2. **User Context:** The person logging in needs to be identified
3. **Backward Compatibility:** Existing data structure requires it

### Proposed Schema Change

```prisma
model WorkPackage {
  id                String   @id @default(cuid())
  contactId         String   // Required - for hydration/user login
  contact           Contact  @relation(...)
  
  contactCompanyId  String?  // NEW - Direct link to company (for filtering)
  contactCompany   Company? @relation(fields: [contactCompanyId], references: [id])
  
  companyId         String?  // Legacy? - may be redundant with contactCompanyId
  company           Company? @relation(...)
  
  // ... other fields
  
  @@index([contactId])
  @@index([contactCompanyId]) // NEW
  @@index([companyId])
}
```

### Migration Strategy

1. **Add `contactCompanyId` to WorkPackage** (nullable initially)
2. **Backfill from contact relationship:**
   ```sql
   UPDATE work_packages 
   SET contact_company_id = (
     SELECT contact_company_id 
     FROM contacts 
     WHERE contacts.id = work_packages.contact_id
   )
   WHERE contact_company_id IS NULL;
   ```
3. **Update API routes** to:
   - Accept `contactCompanyId` as filter parameter
   - Set `contactCompanyId` when creating WorkPackage (from `contact.contactCompanyId`)
   - Include `contactCompany` relation in queries

---

## Routing Analysis

### Current Routes

#### Execution Hub
- **Path:** `/client-operations/execution`
- **Component:** `ExecutionPage`
- **API:** `GET /api/workpackages?companyHQId=${id}`
- **Filter:** By `companyHQId` (through contact)

#### Create Deliverables
- **Path:** `/client-operations/create-deliverables`
- **Component:** `CreateDeliverablesPage`
- **API:** `GET /api/workpackages?contactId=${id}`
- **Filter:** By `contactId`

#### WorkPackage Detail
- **Path:** `/workpackages/${workPackageId}`
- **API:** `GET /api/workpackages/owner/${id}/hydrate`
- **Includes:** Full hydration with phases, items, artifacts, timeline

### Proposed Route Enhancements

#### Option 1: Add ContactCompany Filter to Existing Routes
```javascript
// Execution Hub - filter by contactCompanyId
GET /api/workpackages?companyHQId=${id}&contactCompanyId=${companyId}

// Create Deliverables - filter by contactCompanyId
GET /api/workpackages?contactCompanyId=${companyId}
```

#### Option 2: New Route for ContactCompany Filtering
```javascript
// New route for company-scoped work packages
GET /api/workpackages/company/${contactCompanyId}
```

---

## API Route Issues Found

### Issue 1: Invalid `contactCompany` Include ⚠️ BUG FOUND

**Location:** `src/app/api/workpackages/route.js` (lines 123, 178)

**Problem:**
```javascript
include: {
  contactCompany: {  // ❌ WorkPackage doesn't have contactCompany relation
    select: {
      id: true,
      companyName: true,
    },
  },
}
```

**Current Schema:** WorkPackage only has `company` relation, not `contactCompany`

**Impact:** This will cause a Prisma error when trying to include `contactCompany` directly. The query will fail.

**Inconsistency Found:**
- ❌ `src/app/api/workpackages/route.js` - Tries to include `contactCompany` directly (WRONG)
- ✅ `src/app/api/workpackages/[id]/route.js` - Correctly includes via `contact.contactCompany` (CORRECT)

**Fix Required:**
Update `src/app/api/workpackages/route.js` to match the pattern in `[id]/route.js`:
```javascript
include: {
  contact: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      contactCompany: {  // ✅ Include through contact
        select: {
          id: true,
          companyName: true,
        },
      },
    },
  },
}
```

**Alternative:** Add `contactCompany` relation to WorkPackage schema (requires migration)

### Issue 2: Missing ContactCompany Filter

**Location:** `src/app/api/workpackages/route.js` (GET handler)

**Current:** Only filters by `contactId` or `companyHQId`

**Proposed:** Add `contactCompanyId` filter:
```javascript
const contactCompanyId = searchParams.get('contactCompanyId');
if (contactCompanyId) {
  where.contactCompanyId = contactCompanyId;
}
```

---

## Documentation Status

### Existing Documentation

1. ✅ **`docs/EXECUTION.md`** - Documents execution hub workflow and features
2. ✅ **`docs/DELIVERABLE_SYSTEM.md`** - Documents deliverable creation system
3. ⚠️ **No documentation** on contact vs contactCompany filtering strategy

### Missing Documentation

1. ❌ ContactCompany-first filtering approach
2. ❌ Migration plan for adding `contactCompanyId` to WorkPackage
3. ❌ API route parameter documentation
4. ❌ Routing decision tree (when to use contactId vs contactCompanyId)

---

## Recommendations

### Immediate Actions

1. **Fix API Route Bug:**
   - Remove invalid `contactCompany` include OR add relation to schema
   - Update includes to use `contact.contactCompany` path

2. **Document Current State:**
   - Document that work packages are currently filtered by `contactId`
   - Note that contactCompany filtering requires join through contact

### Short-Term Refactor

1. **Add `contactCompanyId` to WorkPackage Schema:**
   - Add field and relation
   - Create migration to backfill from contact
   - Update API routes to set `contactCompanyId` on create

2. **Update API Routes:**
   - Add `contactCompanyId` filter parameter
   - Update Execution Hub to optionally filter by `contactCompanyId`
   - Update Create Deliverables to filter by `contactCompanyId` (with contactId for hydration)

3. **Update Frontend:**
   - Add contactCompany selector to Create Deliverables
   - Update Execution Hub to show company name prominently
   - Maintain contactId for hydration/user context

### Long-Term Vision

1. **ContactCompany-First Filtering:**
   - Primary filter by `contactCompanyId`
   - `contactId` used for hydration and user login only
   - All work packages for a company visible in one view

2. **Unified Execution View:**
   - Single execution hub that can filter by:
     - Company (contactCompanyId)
     - Contact (contactId)
     - CompanyHQ (companyHQId)
   - Better UX for managing multiple work packages per company

---

## Questions to Resolve

1. **Is `companyId` on WorkPackage redundant?** Should it be removed in favor of `contactCompanyId`?
2. **Should `contactCompanyId` be required?** Or can work packages exist without a company?
3. **Migration strategy:** How to handle existing work packages without `contactCompanyId`?
4. **Client Portal:** How does contactCompany filtering affect client portal access?

---

## Related Files

- `src/app/(authenticated)/client-operations/execution/page.jsx` - Execution Hub
- `src/app/(authenticated)/client-operations/create-deliverables/page.jsx` - Create Deliverables
- `src/app/api/workpackages/route.js` - WorkPackage API routes
- `prisma/schema.prisma` - Database schema
- `docs/EXECUTION.md` - Execution system documentation
- `docs/DELIVERABLE_SYSTEM.md` - Deliverable system documentation

