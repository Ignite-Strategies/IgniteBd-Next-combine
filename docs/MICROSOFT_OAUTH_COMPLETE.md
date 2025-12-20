# Microsoft OAuth Integration - Complete Documentation

**Last Updated:** 2025-01-27  
**Status:** ✅ Production Ready

## Overview

This document describes the complete Microsoft OAuth integration for importing email contacts. The system uses OAuth 2.0 Authorization Code Flow to securely authenticate users and access Microsoft Graph API.

## Architecture Principles

### 1. Owner Identity (Source of Truth)
- **Firebase is the primary identity system** - Owner is resolved via `firebaseId` (Firebase UID)
- **Microsoft OAuth is an attached integration** - Tokens are stored on the Owner record, but do NOT define identity
- **Standard Pattern:** All routes resolve owner via `firebaseId` from Firebase token:
  ```javascript
  const firebaseUser = await verifyFirebaseToken(request);
  const owner = await prisma.owners.findUnique({
    where: { firebaseId: firebaseUser.uid },
  });
  ```

### 2. Frontend Pattern (useOwner Hook)
- **All frontend code uses `useOwner()` hook** - No direct API calls for owner data
- **Status check is instant** - Check `owner.microsoftAccessToken` directly (boolean)
- **No `/api/microsoft/status` calls** - That route was deprecated (duplicated logic)

### 3. OAuth Flow (Authorization Code Flow)
- **Login endpoint:** Redirects to Microsoft (no tokens needed)
- **Callback endpoint:** Exchanges code for tokens (server-side only)
- **Never expect tokens before exchange** - Microsoft returns `?code=`, not `access_token`

## Database Schema

### Owner Model Fields (Microsoft OAuth)

```prisma
model owners {
  id                    String    @id
  firebaseId            String    @unique  // Primary identity (Firebase UID)
  
  // Microsoft OAuth tokens (stored directly on owner)
  microsoftAccessToken    String?
  microsoftRefreshToken   String?
  microsoftExpiresAt      DateTime?
  microsoftEmail          String?
  microsoftDisplayName    String?
  microsoftTenantId       String?  // Used for tenant-specific token refresh
  
  // ... other fields
}
```

**Key Points:**
- Tokens are stored directly on the `owners` table (no separate integration table)
- `microsoftTenantId` is extracted from ID token and stored for future token refresh
- Token expiration is calculated and stored as `microsoftExpiresAt`

## Environment Variables

```bash
# Required
AZURE_CLIENT_ID=xxx              # App Registration Client ID (NOT tenant ID!)
AZURE_CLIENT_SECRET=xxx          # App Registration Client Secret
MICROSOFT_REDIRECT_URI=https://app.ignitegrowth.biz/api/microsoft/callback

# Optional
APP_URL=https://app.ignitegrowth.biz  # Default redirect URL
AZURE_TENANT_ID=xxx              # DO NOT USE for OAuth (only for admin operations)
```

**CRITICAL:** 
- `AZURE_CLIENT_ID` is ALWAYS used for OAuth (never `AZURE_TENANT_ID`)
- Authority is ALWAYS `https://login.microsoftonline.com/common` (supports personal + work accounts)
- Runtime assertions prevent using tenant ID for OAuth

## API Routes

### 1. `/api/microsoft/login` (GET)

**Purpose:** Initiates Microsoft OAuth Authorization Code Flow

**Flow:**
1. User clicks "Connect Microsoft" → Frontend navigates to `/api/microsoft/login?ownerId=xxx`
2. Endpoint redirects to Microsoft OAuth authorize endpoint
3. User authenticates with Microsoft
4. Microsoft redirects back to `/api/microsoft/callback` with `?code=`

**Key Points:**
- **No authentication required** - This is a redirect-only endpoint
- **No tokens expected** - OAuth flow hasn't started yet
- **ownerId is optional** - Can be encoded in OAuth state parameter
- **Uses direct browser navigation** - Frontend uses `window.location.href` (not AJAX)

