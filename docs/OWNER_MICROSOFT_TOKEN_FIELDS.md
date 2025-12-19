# Owner Model - Microsoft Token Fields Audit

**Date:** 2025-01-27  
**Purpose:** Review current Microsoft token storage in `owners` model

---

## Current Owner Model Fields

**Location:** `prisma/schema.prisma` (lines 608-613)

```prisma
model owners {
  // ... other fields ...
  microsoftAccessToken      String?
  microsoftRefreshToken     String?
  microsoftExpiresAt        DateTime?
  microsoftEmail            String?
  microsoftDisplayName      String?
  microsoftTenantId         String?
  // ... other fields ...
}
```

---

## Field Usage

### `microsoftAccessToken` (String?)
**Purpose:** OAuth access token for Microsoft Graph API calls  
**Storage:** Encrypted/plain string in database  
**Usage:**
- Used in: `lib/microsoftGraphClient.js` - `getValidAccessToken()`
- Used in: All Graph API calls (contacts, mail, calendar, etc.)
- **Status:** ✅ Required - Core token for API access

### `microsoftRefreshToken` (String?)
**Purpose:** OAuth refresh token to get new access tokens  
**Storage:** Encrypted/plain string in database  
**Usage:**
- Used in: `lib/microsoftGraphClient.js` - `refreshAccessToken()`
- Used when: Access token expires (auto-refresh)
- **Status:** ✅ Required - Needed for token refresh

### `microsoftExpiresAt` (DateTime?)
**Purpose:** When the access token expires  
**Storage:** DateTime in database  
**Usage:**
- Used in: `lib/microsoftGraphClient.js` - Token expiration check
- Logic: 5-minute buffer before expiration triggers refresh
- **Status:** ✅ Required - Needed for expiration checking

### `microsoftEmail` (String?)
**Purpose:** User's Microsoft account email  
**Storage:** String in database  
**Usage:**
- Set in: `app/api/microsoft/callback/route.js` - After OAuth
- Displayed in: `/settings/integrations` - Connection status
- **Status:** ✅ Useful - Shows which account is connected

### `microsoftDisplayName` (String?)
**Purpose:** User's Microsoft account display name  
**Storage:** String in database  
**Usage:**
- Set in: `app/api/microsoft/callback/route.js` - After OAuth
- Displayed in: `/settings/integrations` - Connection status
- **Status:** ✅ Useful - Shows which account is connected

### `microsoftTenantId` (String?)
**Purpose:** Microsoft tenant ID (for multi-tenant token refresh)  
**Storage:** String in database  
**Usage:**
- Set in: `app/api/microsoft/callback/route.js` - Extracted from ID token
- Used in: `lib/microsoftGraphClient.js` - `refreshAccessToken()` uses tenant-specific authority
- **Status:** ✅ Required - Needed for proper token refresh in multi-tenant scenarios

---

## Token Storage Flow

**OAuth Callback** (`app/api/microsoft/callback/route.js`):
```javascript
await prisma.owners.update({
  where: { id: ownerId },
  data: {
    microsoftAccessToken: tokenResponse.accessToken,
    microsoftRefreshToken: tokenResponse.refreshToken || '',
    microsoftExpiresAt: expiresAt,
    microsoftEmail: microsoftEmail,
    microsoftDisplayName: microsoftDisplayName,
    microsoftTenantId: microsoftTenantId,
  },
});
```

**Token Refresh** (`lib/microsoftGraphClient.js`):
```javascript
await prisma.owners.update({
  where: { id: ownerId },
  data: {
    microsoftAccessToken: tokenResponse.accessToken,
    microsoftRefreshToken: tokenResponse.refreshToken || owner.microsoftRefreshToken,
    microsoftExpiresAt: expiresAt,
  },
});
```

---

## Field Assessment

### ✅ All Fields Are Used
- All 6 fields are actively used in the codebase
- No dead/unused fields found

### ✅ Fields Are Sufficient
**For Contact Hydration:**
- ✅ `microsoftAccessToken` - Needed for Graph API calls
- ✅ `microsoftRefreshToken` - Needed for token refresh
- ✅ `microsoftExpiresAt` - Needed for expiration checking
- ✅ `microsoftTenantId` - Needed for proper refresh
- ⚠️ `microsoftEmail` - Not needed for hydration, but useful for display
- ⚠️ `microsoftDisplayName` - Not needed for hydration, but useful for display

**No additional fields needed for contact hydration.**

---

## Security Considerations

### Current Storage
- Tokens stored as plain strings in database
- No encryption at rest (database-level)
- Access controlled via Firebase auth on API routes

### Recommendations (Not Required)
- Consider encrypting tokens at application level (if security requirements demand)
- Current approach is standard for OAuth token storage

---

## Summary

**Current Fields:** 6 fields total
- ✅ All fields are used
- ✅ All fields are necessary
- ✅ No additional fields needed for contact hydration

**For Contact Hydration:**
- Only need: `microsoftAccessToken`, `microsoftRefreshToken`, `microsoftExpiresAt`, `microsoftTenantId`
- Optional but useful: `microsoftEmail`, `microsoftDisplayName` (for UI display)

**Verdict:** ✅ **No additional fields needed** - Current schema is sufficient.
