# WEDNESDAY FIX LIST — MULTI-TENANT CLEANUP
## Planning Document (Do NOT Implement Yet)

**Date Created**: Planning Phase  
**Status**: 📋 Planning Only — Implementation scheduled for Wednesday  
**Critical**: All fixes relate to multi-tenant architecture and must be addressed together

---

## Overview

This document outlines the planning for 5 multi-tenant cleanup fixes that must be implemented together on Wednesday. Each fix includes:
- Exact file paths to modify
- Code blocks to remove or replace
- TODO comments to add
- Implementation notes

**⚠️ IMPORTANT**: This is a PLANNING DOCUMENT ONLY. Do not implement these changes until Wednesday.

---

## Fix #1: Tenant Switch Hydration Gateway

### Problem

Switching tenants still uses local-first hydration and UI shows stale IgniteBD data. When `switchTenant()` is called, it redirects directly to `/growth-dashboard` without properly resetting tenant-scoped stores and re-hydrating data.

### Solution Overview

Create a new `/tenant-hydrate` route that acts as a gateway between tenant switching and the dashboard. This route will:
1. Reset all tenant-scoped stores
2. Clear stale localStorage keys (preserve Firebase auth + companyHQId)
3. Call `GET /api/owner/hydrate` to get fresh owner data
4. Write owner + companyHQ to localStorage
5. Redirect to `/growth-dashboard` after successful hydration

### Files to Create

#### New File: `src/app/(authenticated)/tenant-hydrate/page.jsx`

**Purpose**: Gateway route that handles tenant hydration when switching tenants.

