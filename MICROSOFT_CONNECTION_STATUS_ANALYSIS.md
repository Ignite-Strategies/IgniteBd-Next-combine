# Microsoft Connection Status Analysis

## The Core Problem (TL;DR)

**Tokens are stored in the database** (secure, server-side) ✅  
**localStorage was used to avoid exposing tokens** (security concern) ✅  
**But localStorage was never updated after OAuth** ❌  
**So we were checking stale localStorage data** ❌  
**Result: Always showed "not connected" even after connecting!** ❌

**The Fix:** Call API endpoint that checks database (source of truth) instead of localStorage.

---

## Problem

The Microsoft import page is checking connection status from `localStorage` which is **unreliable** and **out of sync** with the database.

## Current Broken Flow

1. **Page loads** → Reads `owner` from `localStorage`
2. **Checks connection** → `owner?.microsoftAccessToken ? true : false` (line 64)
3. **Problem**: localStorage is stale! Database has tokens but localStorage doesn't

## How Connection Status SHOULD Be Checked

### API Endpoint: `/api/microsoft/status`

**Location**: `app/api/microsoft/status/route.js`

**Returns**:
```json
{
  "connected": true,
  "email": "adam@ignitestrategies.co",
  "expiresAt": "2025-12-20T23:48:32Z"
}
```

**Connection Logic** (lines 50-55):
```javascript
const isConnected = !!(
  owner.microsoftAccessToken &&
  owner.microsoftRefreshToken &&
  expiresAt &&
  expiresAt > now
);
```

**Requirements for "Connected"**:
1. ✅ `microsoftAccessToken` exists
2. ✅ `microsoftRefreshToken` exists  
3. ✅ `microsoftExpiresAt` exists
4. ✅ `microsoftExpiresAt > now` (token not expired)

### Alternative: `/api/owner/hydrate`

**Location**: `app/api/owner/hydrate/route.js`

**Returns**:
```json
{
  "success": true,
  "owner": {
    "microsoftConnected": true,
    "microsoftEmail": "adam@ignitestrategies.co"
  }
}
```

**Connection Logic** (lines 110-113):
```javascript
const microsoftConnected = !!(
  owner.microsoftAccessToken &&
  owner.microsoftRefreshToken
);
```

**Note**: This is simpler - only checks for tokens, doesn't check expiration (assumes refresh will work)

## Database Schema

From `prisma/schema.prisma`:
```prisma
model owners {
  microsoftAccessToken    String?
  microsoftRefreshToken   String?
  microsoftExpiresAt      DateTime?
  microsoftEmail          String?
  microsoftDisplayName    String?
  microsoftTenantId       String?
}
```

## What Actually Happens During OAuth? (The Real Flow)

### Step 1: User Clicks "Connect Microsoft"
- Frontend calls `/api/microsoft/login?ownerId=xyz`
- Server generates OAuth URL with `state` parameter (contains ownerId)
- Redirects user to Microsoft login page

### Step 2: User Authenticates with Microsoft
- User logs in with Microsoft account
- Microsoft shows consent screen (permissions)
- User grants permissions
- Microsoft redirects back to `/api/microsoft/callback?code=ABC123&state=XYZ`

### Step 3: OAuth Callback - What We Get From Microsoft

**Location**: `app/api/microsoft/callback/route.js`

Microsoft sends us:
- `code` - Authorization code (one-time use, expires in ~10 minutes)
- `state` - Our encoded state (contains ownerId for security)

**We DO NOT get tokens yet!** Just an authorization code.

### Step 4: Exchange Code for Tokens

**Location**: `lib/microsoftTokenExchange.js`

We POST to Microsoft's token endpoint:
```
POST https://login.microsoftonline.com/common/oauth2/v2.0/token
```

