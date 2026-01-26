# Invoices Page Audit - Platform Manager

## Current State Analysis

### 1. Frontend (Platform Manager)
**File**: `Ignite-platform-manager/app/platform/invoices/page.js`

**What it does:**
- Displays list of invoices with filters (companyHQId, invoiceType, status)
- Shows invoice table with: Invoice #, Type, Name, Amount, Outstanding, Status, Due Date, Actions
- Calls `/api/platform/invoices` with query params
- Expects response format: `{ invoices: [...] }`

**Issues:**
- ✅ UI looks correct
- ❌ API call might be failing (stuck on "Loading invoices...")

### 2. Proxy Route (Platform Manager)
**File**: `Ignite-platform-manager/app/api/platform/invoices/route.js`

**What it does:**
- GET: Proxies to `${IGNITEBD_API_URL}/api/admin/billing`
- POST: Proxies to `${IGNITEBD_API_URL}/api/billing/invoices/create`
- Requires SuperAdmin auth

**Issues:**
- ❌ GET endpoint points to `/api/admin/billing` which:
  - Uses OLD `invoice` model (singular, work-package-scoped)
  - Filters by Owner (not SuperAdmin-scoped)
  - Returns different schema than expected

### 3. Backend API (IgniteBd-Next-combine)

#### Existing Endpoints:

**`/api/admin/billing` (GET)**
- Uses OLD `invoice` model
- Owner-scoped (filters by owner's companies)
- Returns: `{ success: true, invoices: [...] }`
- Schema: work-package-based invoices

**`/api/billing/invoices/create` (POST)**
- Uses NEW `invoices` model (plural, company-scoped)
- Creates company-scoped invoices
- ✅ This is correct

**`/api/billing/invoices/[invoiceId]` (GET)**
- Uses OLD `invoice` model (singular)
- ❌ Mismatch with new schema

### 4. Schema Mismatch

**OLD Model** (`invoice` - singular):
- Tied to `workPackageId`
- Owner-scoped via work package → company relationship
- Status: `pending`, `paid`, `partial`, etc.

**NEW Model** (`invoices` - plural):
- Tied to `companyHQId` (company-scoped)
- Has `invoiceType` enum: `PLATFORM_FEE`, `MONTHLY_RECURRING`, `CUSTOM`, `WORK_PACKAGE`
- Has `status` enum: `NOT_PAID`, `PAID`, `PARTIAL`
- Optional `workPackageId` for legacy/migrated invoices

## Problems Identified

1. **Missing SuperAdmin-scoped GET endpoint**
   - Need `/api/billing/invoices` (GET) that:
     - Uses NEW `invoices` model
     - Returns ALL invoices (SuperAdmin access)
     - Supports filters: `companyHQId`, `invoiceType`, `status`

2. **Proxy route points to wrong endpoint**
   - Currently: `/api/admin/billing` (old model, owner-scoped)
   - Should be: `/api/billing/invoices` (new model, SuperAdmin-scoped)

3. **Response format mismatch**
   - Old endpoint returns work-package-based invoices
   - UI expects company-scoped invoices with `invoiceType`, `status`, etc.

## Solution

### Step 1: Create `/api/billing/invoices` (GET) endpoint
- Use NEW `invoices` model
- SuperAdmin-scoped (no owner filtering)
- Support filters: `companyHQId`, `invoiceType`, `status`
- Return format: `{ success: true, invoices: [...] }`

### Step 2: Update proxy route
- Change GET to point to `/api/billing/invoices`

### Step 3: Verify UI handles response correctly
- Check that invoice fields match UI expectations

## Files to Create/Modify

1. **Create**: `IgniteBd-Next-combine/app/api/billing/invoices/route.ts`
   - GET handler for listing invoices (SuperAdmin-scoped)

2. **Modify**: `Ignite-platform-manager/app/api/platform/invoices/route.js`
   - Update GET to use `/api/billing/invoices`

3. **Verify**: `Ignite-platform-manager/app/platform/invoices/page.js`
   - Ensure it handles the response correctly

