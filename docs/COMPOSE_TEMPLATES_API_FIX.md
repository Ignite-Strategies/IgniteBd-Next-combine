# Compose Page Templates API Call Fix

## Problem

Templates API call (`/api/templates?companyHQId=...`) is not being made on page load.

## Root Cause

The code was changed to use `onAuthStateChanged` to wait for Firebase auth, but:
1. **`onAuthStateChanged` fires immediately** if auth is already ready
2. **But the callback might not execute** if the component unmounts/remounts quickly
3. **The API call is inside the callback** - if callback doesn't fire, no API call

## What Was Working Before

**Before the sequential fix:**
- Templates loaded immediately when `companyHQId` was available
- Used `useEffect` with `companyHQId` dependency
- Made API call directly: `api.get(\`/api/templates?companyHQId=${companyHQId}\`)`
- **No auth waiting** - axios interceptor handled auth automatically

**Why it worked:**
- Axios interceptor in `lib/api.js` automatically adds auth token
- If auth isn't ready, interceptor waits for `auth.currentUser`
- API call happens regardless of auth state (interceptor handles it)

## Current Issue

**Current code:**
```javascript
useEffect(() => {
  if (!companyHQId) return;
  
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    // API call here
    const response = await api.get(`/api/templates?companyHQId=${companyHQId}`);
  });
  
  return () => unsubscribe();
}, [companyHQId]);
```

**Problem:**
- If `onAuthStateChanged` callback doesn't fire (race condition), API call never happens
- If auth is already ready, callback might not fire immediately
- Component might unmount before callback executes

## Solution

**Two-pronged approach:**
1. **Immediate check** - If `auth.currentUser` exists, call API immediately
2. **Auth listener** - Also listen to `onAuthStateChanged` for when auth becomes ready

```javascript
useEffect(() => {
  if (!companyHQId) return;
  
  let hasCalled = false;
  
  const makeApiCall = async () => {
    if (hasCalled) return;
    hasCalled = true;
    
    setLoadingTemplates(true);
    const response = await api.get(`/api/templates?companyHQId=${companyHQId}`);
    // ... handle response
  };
  
  // Immediate check if auth is ready
  if (auth.currentUser) {
    makeApiCall();
  }
  
  // Also listen for auth state changes
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user && !hasCalled) {
      makeApiCall();
    }
  });
  
  return () => unsubscribe();
}, [companyHQId]);
```

## Why We Need `onAuthStateChanged`

**Axios interceptor handles auth, BUT:**
- If we call API **before Firebase auth initializes**, `auth.currentUser` is `null`
- Interceptor can't add token if `auth.currentUser` is `null`
- Result: 401 Unauthorized error

**`onAuthStateChanged` ensures:**
- We wait for Firebase auth to initialize
- `auth.currentUser` is available when we make API call
- Interceptor can successfully add token

## Alternative: Trust Axios Interceptor

**Simpler approach (if interceptor handles it):**
```javascript
useEffect(() => {
  if (!companyHQId) return;
  
  setLoadingTemplates(true);
  api.get(`/api/templates?companyHQId=${companyHQId}`)
    .then(response => {
      // Handle response
    })
    .catch(err => {
      // Handle error (including 401)
    })
    .finally(() => {
      setLoadingTemplates(false);
    });
}, [companyHQId]);
```

**But this might cause 401s** if auth isn't ready yet.

## Recommended Fix

**Use `onAuthStateChanged` with immediate check:**

```javascript
useEffect(() => {
  if (!companyHQId) return;
  
  let hasCalled = false;
  
  const makeApiCall = async () => {
    if (hasCalled) return;
    hasCalled = true;
    
    console.log('📧 Making API call to /api/templates?companyHQId=' + companyHQId);
    setLoadingTemplates(true);
    
    try {
      const response = await api.get(`/api/templates?companyHQId=${companyHQId}`);
      if (response.data?.success) {
        setTemplates(response.data.templates || []);
      }
    } catch (err) {
      console.error('API call failed:', err);
      setTemplatesError(true);
    } finally {
      setLoadingTemplates(false);
    }
  };
  
  // Check if auth is already ready
  if (auth.currentUser) {
    console.log('Auth ready, calling API immediately');
    makeApiCall();
  }
  
  // Listen for auth state changes
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user && !hasCalled) {
      console.log('Auth state changed, calling API');
      makeApiCall();
    }
  });
  
  return () => {
    unsubscribe();
    hasCalled = false;
  };
}, [companyHQId]);
```

## Debugging

**Check console logs:**
1. `📧 Making API call to /api/templates?companyHQId=...` - API call is being made
2. `Auth ready, calling API immediately` - Auth was already ready
3. `Auth state changed, calling API` - Auth became ready

**If you don't see these logs:**
- `companyHQId` might be missing
- `onAuthStateChanged` might not be firing
- Component might be unmounting before callback executes

**Network tab:**
- Check if `/api/templates?companyHQId=...` request appears
- Check response status (200 = success, 401 = auth issue)

## Summary

**The API call needs to happen, but we need to wait for auth.**
- Use `onAuthStateChanged` to wait for auth
- Also check `auth.currentUser` immediately (in case auth is already ready)
- Prevent duplicate calls with `hasCalled` flag
- Log everything to debug

**The key:** Make sure the API call actually executes, whether auth is ready immediately or needs to wait.