**Microsoft Returns**:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",  // JWT token (long string)
  "refresh_token": "0.AXcA...",                   // Refresh token (long string)
  "expires_in": 3600,                             // Seconds until expiration
  "id_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",      // JWT with user info
  "token_type": "Bearer"
}
```

### Step 5: Decode ID Token to Get User Info

**Location**: `lib/microsoftTokenExchange.js` (lines 76-99)

The `id_token` is a JWT (JSON Web Token) with 3 parts: `header.payload.signature`

We decode the payload (base64url) to extract:
```javascript
{
  "tid": "39d16fb8-1702-4...",           // Tenant ID (Microsoft org ID)
  "preferred_username": "adam@ignite...", // User's email
  "email": "adam@ignite...",              // User's email (alternative)
  "name": "Adam Cole",                    // Display name
  "given_name": "Adam",                   // First name
  // ... other claims
}
```

### Step 6: Save Everything to Database

**Location**: `app/api/microsoft/callback/route.js` (lines 91-101)

We save ALL of this to the `owners` table:
```javascript
await prisma.owners.update({
  where: { id: ownerId },
  data: {
    microsoftAccessToken: tokenData.accessToken,      // The actual access token (JWT)
    microsoftRefreshToken: tokenData.refreshToken,    // The refresh token
    microsoftExpiresAt: tokenData.expiresAt,          // When access token expires
    microsoftEmail: tokenData.email,                  // From ID token payload
    microsoftDisplayName: tokenData.displayName,       // From ID token payload
    microsoftTenantId: tokenData.tenantId,            // From ID token payload (tid)
  },
});
```

## How Do We Know OAuth Actually Happened?

**Answer: We check if BOTH tokens exist in the database**

### The Proof of Authentication:

1. **`microsoftAccessToken`** - This is the JWT access token Microsoft gave us
   - Proves: User authenticated and granted permissions
   - Used to: Make API calls to Microsoft Graph
   - Expires: After ~1 hour (but we can refresh)

2. **`microsoftRefreshToken`** - This is the refresh token Microsoft gave us
   - Proves: User granted "offline_access" permission
   - Used to: Get new access tokens when old one expires
   - Expires: Usually doesn't expire (or very long-lived)

3. **`microsoftTenantId`** - This is the tenant/organization ID
   - Proves: We know which Microsoft org the user belongs to
   - Used to: Refresh tokens using tenant-specific endpoint
   - Source: Decoded from ID token (`tid` claim)

4. **`microsoftEmail`** - User's Microsoft email
   - Proves: We know which Microsoft account was connected
   - Source: Decoded from ID token (`preferred_username` or `email` claim)

5. **`microsoftDisplayName`** - User's display name
   - Source: Decoded from ID token (`name` or `given_name` claim)

### Connection Status Logic:

```javascript
// Connected = We have BOTH tokens (can always refresh if needed)
const isConnected = !!(
  owner.microsoftAccessToken &&  // Have access token
  owner.microsoftRefreshToken    // Have refresh token (can get new access token)
);
```

**Why both?**
- If we only have `accessToken` → It expires in 1 hour, then we're stuck
- If we only have `refreshToken` → We can get a new `accessToken` anytime
- If we have both → We're fully connected and can use Microsoft APIs

### What About Tenant ID?

**Tenant ID is NOT required for connection status**, but it's useful:
- Helps with token refresh (can use tenant-specific endpoint)
- Identifies which Microsoft organization the user belongs to
- Some Microsoft APIs are tenant-specific

**Connection can work without tenantId** - we can use `common` endpoint for refresh.

## Token Structure (What They Actually Are)

### Access Token (JWT)
```
eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6Ik1uQ19WWmNBVGZMMX...
```
- **Type**: JWT (JSON Web Token)
- **Contains**: User identity, permissions (scopes), expiration
- **Size**: ~500-2000 characters (long string)
- **Usage**: Sent in `Authorization: Bearer {token}` header
- **Expires**: ~1 hour

### Refresh Token
```
0.AXcA7Qm3K8vL2mN9pQr5sT7uV9wX1yZ3aB5cD7eF9gH1iJ3kL5mN7pQ9rS...
```
- **Type**: Opaque string (not JWT)
- **Contains**: Secret that Microsoft recognizes
- **Size**: Very long string (hundreds of characters)
- **Usage**: Exchanged for new access token
- **Expires**: Usually doesn't expire (or months/years)

### ID Token (JWT)
```
eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6Ik1uQ19WWmNBVGZMMX...
```
- **Type**: JWT (JSON Web Token)
- **Contains**: User info (email, name, tenantId) in payload
- **Usage**: We decode it once to extract user info, then discard
- **Not stored**: We extract what we need and save to separate fields

## The Fix

### ❌ WRONG (Current Implementation)
```javascript
// Reads from localStorage - STALE DATA
const owner = JSON.parse(localStorage.getItem('owner'));
const isMicrosoftConnected = owner?.microsoftAccessToken ? true : false;
```

### ✅ CORRECT (API-Based)
```javascript
// Calls API to get REAL status from database
const [connectionStatus, setConnectionStatus] = useState(null);

