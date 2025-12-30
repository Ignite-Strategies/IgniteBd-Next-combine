# Contact Hydration Audit - Dangerous Patterns

**Date**: 2025-01-XX  
**Status**: 🔴 Critical - Company Context Leakage Risk  
**Priority**: High - Data isolation issue

---

## Executive Summary

The contact hydration system uses **localStorage-first** strategy, but **lacks proper companyHQId validation** in many places. This creates a **critical risk** where contacts from one company (e.g., "Ignite") can be shown when working in another company (e.g., "BusinessPoint Law") if:

1. localStorage cache is stale
2. API call fails or is slow
3. Company switch happens but cache isn't cleared
4. Component loads before companyHQId is validated

---

## 🚨 Critical Issues Found

### 1. **ContactsLayout - No Company Validation on Initial Load**

**File**: `app/(authenticated)/contacts/layout.jsx`

**Problem**:
```javascript
// Line 25-41: Loads from localStorage WITHOUT checking companyHQId match
useEffect(() => {
  if (typeof window === 'undefined') return;
  
  const cached = window.localStorage.getItem('contacts');
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        setContacts(parsed);  // ⚠️ DANGEROUS: Could be wrong company!
        setHydrated(true);
      }
    } catch (error) {
      console.warn('Failed to parse cached contacts', error);
    }
  }
}, []); // ⚠️ Runs on mount, BEFORE companyHQId is available
```

**Risk**: Shows contacts from previous company before API validates/fetches correct ones.

**Fix**: Validate `crmId` matches `companyHQId` before using cached data.

---

### 2. **PeopleLayout - Same Issue**

**File**: `app/(authenticated)/people/layout.jsx`

**Problem**: Identical pattern - loads from localStorage on mount without company validation.

**Risk**: Same as #1.

---

### 3. **Pipelines Page - No Validation**

**File**: `app/(authenticated)/pipelines/page.jsx`

**Problem**:
```javascript
// Line 54-68: Loads from localStorage without checking company
useEffect(() => {
  if (typeof window === 'undefined') return;
  
  const cached = window.localStorage.getItem('contacts');
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        setContacts(parsed);  // ⚠️ DANGEROUS: No company validation
      }
    } catch (error) {
      console.warn('Failed to parse cached contacts', error);
    }
  }
  
  // API call happens after, but stale data is shown first
  if (companyHQId) {
    // ... fetch from API
  }
}, [companyHQId]);
```

**Risk**: Shows wrong company's contacts in pipeline view.

---

### 4. **ContactSelector - Overwrites Cache Without Validation**

**File**: `components/ContactSelector.jsx`

**Problem**:
```javascript
// Line 94-110: Uses cached contacts, then overwrites with API
const cached = window.localStorage.getItem('contacts');
let cachedContacts = [];
if (cached) {
  try {
    const parsed = JSON.parse(cached);
    if (Array.isArray(parsed) && parsed.length > 0) {
      cachedContacts = parsed;
      if (!companyId) {
        setContacts(parsed);  // ⚠️ Shows cached without validation
        setLoading(false);
      }
    }
  } catch (err) {
    console.warn('Failed to parse cached contacts', err);
  }
}

// Then fetches from API and overwrites
const response = await api.get(`/api/contacts?companyHQId=${finalCompanyHQId}`);
// ...
window.localStorage.setItem('contacts', JSON.stringify(fetched)); // ⚠️ Overwrites with potentially wrong data if API fails
```

**Risk**: 
- Shows stale contacts initially
- If API call fails, keeps showing wrong company's contacts
- Overwrites localStorage even if companyHQId doesn't match

---

### 5. **Contacts View Page - Partial Validation**

**File**: `app/(authenticated)/contacts/view/page.jsx`

**Status**: ✅ **HAS VALIDATION** (lines 108-164)

**Good Pattern**:
```javascript
// Validates cached contacts match companyHQId before using
const hasMismatch = parsed.some(contact => 
  contact.crmId && contact.crmId !== companyHQId
);

if (hasMismatch) {
  console.log('🔄 Cached contacts belong to different CompanyHQ, fetching fresh data...');
  setContacts([]);
  refreshContactsFromAPI(true);
  return;
}
```

**Note**: This is the CORRECT pattern that should be used everywhere.

---

### 6. **ContactsLayout - Partial Fix (Lines 98-127)**

**Status**: ⚠️ **PARTIAL** - Has validation but runs AFTER initial load

**Problem**: The validation check (lines 98-127) runs AFTER the initial localStorage load (lines 25-41), so wrong contacts are shown briefly.

**Fix Needed**: Move validation into the initial load effect.

---

## 📊 Risk Assessment

| Component | Risk Level | Impact | Likelihood |
|-----------|-----------|--------|------------|
| ContactsLayout | 🔴 Critical | High | High (happens on every company switch) |
| PeopleLayout | 🔴 Critical | High | High |
| Pipelines Page | 🔴 Critical | High | Medium |
| ContactSelector | 🟡 Medium | Medium | Medium |
| Contacts View | ✅ Safe | Low | Low (has validation) |

---

## 🛡️ Recommended Solution

### Option 1: **API-Only Approach** (Safest)

