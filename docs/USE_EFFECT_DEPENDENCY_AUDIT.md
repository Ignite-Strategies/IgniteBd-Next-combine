# useEffect Dependency Array Audit

**Date:** 2024-12-19  
**Issue:** "Cannot access 'v' before initialization" errors caused by useCallback functions in useEffect dependency arrays

## Problem Pattern

When a `useCallback` function depends on a value (like `companyHQId`), and that same function is included in a `useEffect` dependency array, it creates a circular dependency that can cause initialization errors:

```javascript
// ❌ PROBLEMATIC PATTERN
const refreshData = useCallback(async () => {
  // Uses companyHQId
}, [companyHQId]);

useEffect(() => {
  refreshData();
}, [companyHQId, refreshData]); // refreshData changes when companyHQId changes!
```

**Why this breaks:**
1. `companyHQId` changes
2. `refreshData` is recreated (new function reference)
3. `useEffect` sees `refreshData` changed, runs again
4. During React's rendering/minification, this can cause "Cannot access before initialization" errors

## Solution Pattern

**Option 1: Inline the logic in useEffect (Recommended)**
```javascript
// ✅ FIXED PATTERN
const refreshData = useCallback(async () => {
  // Uses companyHQId - available for context/other components
}, [companyHQId]);

useEffect(() => {
  // Inline the fetch logic - only depends on companyHQId
  if (!companyHQId) return;
  
  let isMounted = true;
  const fetchData = async () => {
    // Same logic as refreshData, but inline
  };
  fetchData();
  
  return () => { isMounted = false; };
}, [companyHQId]); // Only depend on companyHQId
```

**Option 2: Remove from dependency array (if function is stable)**
```javascript
// ✅ ALTERNATIVE FIX
useEffect(() => {
  refreshData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [companyHQId]); // Only depend on companyHQId
```

## Files Fixed

### ✅ Fixed Files

1. **`app/(authenticated)/contacts/layout.jsx`**
   - **Issue:** `refreshContacts` in useEffect dependency array (line 69)
   - **Fix:** Inlined fetch logic in useEffect, removed `refreshContacts` from deps
   - **Status:** ✅ Fixed

2. **`app/(authenticated)/contacts/view/page.jsx`**
   - **Issue:** `refreshContactsFromAPI` in useEffect dependency array (line 124)
   - **Fix:** Removed from dependency array, only depends on `companyHQId`
   - **Status:** ✅ Fixed

### ✅ Fixed Files (All Issues Resolved)

3. **`app/(authenticated)/people/layout.jsx`**
   - **Issue:** `refreshContacts` in useEffect dependency array (line 62)
   - **Pattern:** Same as contacts/layout.jsx
   - **Fix Applied:** Inlined fetch logic in useEffect, removed `refreshContacts` from deps
   - **Status:** ✅ Fixed

4. **`app/(authenticated)/contacts/list-builder/preview/page.jsx`**
   - **Issue:** `refreshContacts` in useEffect dependency array (line 44)
   - **Pattern:** `refreshContacts()` called in effect
   - **Fix Applied:** Removed from deps with eslint-disable comment (function is stable from context)
   - **Status:** ✅ Fixed

5. **`app/(authenticated)/workpackages/view/page.jsx`**
   - **Issue:** `refreshHydration` in useEffect dependency array (line 93)
   - **Pattern:** `refreshHydration()` called in effect
   - **Fix Applied:** Removed from deps with eslint-disable comment (function is stable from hook)
   - **Status:** ✅ Fixed

6. **`hooks/useMicrosoftGraph.js`**
   - **Issue:** `loadUserProfile` in useEffect dependency array (line 53)
   - **Pattern:** `loadUserProfile()` called in effect
   - **Fix Applied:** Removed from deps (function has no dependencies, is stable - only run once on mount)
   - **Status:** ✅ Fixed

## Files to Review (No Issues Found)

These files use `useCallback` functions in `useMemo` dependency arrays, which is **OK**:

- `app/(authenticated)/pipelines/layout.jsx` - `refreshPipelineConfig` in useMemo (line 61) ✅ OK
- `app/(authenticated)/outreach/layout.jsx` - `refreshCampaigns` in useMemo (line 63) ✅ OK
- `app/(authenticated)/client-operations/proposals/layout.jsx` - `refreshProposals` in useMemo (line 110) ✅ OK

**Note:** Using `useCallback` functions in `useMemo` dependency arrays is safe because:
- `useMemo` doesn't cause re-renders when dependencies change
- It only recalculates the memoized value
- No circular dependency issues

## Prevention Guidelines

1. **Never put `useCallback` functions in `useEffect` dependency arrays** if the function depends on values that also trigger the effect
2. **Inline fetch logic in `useEffect`** when the effect should run based on a value change
3. **Keep `useCallback` functions for:**
   - Context values (useMemo dependencies)
   - Passing to child components
   - Event handlers
4. **Use ESLint disable comments** only when absolutely necessary and document why

## Testing Checklist

After fixing each file:
- [ ] Page loads without "Cannot access before initialization" errors
- [ ] Data fetches correctly when dependencies change
- [ ] No infinite loops in useEffect
- [ ] Context values still work correctly
- [ ] Manual refresh functions still work