useEffect(() => {
  const checkStatus = async () => {
    try {
      const response = await api.get('/api/microsoft/status');
      setConnectionStatus({
        connected: response.data.connected,
        email: response.data.email,
      });
    } catch (error) {
      setConnectionStatus({ connected: false });
    }
  };
  checkStatus();
}, []);
```

## Why localStorage Fails - THE ROOT CAUSE

### The Security vs. Freshness Trade-off

**The Original (Broken) Pattern:**
1. **Tokens stored in database** ✅ (Correct - secure, server-side only)
2. **localStorage used for connection status** ❌ (Trying to avoid exposing tokens to frontend)
3. **localStorage never updated after OAuth** ❌ (The fatal flaw!)
4. **Frontend checks localStorage** ❌ (Always sees stale data)

### What Was Happening:

```
OAuth Flow:
1. User clicks "Connect Microsoft"
2. OAuth callback saves tokens to DATABASE ✅
3. localStorage is NOT updated ❌
4. Page reloads
5. Frontend reads localStorage → Still has old data (no tokens)
6. Frontend thinks: "Not connected!" ❌
7. Shows "Connect Microsoft" button → Even though user just connected!
```

### The Security Concern (Why localStorage Was Used):

**Original thinking:**
- "We can't send tokens to frontend (security risk)"
- "So let's check localStorage for `microsoftAccessToken`"
- "If it exists in localStorage, user is connected"

**The problem:**
- localStorage is client-side storage
- It's only updated when we explicitly update it
- OAuth callback saves to DATABASE, not localStorage
- localStorage becomes stale immediately after OAuth

### The Real Source of Brokenness:

**We were trying to solve:**
- ✅ Security: Don't expose tokens to frontend
- ❌ But created: Stale data problem

**The solution:**
- ✅ Security: API endpoint checks database (tokens never leave server)
- ✅ Freshness: API always returns current database state
- ✅ Best of both worlds: Secure AND accurate

## Solution Implementation - The Fix

### The New Pattern (Secure + Fresh):

1. **Tokens stay in database** ✅ (Never exposed to frontend)
2. **API endpoint checks database** ✅ (`/api/microsoft/status`)
3. **API returns safe data** ✅ (Connection status, email - NO tokens)
4. **Frontend calls API** ✅ (Always gets fresh data from database)
5. **localStorage only for ownerId** ✅ (For OAuth redirect, not connection status)

### Why This Works:

```
OAuth Flow (Fixed):
1. User clicks "Connect Microsoft"
2. OAuth callback saves tokens to DATABASE ✅
3. Redirect to page with ?success=1
4. Page loads → Calls /api/microsoft/status ✅
5. API checks DATABASE → Returns { connected: true, email: "..." }
6. Frontend shows: "Connected as adam@ignite..." ✅
```

### The Key Insight:

**We don't need tokens in localStorage to check connection status!**

- **Old way**: Check localStorage for token → Stale data ❌
- **New way**: Call API to check database → Fresh data ✅

**The API endpoint:**
- Checks database (source of truth)
- Returns connection status (boolean + email)
- Never exposes tokens (secure)
- Always current (fresh)

### Implementation Steps:

1. **On page load**: Call `/api/microsoft/status` to get real connection status
2. **On OAuth callback**: Call `/api/microsoft/status` again to refresh
3. **Never trust localStorage** for connection status
4. **Show loading state** while checking status
5. **Display detailed diagnostics** (from enhanced status endpoint)

## Files to Update

- `app/(authenticated)/contacts/ingest/microsoft/page.jsx`
  - Replace localStorage check with API call
  - Add connection status state
  - Call API on mount and after OAuth callback