**Implementation:**
```javascript
// Frontend (contacts/ingest/microsoft/page.jsx)
function handleConnectMicrosoft() {
  window.location.href = `/api/microsoft/login?ownerId=${ownerId}`;
}

// Backend (app/api/microsoft/login/route.js)
// - Validates OAuth config (clientId, authority)
// - Generates state parameter (CSRF protection + optional ownerId)
// - Redirects to Microsoft OAuth authorize endpoint
```

**OAuth Scopes Requested:**
- `openid`, `profile`, `email` (identity)
- `offline_access` (refresh token)
- `User.Read` (read user profile)
- `Mail.Read` (read email messages)
- `Mail.Send` (send email)
- `Contacts.Read`, `Contacts.ReadWrite` (read/write contacts)
- `Calendars.Read` (read calendar)

### 2. `/api/microsoft/callback` (GET)

**Purpose:** Handles OAuth callback, exchanges authorization code for tokens

**Flow:**
1. Microsoft redirects here with `?code=XYZ` (authorization code)
2. Extract `code` from query params
3. Decode `state` parameter to get `ownerId` (if present)
4. Exchange `code` for `access_token` + `refresh_token` (server-side)
5. Extract user info from ID token (email, displayName, tenantId)
6. Find owner by `ownerId` (from state) or by Microsoft email (fallback)
7. Store tokens on Owner record
8. Redirect to `/contacts/ingest/microsoft?success=1`

**Key Points:**
- **Server-side only** - No 'use client' directive
- **Uses `request.nextUrl.searchParams`** - Next.js App Router pattern
- **Token exchange requires `client_secret`** - Never exposed to client
- **Fallback owner lookup** - If `ownerId` not in state, finds by Microsoft email

**Implementation:**
```javascript
// Extract code from callback
const code = request.nextUrl.searchParams.get('code');
if (!code) {
  return NextResponse.redirect(`${appUrl}/contacts/ingest/microsoft?error=no_authorization_code_provided`);
}

// Exchange code for tokens (server-side)
const tokenResponse = await cca.acquireTokenByCode({
  code,
  scopes: [...],
  redirectUri,
});

// Store tokens on Owner
await prisma.owners.update({
  where: { id: ownerId },
  data: {
    microsoftAccessToken: tokenResponse.accessToken,
    microsoftRefreshToken: tokenResponse.refreshToken,
    microsoftExpiresAt: expiresAt,
    microsoftEmail: microsoftEmail,
    microsoftDisplayName: microsoftDisplayName,
    microsoftTenantId: microsoftTenantId,
  },
});
```

**Error Handling:**
- Missing `code` → Redirect with `?error=no_authorization_code_provided`
- Owner not found → Redirect with `?error=owner_not_found`
- Token exchange fails → Redirect with `?error=oauth_failed`

### 3. `/api/microsoft/email-contacts/preview` (GET)

**Purpose:** Fetches recent email messages and aggregates senders into contact preview

**Flow:**
1. Verify Firebase authentication
2. Resolve owner from `firebaseId`
3. Check Redis cache (`preview:microsoft_email:${ownerId}`)
4. If cached → return cached data
5. If not cached → Get valid access token (handles refresh automatically)
6. Fetch 50 recent messages from Microsoft Graph
7. Aggregate unique senders (email, displayName, domain, stats)
8. Store in Redis (45 min TTL)
9. Return preview data

**Key Points:**
- **Uses standard owner resolution pattern** - `firebaseId` from Firebase token
- **Token refresh handled automatically** - `getValidAccessToken()` refreshes if expired
- **Returns 401 if not connected** - No Microsoft tokens = not connected
- **Redis caching** - Prevents repeated Graph API calls

**Response Format:**
```json
{
  "success": true,
  "generatedAt": "2025-01-27T10:00:00Z",
  "limit": 50,
  "items": [
    {
      "previewId": "hash_of_email",
      "email": "user@example.com",
      "displayName": "John Doe",
      "domain": "example.com",
      "stats": {
        "firstSeenAt": "2025-01-27T10:00:00Z",
        "lastSeenAt": "2025-01-27T12:00:00Z",
        "messageCount": 5
      }
    }
  ]
}
```

