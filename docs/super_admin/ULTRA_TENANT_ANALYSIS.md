# Ultra Tenant Model & Switchboard Hydration Analysis

**Date**: January 2025  
**Purpose**: Investigate the ultra tenant model and hydration flow on the manage tenant (switchboard) page

---

## 🔍 Current State

### Ultra Tenant Model

**What it is:**
- The "IgniteBD Master CompanyHQ" is **NOT a separate model**
- It's a regular `CompanyHQ` with a **fixed ID**: `ignitebd_master_hq`
- Created via seeder script: `scripts/seed-ignitebd-master-hq.js`

**Model Structure:**
```prisma
model CompanyHQ {
  id          String   @id @default(cuid())
  companyName String
  managerId   String?  // Points to Owner who manages it
  ownerId     String?  // Optional owner
  // ... other fields ...
}
```

**Seeder Logic:**
```javascript
// Creates or updates CompanyHQ with:
{
  id: 'ignitebd_master_hq',
  companyName: 'IgniteBD Master',
  managerId: owner.id,  // SuperAdmin Owner
}
```

**Key Points:**
- ✅ No special database model needed
- ✅ Uses existing `CompanyHQ` model
- ✅ Identified by fixed ID `ignitebd_master_hq`
- ✅ Has `managerId` pointing to SuperAdmin Owner
- ✅ Appears in switchboard with "Master HQ" badge

---

## 🔄 Switchboard Hydration Flow

### Current Implementation

**Location**: `src/app/(authenticated)/admin/switchboard/page.jsx`

**Current Flow:**
```
Page Load
  ↓
1. Call /api/owner/hydrate
   - Check if isSuperAdmin === true
   - If not → redirect to dashboard
  ↓
2. Call /api/admin/companyhqs
   - Fetches all CompanyHQs
   - Includes owner/manager/contactOwner info
   - Includes _count (contacts, companies, proposals)
  ↓
3. Display switchboard UI
```

### Issues Identified

#### ❌ Issue 1: Duplicate SuperAdmin Check

**Problem:**
- Switchboard calls `/api/owner/hydrate` to check SuperAdmin status
- Then calls `/api/admin/companyhqs` which **ALSO checks SuperAdmin status**
- This is redundant - we're checking twice

**Current Code:**
```javascript
// Switchboard page
const ownerResponse = await api.get('/api/owner/hydrate');
const isAdmin = ownerResponse.data.isSuperAdmin === true;

// Then...
const hqsResponse = await api.get('/api/admin/companyhqs');
// This route ALSO checks SuperAdmin status!
```

**Solution:**
- Use localStorage owner data (already hydrated from welcome)
- Only call `/api/admin/companyhqs` (it will handle auth check)
- If 403 → redirect to dashboard

#### ❌ Issue 2: Unnecessary Hydration Call

**Problem:**
- Owner data should already be in localStorage from welcome page
- No need to call `/api/owner/hydrate` again
- We can read `isSuperAdmin` from localStorage if it was stored

**Current Code:**
```javascript
// Reading from localStorage would be:
const owner = JSON.parse(localStorage.getItem('owner'));
const isSuperAdmin = owner?.isSuperAdmin; // If stored during hydration
```

**Solution:**
- Read owner from localStorage
- Only call `/api/admin/companyhqs`
- If that call fails with 403, then redirect

#### ❌ Issue 3: Missing isSuperAdmin in localStorage

**Problem:**
- `/api/owner/hydrate` returns `isSuperAdmin` but it's not being stored in localStorage
- Switchboard has to call hydrate again to get this value

**Current Hydration Response:**
```json
{
  "success": true,
  "owner": { ... },
  "isSuperAdmin": true  // ← This is returned but not stored
}
```

**Solution:**
- Store `isSuperAdmin` in localStorage during initial hydration
- Or include it in the owner object stored in localStorage

---

## 🎯 Recommended Optimizations

### Option 1: Use localStorage + Single API Call

```javascript
// Switchboard page
useEffect(() => {
  const loadData = async () => {
    // Read from localStorage (already hydrated)
    const storedOwner = localStorage.getItem('owner');
    const owner = storedOwner ? JSON.parse(storedOwner) : null;
    
    // Check SuperAdmin from localStorage (if stored)
    // OR just try the API call - it will handle auth
    try {
      const hqsResponse = await api.get('/api/admin/companyhqs');
      if (hqsResponse.data?.success) {
        setCompanyHQs(hqsResponse.data.companyHQs || []);
        setIsSuperAdmin(true); // If we got here, we're SuperAdmin
      }
    } catch (error) {
      if (error.response?.status === 403) {
        // Not SuperAdmin - redirect
        router.push('/growth-dashboard');
      }
    }
  };
  
  loadData();
}, []);
```

