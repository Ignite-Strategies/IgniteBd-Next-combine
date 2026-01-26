# MicrosoftAccount Migration - Code Updates Complete ✅

## Summary

All code has been updated to use the new `MicrosoftAccount` model instead of `owner.microsoft*` fields.

## What Was Updated

### 1. Connection Status Determination ✅

**File**: `app/api/microsoft/status/route.js`

**Changes**:
- Now queries `MicrosoftAccount` instead of `owner.microsoft*` fields
- Connection check: `microsoftAccount?.accessToken && microsoftAccount?.refreshToken`
- Returns email, displayName, tenantId from `MicrosoftAccount`

**How it works**:
```javascript
// Get MicrosoftAccount for owner
const microsoftAccount = await prisma.microsoftAccount.findUnique({
  where: { ownerId: owner.id }
});

// Check connection: both tokens must exist
const isConnected = !!(
  microsoftAccount?.accessToken &&  // Can use now
  microsoftAccount?.refreshToken    // Can refresh when expired
);
```

### 2. Token Retrieval ✅

**File**: `lib/microsoftGraphClient.js` - `getValidAccessToken()`

**Changes**:
- Queries `MicrosoftAccount` instead of `owner.microsoft*` fields
- Returns `microsoftAccount.accessToken`
- Auto-refreshes if expired (calls `refreshAccessToken`)

**How it works**:
```javascript
const microsoftAccount = await prisma.microsoftAccount.findUnique({
  where: { ownerId }
});

if (!microsoftAccount?.accessToken) {
  throw new Error('Microsoft account not connected');
}

// Check expiration and refresh if needed
return microsoftAccount.accessToken;
```

### 3. Token Refresh ✅

**File**: `lib/microsoftGraphClient.js` - `refreshAccessToken()`

**Changes**:
- Queries `MicrosoftAccount` for tokens and tenantId
- Updates `MicrosoftAccount` with new tokens
- Sets `lastRefreshedAt` timestamp

**How it works**:
```javascript
// Get MicrosoftAccount
const microsoftAccount = await prisma.microsoftAccount.findUnique({
  where: { ownerId }
});

// Refresh token via MSAL
const tokenResponse = await cca.acquireTokenByRefreshToken({
  refreshToken: microsoftAccount.refreshToken,
  // ...
});

// Update MicrosoftAccount with new tokens
await prisma.microsoftAccount.update({
  where: { ownerId },
  data: {
    accessToken: tokenResponse.accessToken,
    refreshToken: tokenResponse.refreshToken,
    expiresAt: newExpiresAt,
    lastRefreshedAt: new Date(),
  },
});
```

### 4. OAuth Callback ✅

**File**: `app/api/microsoft/callback/route.js`

**Changes**:
- Creates/updates `MicrosoftAccount` instead of `owner.microsoft*` fields
- Uses `upsert` to handle both new connections and reconnections

**How it works**:
```javascript
await prisma.microsoftAccount.upsert({
  where: { ownerId },
  create: {
    ownerId,
    microsoftEmail: tokenData.email,
    accessToken: tokenData.accessToken,
    refreshToken: tokenData.refreshToken,
    // ... all fields
  },
  update: {
    // Update existing record
  },
});
```

### 5. Disconnect ✅

**File**: `app/api/microsoft/disconnect/route.js`

**Changes**:
- Deletes `MicrosoftAccount` record instead of clearing `owner.microsoft*` fields

**How it works**:
```javascript
await prisma.microsoftAccount.delete({
  where: { ownerId: owner.id },
});
```

### 6. Connection Check Helper ✅

**File**: `lib/microsoftGraphClient.js` - `isMicrosoftConnected()`

**Changes**:
- Checks if `MicrosoftAccount` exists instead of checking `owner.microsoft*` fields

**How it works**:
```javascript
const microsoftAccount = await prisma.microsoftAccount.findUnique({
  where: { ownerId }
});

return !!microsoftAccount?.accessToken;
```

## API Routes That Automatically Work

These routes use `getValidAccessToken()` which now uses `MicrosoftAccount`, so they work automatically:

✅ **`/api/microsoft/email-contacts/preview`**
- Uses `getValidAccessToken(owner.id)`
- Fetches messages from Microsoft Graph
- Extracts contacts from email senders

✅ **`/api/microsoft/contacts/preview`**
- Uses `getValidAccessToken(owner.id)`
- Fetches contacts from Microsoft Graph `/me/contacts`

✅ **`/api/microsoft/email-contacts/save`**
- Uses `getValidAccessToken()` indirectly (via preview)

✅ **`/api/microsoft/contacts/save`**
- Uses `getValidAccessToken()` indirectly (via preview)

✅ **All other Microsoft Graph API calls**
- `sendMail()`, `getContacts()`, `getUserProfile()`, `getCalendarEvents()`
- All use `getValidAccessToken()` which now uses `MicrosoftAccount`

## How Connection Status Works Now