**Implementation Notes**:
- This page should NOT render UI (or show minimal loading screen)
- On mount: read `companyHQId` from localStorage
- Reset tenant-scoped stores (ownerStore, company hydration cache)
- Clear stale localStorage keys but preserve:
  - Firebase auth session (`firebaseToken`, `firebaseId`)
  - `companyHQId` (the new one we're switching to)
- Call `GET /api/owner/hydrate` to get fresh owner data
- Write owner + companyHQ to localStorage
- Call `GET /api/company/hydrate?companyHQId=${companyHQId}` to hydrate all company data
- Redirect to `/growth-dashboard` after successful hydration

**TODO Comments to Add**:
```javascript
// TODO WEDNESDAY FIX #1: Tenant hydration gateway
// This page resets tenant-scoped data and re-hydrates when switching tenants
```

### Files to Modify

#### File: `src/lib/tenant.js`

**Current Code (lines 12-16)**:
```javascript
export function switchTenant(companyHQId) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('companyHQId', companyHQId);
    window.location.href = '/growth-dashboard';
  }
}
```

**Changes Needed**:
- Change redirect from `/growth-dashboard` to `/tenant-hydrate`
- Add TODO comment

**New Code**:
```javascript
export function switchTenant(companyHQId) {
  if (typeof window !== 'undefined') {
    // TODO WEDNESDAY FIX #1: Write new companyHQId before redirecting to hydration gateway
    localStorage.setItem('companyHQId', companyHQId);
    // TODO WEDNESDAY FIX #1: Redirect to tenant hydration gateway instead of direct dashboard
    window.location.href = '/tenant-hydrate';
  }
}
```

#### File: `src/lib/tenantSwitch.js` (if different from tenant.js)

**Current Code**: Same as `tenant.js` (lines 12-16)

**Changes Needed**: Same as above — change redirect to `/tenant-hydrate`

### localStorage Keys to Clear in `/tenant-hydrate`

**Clear These Keys** (tenant-scoped data):
- `owner` (will be re-hydrated)
- `companyHQ` (will be re-hydrated)
- `companyHydration_*` (all tenant-scoped hydration caches)
- `personas`
- `personaId`
- `contacts`
- `products`
- `pipelines`
- `proposals`
- `phaseTemplates`
- `deliverableTemplates`
- `workPackages`
- `contactLists`
- `outreachCampaigns`

**Preserve These Keys** (auth + new tenant context):
- `firebaseToken`
- `firebaseId`
- `companyHQId` (the new one)
- `ownerId` (will be re-hydrated but keep for now)

### Store Reset Functions Needed

#### File: `src/stores/ownerStore.js`

**Current State**: Has `clearOwner()` function (line 28-33)

**Changes Needed**:
- Verify `clearOwner()` properly resets store
- Add TODO comment about tenant hydration reset

**TODO Comment to Add**:
```javascript
// TODO WEDNESDAY FIX #1: clearOwner() is called during tenant hydration to reset tenant-scoped owner data
```

#### File: `src/hooks/useCompanyHydration.js`

**Changes Needed**:
- Add a reset function or clear method for the hydration cache
- Document that this hook's localStorage cache should be cleared on tenant switch

**TODO Comment to Add**:
```javascript
// TODO WEDNESDAY FIX #1: Company hydration cache is cleared during tenant switch
// localStorage key pattern: companyHydration_${companyHQId}
```

### API Routes to Use

1. **`GET /api/owner/hydrate`** — Already exists at `src/app/api/owner/hydrate/route.js`
   - Returns: `{ success: true, owner: {...}, isSuperAdmin: boolean }`
   - Includes `companyHQ` if owner has primary company

2. **`GET /api/company/hydrate?companyHQId=${companyHQId}`** — Already exists at `src/app/api/company/hydrate/route.js`
   - Returns: All tenant-scoped data (personas, contacts, products, pipelines, etc.)

---

## Fix #2: Product Hydration Fix (Products must be tenant-scoped)

### Problem

Products page is hydrating off `ownerId` instead of `companyHQId`, causing cross-tenant bleed-through. While the API routes already support `companyHQId`, the UI components may still be reading from owner context instead of tenant context.

### Solution Overview

Ensure all product queries, creation, and editing use `companyHQId` from tenant context (localStorage), not `ownerId`. Verify all API calls include `companyHQId` parameter.

### Files to Review & Modify

#### File: `src/app/(authenticated)/products/page.jsx`

**Current Code Analysis**:
- Line 19-23: Reads `companyHQId` from localStorage correctly ✅
- Line 70: API call uses `companyHQId` correctly ✅
- Line 83: Personas API call uses `companyHQId` correctly ✅

**Changes Needed**:
- Verify no hardcoded `ownerId` references
- Add TODO comments to ensure tenant scoping

**TODO Comments to Add**:
```javascript
// TODO WEDNESDAY FIX #2: Products must be tenant-scoped using companyHQId, not ownerId
// All product queries must include companyHQId parameter
```

#### File: `src/app/(authenticated)/products/builder/page.jsx`

**Current Code Analysis**:
- Line 45-52: Reads `companyHQId` from localStorage (as `derivedCompanyId`) ✅
- Line 83: Personas API call uses `companyHQId` correctly ✅
- Line 112: Product fetch uses `companyHQId` correctly ✅
- Line 130: Personas fetch uses `companyHQId` correctly ✅
- Line 181: Product update uses `companyHQId` correctly ✅
- Line 201: Product create uses `companyHQId` correctly ✅

**Changes Needed**:
- Verify all product operations use `companyHQId` consistently
- Add TODO comments

**TODO Comments to Add**:
```javascript
// TODO WEDNESDAY FIX #2: Product creation must store companyHQId (not ownerId)
// TODO WEDNESDAY FIX #2: Product editing must maintain companyHQId (not ownerId)
```

#### File: `src/app/api/products/route.js`

**Current Code Analysis**:
- Line 15: GET route accepts `companyHQId` query param ✅
- Line 18: Query filters by `companyHQId` ✅
- Line 39: POST route accepts `companyHQId` from body ✅
- Line 63: Product creation uses `companyHQId` ✅

**Changes Needed**:
- Verify no fallback to `ownerId` anywhere
- Add validation to ensure `companyHQId` is required

**TODO Comments to Add**:
```javascript
// TODO WEDNESDAY FIX #2: Products MUST be scoped by companyHQId, never by ownerId
// TODO WEDNESDAY FIX #2: All product queries must use: where: { companyHQId: currentCompanyHQId }
```

#### File: `src/app/api/products/[productId]/route.js`

**Current Code Analysis**:
- Line 16: GET route accepts `companyHQId` query param ✅
- Line 21: Query filters by `companyHQId` ✅
- Line 49: PUT route uses `companyHQId` ✅
- Line 71: Update validates `companyHQId` matches ✅

**Changes Needed**:
- Verify tenant scoping is enforced
- Add TODO comments

**TODO Comments to Add**:
```javascript
// TODO WEDNESDAY FIX #2: Product GET/PUT must verify companyHQId matches tenant
// TODO WEDNESDAY FIX #2: Update product must keep same companyHQId (cannot change tenant)
```

### Verification Checklist

- [ ] All product API routes require `companyHQId`
- [ ] All product queries use `where: { companyHQId }`
- [ ] Product creation writes `companyHQId` (not `ownerId`)
- [ ] Product editing maintains `companyHQId` (cannot switch tenants)
- [ ] UI reads `companyHQId` from tenant context (localStorage), not owner context

---

## Fix #3: Persona Hydration Fix (also tenant-scoped)

### Problem

Personas are still hydrating using `ownerId` and ignore `companyHQId`. While the API routes support `companyHQId`, we need to verify all persona queries and creation use tenant scoping.

### Solution Overview

Ensure all persona queries, creation, and editing use `companyHQId` from tenant context, not `ownerId`. Verify all API calls include `companyHQId` parameter.

### Files to Review & Modify

#### File: `src/app/(authenticated)/personas/page.jsx`

**Current Code Analysis**:
- Line 25-29: Reads `companyHQId` from localStorage correctly ✅
- Line 54: API call uses `companyHQId` correctly ✅
- Line 129: Sync API call uses `companyHQId` correctly ✅

**Changes Needed**:
- Verify no hardcoded `ownerId` references
- Add TODO comments

**TODO Comments to Add**:
```javascript
// TODO WEDNESDAY FIX #3: Personas must be tenant-scoped using companyHQId, not ownerId
// All persona queries must include companyHQId parameter
```

#### File: `src/app/(authenticated)/persona/page.jsx`

**Current Code Analysis**:
- Line 6-7: Uses `defaultCompanyHQId` from env (legacy pattern)
- Line 22: Form includes `companyHQId` field
- Line 34-36: Products API call uses `companyHQId` correctly ✅
- Line 66: Persona creation API call includes `companyHQId` ✅

**Changes Needed**:
- Replace `defaultCompanyHQId` env var pattern with localStorage reading
- Verify persona creation uses tenant-scoped `companyHQId`
- Add TODO comments

**TODO Comments to Add**:
```javascript
// TODO WEDNESDAY FIX #3: Persona creation must read companyHQId from tenant context (localStorage)
// TODO WEDNESDAY FIX #3: Remove defaultCompanyHQId env var pattern - use tenant context instead
```

**Code Changes Needed**:
- Line 6-7: Replace env var with localStorage reading
- Line 22: Ensure `companyHQId` comes from tenant context

#### File: `src/app/api/personas/route.js`

**Current Code Analysis**:
- Line 15: GET route accepts `companyHQId` query param ✅
- Line 27: Query filters by `companyHQId` ✅
- Line 92: POST route accepts `companyHQId` from body ✅
- Line 135: Persona creation uses `companyHQId` ✅

**Changes Needed**:
- Verify no fallback to `ownerId` anywhere
- Add validation to ensure `companyHQId` is required

**TODO Comments to Add**:
```javascript
// TODO WEDNESDAY FIX #3: Personas MUST be scoped by companyHQId, never by ownerId
// TODO WEDNESDAY FIX #3: All persona queries must use: where: { companyHQId: currentCompanyHQId }
```

### Verification Checklist

- [ ] All persona API routes require `companyHQId`
- [ ] All persona queries use `where: { companyHQId }`
- [ ] Persona creation writes `companyHQId` (not `ownerId`)
- [ ] Persona editing maintains `companyHQId` (cannot switch tenants)
- [ ] UI reads `companyHQId` from tenant context (localStorage), not owner context
- [ ] Remove any `defaultCompanyHQId` env var patterns

---

## Fix #4: BD Goal Refactor Stub (Prep only, not full build)

### Problem

BD Roadmap on dashboard is hardcoded (`$1M`) and not tenant-specific. The goal should read from `companyHQ.bdGoal` but we're not implementing the full feature until Thursday.

### Solution Overview

Add planning notes, TODO comments, and schema migration outline for BD goal feature. Do NOT implement fully—just prepare the code for future implementation.

### Files to Modify

#### File: `src/app/(authenticated)/growth-dashboard/page.jsx`

**Current Code (lines 207-211)**:
```javascript
const dashboardData = useMemo(() => ({
  targetRevenue: 1_000_000,
  currentRevenue: 0,
  timeHorizon: 12,
}), []);
```

**Changes Needed**:
- Add TODO comments indicating where BD goal should come from
- Add comments pointing out hardcoded values to replace
- Prepare structure for reading from `companyHQ.bdGoal`

**New Code with TODOs**:
```javascript
// TODO WEDNESDAY FIX #4: BD Goal Refactor (Full implementation on Thursday)
// Current: Hardcoded $1M goal and 12-month horizon
// Future: Read from companyHQ.bdGoal, companyHQ.bdGoalStart, companyHQ.bdGoalEnd
// TODO: Replace hardcoded targetRevenue with companyHQ.bdGoal || 1_000_000
// TODO: Replace hardcoded timeHorizon with calculated months from bdGoalStart to bdGoalEnd || 12
const dashboardData = useMemo(() => {
  // TODO WEDNESDAY FIX #4: Read BD goal from companyHQ.bdGoal instead of hardcoded value
  // const bdGoal = companyHQ?.bdGoal || 1_000_000;
  // const bdGoalStart = companyHQ?.bdGoalStart ? new Date(companyHQ.bdGoalStart) : null;
  // const bdGoalEnd = companyHQ?.bdGoalEnd ? new Date(companyHQ.bdGoalEnd) : null;
  // const timeHorizon = bdGoalStart && bdGoalEnd 
  //   ? Math.round((bdGoalEnd - bdGoalStart) / (1000 * 60 * 60 * 24 * 30)) // months
  //   : 12;
  
  return {
    targetRevenue: 1_000_000, // TODO: Replace with companyHQ.bdGoal
    currentRevenue: 0, // TODO: Calculate from proposals/contracts
    timeHorizon: 12, // TODO: Calculate from companyHQ.bdGoalStart to bdGoalEnd
  };
}, []); // TODO: Add companyHQ to dependencies when implementing
```

### Schema Migration Outline

#### File: `prisma/schema.prisma`

**Location**: In the `CompanyHQ` model (around line 69-113)

**Current Schema**:
```prisma
model CompanyHQ {
  id               String   @id @default(cuid())
  companyName      String
  // ... other fields ...
  @@map("company_hqs")
}
```

**Schema Changes Needed (for Thursday)**:

```prisma
model CompanyHQ {
  id               String   @id @default(cuid())
  companyName      String
  // ... existing fields ...
  
  // TODO WEDNESDAY FIX #4: BD Goal fields (add on Thursday)
  // bdGoal           Float?    // Target BD revenue goal (e.g., 1_000_000)
  // bdGoalStart      DateTime? // Goal period start date
  // bdGoalEnd        DateTime? // Goal period end date
  
  @@map("company_hqs")
}
```

**Migration SQL Outline (for Thursday)**:
```sql
-- TODO WEDNESDAY FIX #4: Run this migration on Thursday
-- ALTER TABLE company_hqs 
-- ADD COLUMN bd_goal FLOAT NULL,
-- ADD COLUMN bd_goal_start TIMESTAMP NULL,
-- ADD COLUMN bd_goal_end TIMESTAMP NULL;
```

### UI Notes for "Set My BD Goal" Card

**File**: Create notes file or add to existing dashboard component

**Location**: `src/app/(authenticated)/growth-dashboard/page.jsx` or new component

**UI Notes**:
```javascript
// TODO WEDNESDAY FIX #4: Add "Set My BD Goal" card to dashboard
// Design: Card with form to set:
//   - BD Goal amount (number input)
//   - Goal start date (date picker)
//   - Goal end date (date picker)
// API: POST /api/companyhq/[id]/bd-goal or PUT /api/companyhq/[id]
// Store: Update companyHQ.bdGoal, bdGoalStart, bdGoalEnd
// Location: Below HeaderSummary, above Quick Actions
```

**Component Structure** (for Thursday):
```javascript
// TODO WEDNESDAY FIX #4: Create BDGoalCard component
// <BDGoalCard 
//   companyHQId={companyHQId}
//   currentGoal={companyHQ?.bdGoal}
//   onGoalSet={(goal, startDate, endDate) => {
//     // Call API to update companyHQ
//     // Refresh dashboard data
//   }}
// />
```

---

## Fix #5: Optional - Navigation Banner for Tenant Context

### Problem

User doesn't always know which tenant they are viewing. This is an optional enhancement for future consideration.

### Solution Overview

Add planning notes for a future top-nav tenant selector or label. Do not build UI now—just document the requirement.

### Files to Document

#### New File or Add to: `docs/ux/UX_NAV.md`

**Notes to Add**:
```markdown
## TODO WEDNESDAY FIX #5: Tenant Context Navigation Banner

### Requirement
Users need visual indication of which tenant they are currently viewing, especially when switching between multiple tenants.

### Proposed Solution
- Top navigation bar should display current tenant name
- If user has multiple tenants, show dropdown selector
- Clicking tenant name/selector shows list of available tenants
- Selecting tenant triggers tenant switch flow (Fix #1)

### Implementation Notes (Future)
- Location: Top navigation bar, right side (next to user profile)
- Design: Simple text label or dropdown
- Data Source: Read from localStorage.companyHQId, display companyHQ.companyName
- Action: Click → Show tenant list → Switch tenant → Redirect to /tenant-hydrate

### Files to Create (Future)
- `src/components/navigation/TenantSelector.jsx` - Dropdown component
- Update main layout to include TenantSelector

### Files to Modify (Future)
- `src/app/(authenticated)/layout.jsx` - Add TenantSelector to nav
- `src/lib/tenant.js` - Add getAvailableTenants() helper
```

### Component Outline (for future)

```javascript
// TODO WEDNESDAY FIX #5: Tenant selector component (not implemented yet)
// Location: src/components/navigation/TenantSelector.jsx
// 
// const TenantSelector = ({ currentCompanyHQId, availableTenants, onSwitchTenant }) => {
//   // Display current tenant name
//   // Show dropdown with available tenants
//   // Handle tenant switch
// };
```

---

## Implementation Checklist

### Pre-Implementation (Planning Phase - NOW)

- [x] Document all file paths
- [x] Document all code blocks to change
- [x] Document localStorage keys to clear
- [x] Document API routes to use
- [x] Document schema changes (outline only)
- [x] Add TODO comments to relevant files

### Implementation Phase (Wednesday)

#### Fix #1: Tenant Hydration Gateway
- [ ] Create `/tenant-hydrate` route
- [ ] Implement localStorage clearing logic
- [ ] Implement store reset logic
- [ ] Implement owner hydration API call
- [ ] Implement company hydration API call
- [ ] Update `switchTenant()` redirect
- [ ] Test tenant switching flow

#### Fix #2: Product Hydration Fix
- [ ] Review all product API routes
- [ ] Verify all queries use `companyHQId`
- [ ] Add validation to require `companyHQId`
- [ ] Add TODO comments
- [ ] Test product creation/editing
- [ ] Test cross-tenant isolation

#### Fix #3: Persona Hydration Fix
- [ ] Review all persona API routes
- [ ] Verify all queries use `companyHQId`
- [ ] Replace env var patterns with localStorage
- [ ] Add validation to require `companyHQId`
- [ ] Add TODO comments
- [ ] Test persona creation/editing
- [ ] Test cross-tenant isolation

#### Fix #4: BD Goal Refactor Stub
- [ ] Add TODO comments to dashboard
- [ ] Document schema migration outline
- [ ] Document UI notes for BD Goal card
- [ ] **DO NOT** implement full feature (Thursday)

#### Fix #5: Navigation Banner (Optional)
- [ ] Document requirements
- [ ] **DO NOT** implement UI (future enhancement)

---

## Testing Strategy

### Manual Testing Checklist

#### Tenant Switching
1. [ ] Switch from Tenant A to Tenant B
2. [ ] Verify `/tenant-hydrate` loads and processes
3. [ ] Verify old tenant data is cleared
4. [ ] Verify new tenant data is hydrated
5. [ ] Verify redirect to `/growth-dashboard` works
6. [ ] Verify dashboard shows Tenant B data
7. [ ] Verify no Tenant A data leaks through

#### Product Isolation
1. [ ] Create product in Tenant A
2. [ ] Switch to Tenant B
3. [ ] Verify Tenant B cannot see Tenant A's products
4. [ ] Create product in Tenant B
5. [ ] Switch back to Tenant A
6. [ ] Verify Tenant A cannot see Tenant B's products

#### Persona Isolation
1. [ ] Create persona in Tenant A
2. [ ] Switch to Tenant B
3. [ ] Verify Tenant B cannot see Tenant A's personas
4. [ ] Create persona in Tenant B
5. [ ] Switch back to Tenant A
6. [ ] Verify Tenant A cannot see Tenant B's personas

#### BD Goal Stub
1. [ ] Verify dashboard still shows hardcoded $1M goal
2. [ ] Verify TODO comments are visible in code
3. [ ] Verify no errors from commented-out code

---

## Risk Assessment

### Low Risk
- Fix #2 (Product Hydration) — API routes already support `companyHQId`
- Fix #3 (Persona Hydration) — API routes already support `companyHQId`
- Fix #4 (BD Goal Stub) — Only adding comments, no functional changes

### Medium Risk
- Fix #1 (Tenant Hydration Gateway) — New route and logic, but isolated

### Mitigation Strategies
- Test tenant switching thoroughly before deployment
- Test cross-tenant isolation with multiple tenants
- Keep backup of current `switchTenant()` implementation
- Rollback plan: Revert redirect change if hydration gateway fails

---

## Related Documentation

- `docs/architecture/hydration.md` — Hydration architecture overview
- `docs/setup/localStorageKeys.md` — LocalStorage key documentation
- `docs/super_admin/SUPERADMIN_ARCHITECTURE.md` — Tenant switching overview
- `prisma/schema.prisma` — Database schema (for BD Goal fields)

---

## Notes

- All fixes must be implemented together on Wednesday
- Do not implement Fix #4 fully until Thursday
- Do not implement Fix #5 (future enhancement)
- Test thoroughly after implementation
- Keep current demo working during implementation

---

**End of Planning Document**

