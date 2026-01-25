# Microsoft Token Check Logic - What Should We Actually Check?

## The Question

**What should the API check to confirm "connected"?**

## Current Implementation

### `/api/microsoft/status` (Line 98)
```javascript
const isConnected = !!owner.microsoftAccessToken;
```

**Checks**: Just access token exists

### `getValidAccessToken()` (Lines 28-30, 66-72)
```javascript
if (!owner || !owner.microsoftAccessToken) {
  throw new Error('Microsoft account not connected');
}

// Later when refreshing:
if (!owner.microsoftRefreshToken) {
  throw new Error('No refresh token available. Please reconnect your Microsoft account.');
}
```

**Requires**: 
1. Access token exists (to start)
2. Refresh token exists (to refresh when expired)

## The Problem

### Scenario 1: Only Access Token
- Access token exists ✅
- Refresh token missing ❌
- Token expires in 1 hour
- **Result**: Works for 1 hour, then breaks forever ❌

### Scenario 2: Both Tokens
- Access token exists ✅
- Refresh token exists ✅
- Token expires in 1 hour
- **Result**: Works forever (can always refresh) ✅

## What `getValidAccessToken()` Actually Needs

Looking at the code:
1. **Line 28**: Checks for access token (throws if missing)
2. **Line 37**: If expired, calls `refreshAccessToken()`
3. **Line 70**: `refreshAccessToken()` requires refresh token (throws if missing)

**So the actual requirement is:**
- Access token exists (to use now)
- Refresh token exists (to refresh when needed)

## The Right Check

### Option 1: Just Access Token (Current - Simple)
```javascript
const isConnected = !!owner.microsoftAccessToken;
```

**Pros:**
- Simple
- Fast
- Works for immediate use

**Cons:**
- If no refresh token, breaks after 1 hour
- Doesn't match what `getValidAccessToken()` actually needs

### Option 2: Both Tokens (Robust)
```javascript
const isConnected = !!(
  owner.microsoftAccessToken &&
  owner.microsoftRefreshToken
);
```

**Pros:**
- Matches what `getValidAccessToken()` actually needs
- Works long-term (can always refresh)
- More accurate

**Cons:**
- Slightly more complex
- Might show "not connected" if refresh token missing (even though access token exists)

### Option 3: Access Token OR Refresh Token (Permissive)
```javascript
const isConnected = !!(
  owner.microsoftAccessToken || 
  owner.microsoftRefreshToken
);
```

**Pros:**
- Most permissive
- Works if either exists

**Cons:**
- If only refresh token exists, can't use it immediately (need to refresh first)
- Doesn't match real usage pattern

## Recommendation

**Use Option 2: Check BOTH tokens**

**Why:**
1. Matches what `getValidAccessToken()` actually requires
2. Ensures long-term functionality
3. More accurate representation of "connected" state

**The Logic:**
```javascript
// Connected = We have BOTH tokens (can use now AND refresh later)
const isConnected = !!(
  owner.microsoftAccessToken &&  // Can use now
  owner.microsoftRefreshToken    // Can refresh when expired
);
```

**This is what actually makes you "connected"** - having both means you can use Microsoft APIs now AND in the future.

