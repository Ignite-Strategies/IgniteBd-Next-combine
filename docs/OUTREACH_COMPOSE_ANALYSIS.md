# Outreach Compose Page - API Call Analysis

## Current State (BROKEN)

### API Calls Firing on Load:
1. **Templates** (line 154-174): 
   - `GET /api/templates?companyHQId=${companyHQId}`
   - Dependency: `[ownerId]` ❌ WRONG - should be `[companyHQId]`
   - Fires immediately when `ownerId` changes, but `companyHQId` might be empty

2. **Verified Sender** (line 177-193):
   - `GET /api/outreach/verified-senders`
   - Dependency: `[ownerId]`
   - Fires immediately when `ownerId` changes
   - **Problem**: Firebase auth token might not be ready → 401 errors

3. **Contact from URL** (line 196-214):
   - `GET /api/contacts/${urlContactId}`
   - Dependency: `[searchParams, ownerId]`
   - Fires if `contactId` in URL and `ownerId` exists

4. **ContactSelector Component**:
   - `GET /api/contacts?companyHQId=${companyHQId}`
   - Fires when `companyHQId` and `ownerId` are ready
   - **Problem**: `companyHQId` starts as empty string, then gets added to URL

5. **SenderIdentityPanel Component**:
   - `GET /api/outreach/verified-senders` (duplicate!)
   - Uses `useOwner()` hook (we're removing hooks)
   - Fires when `ownerId` changes

### Problems:
1. **Too many calls at once** - All fire simultaneously
2. **401 errors** - Calls fire before Firebase auth token is ready
3. **Timing race condition** - `companyHQId` is empty initially, then gets added to URL
4. **Duplicate calls** - Sender loaded twice (compose page + SenderIdentityPanel)
5. **Wrong dependencies** - Templates useEffect depends on `ownerId` instead of `companyHQId`

---

## Required Data (Sequential Loading)

### 1. Verified Sender
- **Source**: `GET /api/outreach/verified-senders`
- **Requires**: 
  - `ownerId` from localStorage ✅
  - Firebase auth token ready (via axios interceptor) ⚠️
- **Scope**: Owner-level (not companyHQ scoped)
- **When**: After `ownerId` is available AND Firebase auth is ready

### 2. Contacts
- **Source**: `GET /api/contacts?companyHQId=${companyHQId}`
- **Requires**:
  - `companyHQId` from URL params ✅
  - `ownerId` from localStorage ✅
  - Firebase auth token ready ⚠️
- **Scope**: CompanyHQ scoped
- **When**: After `companyHQId` is available AND auth is ready
- **Component**: ContactSelector (handles this)

### 3. Templates
- **Source**: `GET /api/templates?companyHQId=${companyHQId}`
- **Requires**:
  - `companyHQId` from URL params ✅
  - `ownerId` from localStorage ✅
  - Firebase auth token ready ⚠️
- **Scope**: CompanyHQ scoped
- **When**: After `companyHQId` is available AND auth is ready

---

## Solution: Sequential Loading with Guards

### Step 1: Wait for Prerequisites
```javascript
// Prerequisites check
const [authReady, setAuthReady] = useState(false);
const [ownerId, setOwnerId] = useState(null);
const [companyHQId, setCompanyHQId] = useState('');

// Check Firebase auth is ready
useEffect(() => {
  if (typeof window === 'undefined') return;
  
  const checkAuth = async () => {
    // Wait for Firebase auth to initialize
    const user = auth.currentUser;
    if (user) {
      setAuthReady(true);
      return;
    }
    
    // Poll for auth (max 2 seconds)
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (auth.currentUser || attempts >= 40) {
        clearInterval(interval);
        setAuthReady(!!auth.currentUser);
      }
    }, 50);
    
    return () => clearInterval(interval);
  };
  
  checkAuth();
}, []);

// Read ownerId from localStorage
useEffect(() => {
  if (typeof window === 'undefined') return;
  const stored = localStorage.getItem('ownerId');
  if (stored) setOwnerId(stored);
}, []);

// Read companyHQId from URL (with localStorage fallback)
useEffect(() => {
  const urlCompanyHQId = searchParams?.get('companyHQId') || '';
  const stored = localStorage.getItem('companyHQId') || '';
  const final = urlCompanyHQId || stored;
  
  if (final && final !== companyHQId) {
    setCompanyHQId(final);
    // Add to URL if missing
    if (!urlCompanyHQId && stored) {
      router.replace(`/outreach/compose?companyHQId=${stored}`);
    }
  }
}, [searchParams]);
```

### Step 2: Load Verified Sender (First)
```javascript
// Load verified sender - ONLY after auth is ready
useEffect(() => {
  if (!authReady || !ownerId) return;
  
  const loadSender = async () => {
    try {
      const response = await api.get('/api/outreach/verified-senders');
      if (response.data?.success) {
        setSenderEmail(response.data.verifiedEmail);
        setSenderName(response.data.verifiedName);
        setHasVerifiedSender(!!response.data.verifiedEmail);
      }
    } catch (err) {
      console.error('Failed to load sender:', err);
      // Don't set error state - let SenderIdentityPanel handle it
    }
  };
  
  loadSender();
}, [authReady, ownerId]); // Only fire when BOTH are ready
```

### Step 3: Load Templates (Second)
```javascript
// Load templates - ONLY after auth and companyHQId are ready
useEffect(() => {
  if (!authReady || !ownerId || !companyHQId) return;
  
  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const response = await api.get(`/api/templates?companyHQId=${companyHQId}`);
      if (response.data?.success) {
        setTemplates(response.data.templates || []);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  };
  
  loadTemplates();
}, [authReady, ownerId, companyHQId]); // Wait for ALL prerequisites
```

### Step 4: ContactSelector (Third)
- ContactSelector already has guards for `ownerId` and `companyHQId`
- Just need to ensure it waits for `authReady` too
- Pass `authReady` as prop, or check inside component

---

## Changes Required

### 1. Remove SenderIdentityPanel Hook
- Remove `useOwner()` from SenderIdentityPanel
- Pass `ownerId` as prop from compose page
- Remove duplicate sender loading in compose page (let SenderIdentityPanel handle it)

### 2. Fix Templates useEffect
- Change dependency from `[ownerId]` to `[authReady, ownerId, companyHQId]`
- Add auth ready check

### 3. Remove Duplicate Sender Loading
- Compose page loads sender (line 177-193) ❌ REMOVE
- SenderIdentityPanel loads sender ✅ KEEP (but fix to not use hook)

### 4. Add Auth Ready Check
- Create `authReady` state
- Poll for `auth.currentUser` to be ready
- Use as guard for all API calls

### 5. Fix companyHQId Timing
- Read from localStorage immediately in useState initializer
- Sync with URL params in useEffect
- Pass to ContactSelector immediately (no empty string)

---

## Implementation Order

1. ✅ Add `authReady` check
2. ✅ Fix `companyHQId` initialization (read from localStorage immediately)
3. ✅ Remove duplicate sender loading from compose page
4. ✅ Fix SenderIdentityPanel to not use hooks
5. ✅ Fix templates useEffect (correct dependencies + auth ready check)
6. ✅ Update ContactSelector to wait for auth ready (or pass as prop)

---

## Expected Behavior After Fix

1. **Page loads** → Shows loading state
2. **Auth ready** → `authReady = true`
3. **ownerId loaded** → From localStorage
4. **companyHQId loaded** → From URL or localStorage
5. **Sender loads** → First API call (after auth + ownerId ready)
6. **Templates load** → Second API call (after auth + ownerId + companyHQId ready)
7. **Contacts load** → Third API call (via ContactSelector, after all ready)

**No 401 errors** ✅
**No race conditions** ✅
**Sequential loading** ✅