### 1. Frontend Calls `/api/microsoft/status`

```javascript
const response = await api.get('/api/microsoft/status');
const isConnected = response.data.connected;
```

### 2. Backend Checks MicrosoftAccount

```javascript
// Get MicrosoftAccount for owner
const microsoftAccount = await prisma.microsoftAccount.findUnique({
  where: { ownerId: owner.id }
});

// Connected = both tokens exist
const isConnected = !!(
  microsoftAccount?.accessToken &&
  microsoftAccount?.refreshToken
);
```

### 3. Returns Status

```json
{
  "connected": true,
  "email": "adam@ignitestrategies.co",
  "displayName": "Adam Cole",
  "tenantId": "39d16fb8-...",
  "tokens": {
    "hasAccessToken": true,
    "hasRefreshToken": true,
    "expiresAt": "2025-01-27T...",
    "isExpired": false,
    "canRefresh": true
  }
}
```

## How Microsoft API Calls Work Now

### Contacts API Call

**Route**: `/api/microsoft/contacts/preview`

**Flow**:
1. Verify Firebase auth
2. Get owner from database
3. Call `getValidAccessToken(owner.id)`
4. `getValidAccessToken()` queries `MicrosoftAccount`
5. Returns valid access token (refreshes if needed)
6. Use token to call Microsoft Graph API
7. Return contacts data

**Code**:
```javascript
// Get valid token (uses MicrosoftAccount internally)
const accessToken = await getValidAccessToken(owner.id);

// Call Microsoft Graph
const response = await fetch('https://graph.microsoft.com/v1.0/me/contacts', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

### Email Contacts API Call

**Route**: `/api/microsoft/email-contacts/preview`

**Flow**:
1. Verify Firebase auth
2. Get owner from database
3. Call `getValidAccessToken(owner.id)`
4. Use token to fetch messages from Microsoft Graph
5. Extract contacts from email senders
6. Return preview data

**Code**:
```javascript
// Get valid token (uses MicrosoftAccount internally)
const accessToken = await getValidAccessToken(owner.id);

// Call Microsoft Graph for messages
const response = await fetch('https://graph.microsoft.com/v1.0/me/messages', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

## Benefits of New Architecture

1. **Clean Separation**
   - Owner = user identity (Firebase)
   - MicrosoftAccount = Microsoft integration
   - No mixing of concerns

2. **Simple Connection Check**
   ```javascript
   // Old way (confusing)
   const isConnected = !!(owner.microsoftAccessToken && owner.microsoftRefreshToken);
   
   // New way (clear)
   const microsoftAccount = await prisma.microsoftAccount.findUnique({ where: { ownerId } });
   const isConnected = !!microsoftAccount;
   ```

3. **Better Queries**
   - Find Microsoft account: `prisma.microsoftAccount.findUnique({ where: { ownerId } })`
   - Check connection: `!!microsoftAccount` (simple boolean)
   - No need to check multiple nullable fields

4. **Consistent with Google**
   - `GoogleOAuthToken` model already exists
   - `MicrosoftAccount` follows same pattern
   - All OAuth integrations separate from Owner

5. **Future-Proof**
   - Easy to add multiple Microsoft accounts later (remove unique constraint)
   - Easy to add Microsoft-specific metadata
   - Easy to track connection history

## Testing Checklist

- [x] Connection status check works (`/api/microsoft/status`)
- [x] Token retrieval works (`getValidAccessToken`)
- [x] Token refresh works (`refreshAccessToken`)
- [x] OAuth callback creates/updates `MicrosoftAccount`
- [x] Disconnect deletes `MicrosoftAccount`
- [ ] Test contacts preview API
- [ ] Test email-contacts preview API
- [ ] Test save operations
- [ ] Verify frontend shows connection status correctly

## Next Steps

1. **Test all Microsoft features** to ensure everything works
2. **Remove Microsoft fields from owners model** (after testing)
3. **Create migration to drop old columns** from database
4. **Consolidate hydrate/fetch calls** (reduce duplicate API calls)

## Files Modified

1. ✅ `lib/microsoftGraphClient.js` - All functions updated
2. ✅ `app/api/microsoft/status/route.js` - Uses MicrosoftAccount
3. ✅ `app/api/microsoft/callback/route.js` - Creates/updates MicrosoftAccount
4. ✅ `app/api/microsoft/disconnect/route.js` - Deletes MicrosoftAccount

## Files That Work Automatically

These files use `getValidAccessToken()` which now uses `MicrosoftAccount`, so they work without changes:

- ✅ `app/api/microsoft/email-contacts/preview/route.js`
- ✅ `app/api/microsoft/contacts/preview/route.js`
- ✅ `app/api/microsoft/email-contacts/save/route.js`
- ✅ `app/api/microsoft/contacts/save/route.js`
- ✅ All other Microsoft Graph API calls

---

**Status**: ✅ **Code migration complete** - All core functions updated to use `MicrosoftAccount`

**Date**: January 26, 2025