**Benefits:**
- ✅ Only one API call
- ✅ Uses localStorage data
- ✅ Simpler flow
- ✅ API route handles auth check

### Option 2: Store isSuperAdmin in localStorage

**Update hydration to store isSuperAdmin:**
```javascript
// In welcome page or hydration hook
const response = await api.get('/api/owner/hydrate');
const ownerData = response.data.owner;
const isSuperAdmin = response.data.isSuperAdmin;

// Store in localStorage
localStorage.setItem('owner', JSON.stringify({
  ...ownerData,
  isSuperAdmin: isSuperAdmin,  // ← Add this
}));
```

**Then switchboard can:**
```javascript
const owner = JSON.parse(localStorage.getItem('owner'));
const isSuperAdmin = owner?.isSuperAdmin;

if (!isSuperAdmin) {
  router.push('/growth-dashboard');
  return;
}

// Only call companyhqs API
const hqsResponse = await api.get('/api/admin/companyhqs');
```

---

## 📊 Ultra Tenant Usage

### How Ultra Tenant is Used

1. **Switchboard Display:**
   - Shows with "Master HQ" badge
   - Can be switched to like any other tenant
   - Has `managerId` pointing to SuperAdmin

2. **Tenant Switching:**
   - When SuperAdmin clicks "Enter Tenant" on master HQ
   - `localStorage.companyHQId` is set to `ignitebd_master_hq`
   - User is redirected to dashboard
   - All subsequent API calls are scoped to master HQ

3. **Purpose:**
   - Platform-level administration
   - Can contain platform-wide data
   - Acts as a "meta tenant" for SuperAdmin operations

### Current Limitations

- ❌ No special handling for master HQ
- ❌ No platform-level features yet
- ❌ Just treated as a regular tenant
- ❌ No special UI or features when in master HQ context

---

## 🔧 Recommended Changes

### 1. Optimize Switchboard Hydration

**File**: `src/app/(authenticated)/admin/switchboard/page.jsx`

**Change:**
- Remove `/api/owner/hydrate` call
- Read owner from localStorage
- Only call `/api/admin/companyhqs`
- Let API route handle auth check

### 2. Store isSuperAdmin in localStorage

**File**: `src/hooks/useOwner.js` or welcome page

**Change:**
- When storing owner in localStorage, include `isSuperAdmin`
- This way switchboard can check without API call

### 3. Enhance Ultra Tenant Model (Future)

**Considerations:**
- Add `isUltraTenant` flag to CompanyHQ? (probably not needed)
- Add special handling for `ignitebd_master_hq` ID?
- Create platform-level features when in master HQ context?

---

## 📝 Summary

### Ultra Tenant Model
- ✅ **Simple**: Just a CompanyHQ with fixed ID
- ✅ **No special model needed**: Uses existing CompanyHQ
- ✅ **Identified by ID**: `ignitebd_master_hq`
- ✅ **Has manager**: Points to SuperAdmin Owner

### Switchboard Hydration Issues
- ❌ **Duplicate checks**: Checking SuperAdmin twice
- ❌ **Unnecessary calls**: Calling hydrate when data is in localStorage
- ❌ **Missing data**: `isSuperAdmin` not stored in localStorage

### Recommended Fixes
1. Remove hydrate call from switchboard
2. Store `isSuperAdmin` in localStorage
3. Let `/api/admin/companyhqs` handle auth check
4. Use localStorage for owner data

---

## 🧪 Testing

### Test Ultra Tenant
1. Run seeder: `node scripts/seed-ignitebd-master-hq.js`
2. Verify master HQ appears in switchboard
3. Switch to master HQ
4. Verify `localStorage.companyHQId === 'ignitebd_master_hq'`

### Test Switchboard Optimization
1. Navigate to `/admin/switchboard`
2. Check network tab - should only see `/api/admin/companyhqs` call
3. Verify no `/api/owner/hydrate` call
4. Verify switchboard loads correctly

---

## 📚 Related Files

- `src/app/(authenticated)/admin/switchboard/page.jsx` - Switchboard UI
- `src/app/api/admin/companyhqs/route.js` - CompanyHQs API
- `src/app/api/owner/hydrate/route.js` - Owner hydration API
- `scripts/seed-ignitebd-master-hq.js` - Ultra tenant seeder
- `src/lib/tenant.js` - Tenant switching utility

