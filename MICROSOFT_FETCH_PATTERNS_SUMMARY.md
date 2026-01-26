# Microsoft Fetch Patterns - Analysis Summary

## Overview

This document consolidates the analysis done on Microsoft integration fetch patterns and connection status handling.

## Key Findings from Analysis

### 1. Connection Status Check - INCONSISTENCY FOUND ⚠️

**Current Implementation** (`app/(authenticated)/contacts/ingest/microsoft/page.jsx`):
- **Line 29**: Uses `/api/owner/hydrate` to check connection status
- **Line 31**: Checks `response.data.owner.microsoftConnected`

**Recommended Implementation** (per analysis docs):
- Should use `/api/microsoft/status` endpoint (created specifically for this)
- Returns detailed diagnostics and token information
- More focused on Microsoft connection status

**Status**: The frontend is using the wrong endpoint. Should switch to `/api/microsoft/status`.

---

### 2. Both Tokens Check - IMPLEMENTED ✅

**Implementation Status**:
- ✅ `/api/microsoft/status` checks BOTH `microsoftAccessToken` AND `microsoftRefreshToken` (line 105-108)
- ✅ `/api/owner/hydrate` checks BOTH tokens (line 110-113)
- ✅ `getValidAccessToken()` requires both tokens (lines 28, 70 in microsoftGraphClient.js)

**Connection Logic**:
```javascript
const isConnected = !!(
  owner.microsoftAccessToken &&  // Can use now
  owner.microsoftRefreshToken    // Can refresh when expired
);
```

**Why Both?**
- Access token expires in ~1 hour
- Refresh token allows getting new access tokens
- Without refresh token, connection breaks after 1 hour
- With both tokens, connection works indefinitely

---

### 3. Fetch Patterns - CONSISTENT ✅

**All Microsoft Graph API calls use consistent pattern**:

```javascript
// Pattern used in all routes:
const response = await fetch(graphUrl, {
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
});

if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  throw new Error(errorData.error?.message || `Graph API error: ${response.status}`);
}

const data = await response.json();
```

**Files using this pattern**:
- ✅ `app/api/microsoft/email-contacts/preview/route.js` (line 88-100)
- ✅ `app/api/microsoft/contacts/preview/route.js` (line 80-92)
- ✅ `lib/microsoftGraphClient.js` (multiple functions)

**Error Handling**:
- ✅ All routes catch fetch errors
- ✅ Return 401 if token missing
- ✅ Return 500 on Graph API errors
- ✅ Include error details in response

---

### 4. Token Refresh Pattern - IMPLEMENTED ✅

**Auto-refresh logic** (`lib/microsoftGraphClient.js`):
- `getValidAccessToken()` checks expiration (line 32-41)
- Auto-refreshes if expired or expiring soon (5 min buffer)
- Uses `refreshAccessToken()` which requires refresh token
- Updates database with new tokens

**All API routes use**:
```javascript
const accessToken = await getValidAccessToken(owner.id);
```

This ensures tokens are always valid before making Graph API calls.

---

## Issues Identified

### Issue 1: Frontend Using Wrong Endpoint ❌

**File**: `app/(authenticated)/contacts/ingest/microsoft/page.jsx`
**Line**: 29

**Current**:
```javascript
const response = await api.get('/api/owner/hydrate');
setIsConnected(response.data.owner.microsoftConnected || false);
```

**Should be**:
```javascript
const response = await api.get('/api/microsoft/status');
setIsConnected(response.data.connected || false);
```

**Why?**
- `/api/microsoft/status` is purpose-built for Microsoft connection status
- Returns detailed diagnostics
- More focused and maintainable
- Consistent with analysis recommendations

---

### Issue 2: Connection Status Check Happens Twice ⚠️

**Current flow**:
1. Page loads → Checks `/api/owner/hydrate` (line 27-38)
2. User clicks source → `handleLoadPreview()` discovers connection via 401 error (line 108-114)

**Problem**: 
- Two different ways to check connection
- If first check fails, user sees "Connect" button
- But actual connection might work (discovered on preview load)

**Recommendation**: 
- Use `/api/microsoft/status` for initial check
- Keep 401 error handling as fallback
- Show connection status from API, not from preview errors

---

## Fetch Pattern Analysis

### Current Fetch Patterns - All Good ✅

1. **Token Retrieval**: Uses `getValidAccessToken()` helper
2. **Graph API Calls**: Consistent `fetch()` with proper headers
3. **Error Handling**: Try/catch with proper error messages
4. **Response Parsing**: Checks `response.ok` before parsing JSON

### No Fetch Pattern Issues Found ✅

All Microsoft Graph API fetch calls follow the same pattern:
- ✅ Proper Authorization header
- ✅ Content-Type header
- ✅ Error handling
- ✅ Response validation
- ✅ JSON parsing with error catch

---

## Recommendations

### Priority 1: Fix Frontend Connection Check

**Action**: Update `page.jsx` to use `/api/microsoft/status` instead of `/api/owner/hydrate`

**File**: `app/(authenticated)/contacts/ingest/microsoft/page.jsx`
**Lines to change**: 27-38, 51-60

**Before**:
```javascript
const response = await api.get('/api/owner/hydrate');
setIsConnected(response.data.owner.microsoftConnected || false);
```

**After**:
```javascript
const response = await api.get('/api/microsoft/status');
setIsConnected(response.data.connected || false);
```

### Priority 2: Add Connection Diagnostics

**Action**: Show connection diagnostics from `/api/microsoft/status` response

**Benefit**: 
- Users can see why connection failed
- Debugging easier
- Better UX

### Priority 3: Consolidate Connection Checks

**Action**: Remove duplicate connection discovery logic

**Current**: 
- Initial check via API
- Secondary discovery via 401 error

**Better**:
- Single source of truth: `/api/microsoft/status`
- Use 401 errors only as fallback/validation

---

## Files That Need Updates

1. **`app/(authenticated)/contacts/ingest/microsoft/page.jsx`**
   - Line 29: Change from `/api/owner/hydrate` to `/api/microsoft/status`
   - Line 53: Same change for OAuth callback check
   - Consider showing diagnostics from status response

---

## Testing Checklist

After making changes:

- [ ] Connection status shows correctly on page load
- [ ] Connection status updates after OAuth callback
- [ ] "Connected" indicator shows when both tokens exist
- [ ] "Connect" button shows when tokens missing
- [ ] Preview loads correctly when connected
- [ ] 401 error shows when not connected (fallback)
- [ ] Diagnostics visible in console/UI (if added)

---

## Summary

**Fetch Patterns**: ✅ All consistent and correct
**Token Handling**: ✅ Auto-refresh working
**Connection Check**: ❌ Using wrong endpoint (should use `/api/microsoft/status`)
**Both Tokens Check**: ✅ Implemented correctly

**Main Issue**: Frontend is using `/api/owner/hydrate` instead of `/api/microsoft/status` for connection check.

**Fix Required**: Update `page.jsx` to use the correct endpoint.