### 4. `/api/microsoft/email-contacts/save` (POST)

**Purpose:** Saves selected contacts from preview to database

**Flow:**
1. Verify Firebase authentication
2. Resolve owner from `firebaseId`
3. Load preview from Redis (`preview:microsoft_email:${ownerId}`)
4. Filter by `previewIds` (selected contacts)
5. For each selected contact:
   - Split `displayName` into `firstName`/`lastName`
   - Create `Contact` record (skip if exists)
6. Return save results

**Request:**
```json
{
  "previewIds": ["hash1", "hash2"],
  "companyHQId": "xxx"
}
```

**Response:**
```json
{
  "success": true,
  "saved": 2,
  "skipped": 0,
  "errors": []
}
```

## Frontend Implementation

### useOwner Hook

**Location:** `/hooks/useOwner.js`

**Purpose:** Provides owner data to all components

**How it works:**
1. Loads from localStorage (instant)
2. Calls `/api/owner/hydrate` to hydrate with memberships
3. Returns: `{ ownerId, owner, companyHQId, companyHQ, memberships }`

**Usage:**
```javascript
import { useOwner } from '@/hooks/useOwner';

const { ownerId, owner } = useOwner();

// Check Microsoft connection (instant, no API call)
const isConnected = !!owner?.microsoftAccessToken;
```

### Contacts Ingest Page

**Location:** `/app/(authenticated)/contacts/ingest/microsoft/page.jsx`

**Flow:**
1. Get `ownerId` and `owner` from `useOwner()` hook
2. Check `owner.microsoftAccessToken` → `isConnected` (boolean)
3. Show green/red status based on token existence
4. If connected → Load preview automatically (useEffect)
5. User selects contacts → Save via `/api/microsoft/email-contacts/save`

**Key Points:**
- **No `/api/microsoft/status` calls** - Status comes from `owner` object
- **Simple boolean check** - `isConnected = !!owner?.microsoftAccessToken`
- **OAuth uses direct navigation** - `window.location.href` (not AJAX)
- **Preview loads automatically** - useEffect watches `isConnected`

**Status Display:**
```javascript
// Green (connected)
{isConnected && (
  <CheckCircle2 className="text-green-500" />
  <p>Connected</p>
  <p>{owner.microsoftEmail}</p>
)}

// Red (not connected)
{!isConnected && (
  <AlertCircle className="text-red-500" />
  <p>Not connected</p>
  <button onClick={handleConnectMicrosoft}>Connect</button>
)}
```

## OAuth Guardrails

**Location:** `/lib/microsoftOAuthGuardrails.js`

**Purpose:** Runtime assertions to prevent OAuth misconfiguration

**Functions:**
- `assertValidMicrosoftOAuthConfig(clientId, authority)` - Throws if config is wrong
- `getMicrosoftClientId()` - Returns validated `AZURE_CLIENT_ID`
- `getMicrosoftAuthority()` - Always returns `"https://login.microsoftonline.com/common"`

**Assertions:**
- `clientId` must be `AZURE_CLIENT_ID` (never `AZURE_TENANT_ID`)
- `authority` must be `"common"` for user login flows
- Fails fast in development if invariants violated

## Token Refresh

**Location:** `/lib/microsoftGraphClient.js`

**Purpose:** Handles automatic token refresh when expired

**How it works:**
1. `getValidAccessToken(ownerId)` checks if token is expired
2. If expired → Uses `microsoftRefreshToken` + `microsoftTenantId` to refresh
3. Updates `microsoftAccessToken` and `microsoftExpiresAt` in database
4. Returns valid access token

**Key Points:**
- **Tenant-specific refresh** - Uses `microsoftTenantId` for tenant-specific authority
- **Automatic** - Called by preview route before Graph API calls
- **Transparent** - Frontend doesn't need to handle refresh

## Common Patterns

### ✅ DO

1. **Resolve owner from Firebase:**
   ```javascript
   const firebaseUser = await verifyFirebaseToken(request);
   const owner = await prisma.owners.findUnique({
     where: { firebaseId: firebaseUser.uid },
   });
   ```