**Remove localStorage-first strategy for contacts**:
- Always fetch from API with `companyHQId` parameter
- Use API response as source of truth
- Only cache AFTER successful API response with validation
- Clear cache on company switch (already done via `wipeTenantData`)

**Pros**:
- ✅ No company context leakage
- ✅ Always shows correct data
- ✅ Simpler logic

**Cons**:
- ⚠️ Slightly slower initial load (but API is fast)
- ⚠️ Requires network for every page load

---

### Option 2: **Validated Cache Approach** (Current + Fixes)

**Keep localStorage but add validation everywhere**:
- Always validate `crmId === companyHQId` before using cached data
- Clear cache if mismatch detected
- Fetch from API if no valid cache

**Pattern**:
```javascript
useEffect(() => {
  if (typeof window === 'undefined' || !companyHQId) return;
  
  const cached = window.localStorage.getItem('contacts');
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      
      // ✅ VALIDATE: Check all contacts belong to current company
      if (Array.isArray(parsed) && parsed.length > 0) {
        const hasMismatch = parsed.some(contact => 
          contact.crmId && contact.crmId !== companyHQId
        );
        
        if (hasMismatch) {
          // Clear stale cache
          localStorage.removeItem('contacts');
          setContacts([]);
          // Fetch fresh from API
          fetchFromAPI();
          return;
        }
        
        // All contacts match - safe to use
        setContacts(parsed);
        setHydrated(true);
      }
    } catch (error) {
      console.warn('Failed to parse cached contacts', error);
      localStorage.removeItem('contacts'); // Clear corrupted cache
    }
  }
  
  // If no valid cache, fetch from API
  if (!hydrated) {
    fetchFromAPI();
  }
}, [companyHQId]); // ✅ Depend on companyHQId
```

**Pros**:
- ✅ Fast initial load when cache is valid
- ✅ Still uses API as source of truth
- ✅ Prevents data leakage

**Cons**:
- ⚠️ More complex validation logic
- ⚠️ Need to add validation everywhere

---

## 🔧 Implementation Plan

### Phase 1: Immediate Fixes (Critical)

1. **Fix ContactsLayout** - Add validation to initial load
2. **Fix PeopleLayout** - Add validation to initial load  
3. **Fix Pipelines Page** - Add validation before using cache
4. **Fix ContactSelector** - Validate before showing cached data

### Phase 2: Standardization

1. Create `validateContactsCache(companyHQId)` utility function
2. Use it in all components that load contacts from localStorage
3. Add tests for company context validation

### Phase 3: Long-term (Consider)

1. Evaluate moving to API-only approach
2. Consider company-scoped localStorage keys: `contacts_${companyHQId}`
3. Add monitoring/alerting for cache mismatches

---

## 📝 Files That Need Updates

### Critical (Must Fix)
- [ ] `app/(authenticated)/contacts/layout.jsx` - Lines 25-41
- [ ] `app/(authenticated)/people/layout.jsx` - Lines 19-35
- [ ] `app/(authenticated)/pipelines/page.jsx` - Lines 54-68
- [ ] `components/ContactSelector.jsx` - Lines 94-110

### Medium Priority
- [ ] `app/(authenticated)/contacts/view/page.jsx` - Already has validation, but could be improved
- [ ] `app/(authenticated)/workpackages/bulk-upload/page.jsx` - Uses cached contacts
- [ ] `app/(authenticated)/workpackages/blank/page.jsx` - Uses cached contacts

### Safe (Already Validated)
- ✅ `app/(authenticated)/contacts/view/page.jsx` - Has validation (lines 108-164)

---

## 🧪 Testing Checklist

After fixes, test:

1. ✅ Switch from Company A to Company B
   - Contacts should clear immediately
   - Should show loading state
   - Should fetch Company B's contacts
   - Should NOT show Company A's contacts

2. ✅ Load contacts page directly (no cache)
   - Should fetch from API
   - Should show correct company's contacts

3. ✅ Load contacts page with stale cache
   - Should detect mismatch
   - Should clear cache
   - Should fetch fresh data

4. ✅ API call fails
   - Should NOT show wrong company's contacts
   - Should show error state
   - Should keep cache cleared

---

## 🔗 Related Files

- `lib/localStorageWiper.js` - Already clears contacts on tenant switch ✅
- `app/(onboarding)/welcome/page.jsx` - Now calls `wipeTenantData` ✅
- `app/api/contacts/hydrate/route.js` - Safe, requires companyHQId ✅
- `app/api/contacts/route.js` - Safe, requires companyHQId ✅

---

## 💡 Recommendation

**Go with Option 1 (API-Only)** for contacts:

1. **Simpler**: No validation logic needed
2. **Safer**: No risk of showing wrong company's data
3. **Faster to implement**: Just remove localStorage reads, keep API calls
4. **Performance**: API calls are fast (< 200ms typically)

The localStorage cache can still be used for:
- ✅ Optimistic updates (show immediately, sync in background)
- ✅ Offline support (if needed later)
- ✅ But NOT for initial load without validation

---

## 🎯 Next Steps

1. **Immediate**: Add validation guards to all localStorage contact reads
2. **Short-term**: Consider API-only approach for contacts
3. **Long-term**: Evaluate company-scoped localStorage keys if keeping cache strategy