2. **Check connection status from hook:**
   ```javascript
   const { owner } = useOwner();
   const isConnected = !!owner?.microsoftAccessToken;
   ```

3. **Use direct navigation for OAuth:**
   ```javascript
   window.location.href = `/api/microsoft/login?ownerId=${ownerId}`;
   ```

4. **Handle OAuth callback errors:**
   ```javascript
   const errorParam = params.get('error');
   if (errorParam === 'owner_not_found') {
     // Handle error
   }
   ```

### ❌ DON'T

1. **Don't call `/api/microsoft/status`** - Use `owner.microsoftAccessToken` from hook
2. **Don't use AJAX for OAuth login** - Use `window.location.href`
3. **Don't expect tokens before exchange** - Microsoft returns `?code=`, not `access_token`
4. **Don't use `AZURE_TENANT_ID` for OAuth** - Always use `AZURE_CLIENT_ID`
5. **Don't query owner by `id` directly** - Always resolve from `firebaseId`

## Error Handling

### OAuth Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `no_authorization_code_provided` | User cancelled OAuth or code missing | User must complete OAuth flow |
| `owner_not_found` | Cannot find owner to save tokens | Ensure user is authenticated via Firebase |
| `oauth_failed` | Token exchange failed | Check Azure app registration config |

### API Errors

| Status | Cause | Solution |
|-------|-------|----------|
| 401 | No Microsoft tokens | User must connect Microsoft account |
| 404 | Owner not found | User must be authenticated via Firebase |
| 500 | Graph API error | Check Microsoft token validity |

## Testing Checklist

- [ ] Personal Microsoft account (@live.com, @outlook.com) can sign in
- [ ] Work/school account can sign in
- [ ] OAuth redirects correctly to Microsoft
- [ ] Callback stores tokens correctly
- [ ] Preview loads after connection
- [ ] Token refresh works automatically
- [ ] Status shows green when connected
- [ ] Status shows red when not connected
- [ ] No `/api/microsoft/status` calls in codebase
- [ ] All routes use standard owner resolution pattern

## Troubleshooting

### "No authorization code provided"
- User cancelled OAuth flow
- Check redirect URI matches Azure app registration

### "Owner not found"
- User not authenticated via Firebase
- Check Firebase token is valid
- Ensure owner record exists for Firebase UID

### "Microsoft account not connected"
- No tokens stored on owner record
- User must complete OAuth flow
- Check `owner.microsoftAccessToken` is null

### CORS errors on login
- Frontend using AJAX instead of direct navigation
- Use `window.location.href` for OAuth login

### Personal accounts blocked
- Azure app registration "Supported account types" must include personal accounts
- Check app registration settings in Azure Portal

## Migration Notes

### Removed Routes

- `/api/microsoft/status` - **DEPRECATED** (duplicated owner resolution logic)
  - **Replacement:** Use `owner.microsoftAccessToken` from `useOwner()` hook
  - **Reason:** Status check is instant from hook, no API call needed

### Updated Patterns

- **Before:** Call `/api/microsoft/status` to check connection
- **After:** Check `owner.microsoftAccessToken` from hook

- **Before:** Resolve `ownerId` from status API response
- **After:** Get `ownerId` directly from `useOwner()` hook

## Related Files

- `/app/api/microsoft/login/route.js` - OAuth login endpoint
- `/app/api/microsoft/callback/route.js` - OAuth callback endpoint
- `/app/api/microsoft/email-contacts/preview/route.js` - Preview endpoint
- `/app/api/microsoft/email-contacts/save/route.js` - Save endpoint
- `/app/(authenticated)/contacts/ingest/microsoft/page.jsx` - Frontend page
- `/hooks/useOwner.js` - Owner hook
- `/lib/microsoftOAuthGuardrails.js` - OAuth guardrails
- `/lib/microsoftGraphClient.js` - Graph API client + token refresh
- `/lib/firebaseAdmin.js` - Firebase token verification
- `/prisma/schema.prisma` - Owner model schema
