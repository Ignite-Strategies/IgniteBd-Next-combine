# Multi-Tenant Microsoft OAuth Implementation

## Overview

This implementation supports true multi-tenant authentication where users from any Microsoft 365 organization (including GoDaddy Workspace) can authenticate and use the application.

## Architecture

### 1. Authorization Flow (Multi-Tenant)
- **Endpoint**: `https://login.microsoftonline.com/common`
- **Purpose**: Allows users from any organization to initiate authentication
- **Scopes**: `openid profile email offline_access User.Read Mail.Send Mail.Read Contacts.Read Contacts.ReadWrite Calendars.Read`

### 2. Token Exchange (Multi-Tenant)
- **Endpoint**: `https://login.microsoftonline.com/common`
- **Purpose**: Exchange authorization code for tokens
- **Returns**: Access token, refresh token, and ID token

### 3. Tenant ID Extraction
- **Source**: ID token (`tid` claim)
- **Storage**: Stored in `Owner.microsoftTenantId`
- **Purpose**: Identifies the user's organization for tenant-specific operations

### 4. Token Refresh (Tenant-Specific)
- **Endpoint**: `https://login.microsoftonline.com/${microsoftTenantId}/oauth2/v2.0/token`
- **Purpose**: Refresh access token using user's specific tenant
- **Why**: More efficient and ensures proper tenant isolation

## Database Schema

### Owner Model Updates

```prisma
model Owner {
  // ... other fields ...
  
  // Microsoft OAuth integration
  microsoftAccessToken  String?   // Access token
  microsoftRefreshToken String?   // Refresh token
  microsoftExpiresAt    DateTime? // Token expiration
  microsoftEmail        String?   // User's Microsoft email
  microsoftDisplayName  String?   // User's display name
  microsoftTenantId     String?   // Tenant ID from ID token (for tenant-specific refresh)
}
```

## Flow Diagram

```
1. User clicks "Connect with Microsoft"
   ↓
2. Redirect to: https://login.microsoftonline.com/common/oauth2/v2.0/authorize
   ↓
3. User selects organization (GoDaddy, Microsoft 365, personal, etc.)
   ↓
4. User authenticates and grants consent
   ↓
5. Redirect to: /api/microsoft/callback?code=xxx&state=xxx
   ↓
6. Exchange code for tokens (using 'common' endpoint)
   ↓
7. Extract tenant ID from ID token (tid claim)
   ↓
8. Store tokens + tenant ID in Owner record
   ↓
9. Future token refresh uses: https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token
```

## Code Implementation

### 1. Login Route (`/api/microsoft/login`)

```javascript
// Always use 'common' endpoint for multi-tenant authorization
const authority = 'https://login.microsoftonline.com/common';
const authUrl = `${authority}/oauth2/v2.0/authorize?${params}`;
```

### 2. Callback Route (`/api/microsoft/callback`)

```javascript
// Use 'common' endpoint for token exchange
const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,
    authority: 'https://login.microsoftonline.com/common',
    clientSecret: process.env.AZURE_CLIENT_SECRET,
  },
};

// Exchange code for tokens
const tokenResponse = await cca.acquireTokenByCode({
  code,
  scopes: ['openid', 'profile', 'email', 'offline_access', 'User.Read', ...],
  redirectUri,
});

// Extract tenant ID from ID token
const idTokenParts = tokenResponse.idToken.split('.');
const payload = JSON.parse(
  Buffer.from(idTokenParts[1], 'base64url').toString('utf-8')
);
const microsoftTenantId = payload.tid; // Tenant ID from ID token

// Store tokens + tenant ID
await prisma.owner.update({
  where: { id: ownerId },
  data: {
    microsoftAccessToken: tokenResponse.accessToken,
    microsoftRefreshToken: tokenResponse.refreshToken,
    microsoftTenantId: microsoftTenantId, // Store for tenant-specific refresh
    // ... other fields
  },
});
```

### 3. Token Refresh (`/lib/microsoftGraphClient.js`)

```javascript
// Get tenant ID from user record
const owner = await prisma.owner.findUnique({
  where: { id: ownerId },
  select: {
    microsoftTenantId: true, // Get stored tenant ID
    microsoftRefreshToken: true,
    // ... other fields
  },
});

// Use user's specific tenant for token refresh
const tenantId = owner.microsoftTenantId || 'common';
const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${tenantId}`, // Tenant-specific
    clientSecret: process.env.AZURE_CLIENT_SECRET,
  },
};

// Refresh token using tenant-specific endpoint
const tokenResponse = await cca.acquireTokenByRefreshToken({
  refreshToken: owner.microsoftRefreshToken,
  scopes: [...],
});
```

## Environment Variables

```bash
# Azure AD Configuration
AZURE_CLIENT_ID=c94ab2b5-daf8-4fab-970a-f42358bbae34
AZURE_CLIENT_SECRET=<your-client-secret>

# Application URLs
APP_URL=https://ignitegrowth.biz
MICROSOFT_REDIRECT_URI=https://ignitegrowth.biz/api/microsoft/callback

# Note: AZURE_TENANT_ID is NOT needed for multi-tenant
# The tenant ID is extracted from the ID token per user
```

## Scopes

### Required Scopes
- `openid` - OpenID Connect authentication
- `profile` - User profile information
- `email` - User email address
- `offline_access` - Refresh tokens
- `User.Read` - Read user profile

### Application Scopes
- `Mail.Send` - Send emails
- `Mail.Read` - Read emails
- `Contacts.Read` - Read contacts
- `Contacts.ReadWrite` - Read and write contacts
- `Calendars.Read` - Read calendar events

## Tenant Isolation

### Per-User Tenant ID
- Each user's tokens are associated with their tenant ID
- Token refresh uses the user's specific tenant endpoint
- Data is automatically isolated by tenant (Microsoft handles this)

### Security
- ✅ Users can only access their own organization's data
- ✅ Tokens are scoped to the user's tenant
- ✅ No cross-tenant access possible
- ✅ Tenant ID is stored securely with user record

## Testing

### Test with Different Organizations

1. **GoDaddy Workspace User**:
   - User from `ignitestrategies.co`
   - Should authenticate via GoDaddy tenant
   - Tenant ID stored: GoDaddy's tenant ID

2. **Microsoft 365 User**:
   - User from `contoso.com`
   - Should authenticate via Contoso tenant
   - Tenant ID stored: Contoso's tenant ID

3. **Personal Account**:
   - User with `@outlook.com`
   - Should authenticate via personal Microsoft account
   - Tenant ID stored: Personal account tenant ID

## Migration

### Database Migration

Run Prisma migration to add `microsoftTenantId` field:

```bash
npx prisma migrate dev --name add_microsoft_tenant_id
```

Or push the schema:

```bash
npx prisma db push
```

### Existing Users

- Existing users will have `microsoftTenantId = null`
- On next token refresh, if tenant ID is missing, it will use 'common' as fallback
- Users should reconnect to get tenant ID stored

## Troubleshooting

### "Invalid tenant" Error
- **Cause**: Tenant ID not stored or incorrect
- **Fix**: User should reconnect Microsoft account to extract tenant ID

### "Token refresh fails"
- **Cause**: Tenant ID mismatch or missing
- **Fix**: Check that `microsoftTenantId` is stored correctly

### "ID token missing"
- **Cause**: Scopes don't include `openid`
- **Fix**: Ensure `openid` scope is included in authorization request

## Benefits

### Multi-Tenant Support
- ✅ Users from any Microsoft 365 organization can authenticate
- ✅ GoDaddy Workspace users can authenticate
- ✅ Personal Microsoft accounts can authenticate
- ✅ No tenant-specific configuration needed

### Tenant Isolation
- ✅ Each user's tokens are tenant-specific
- ✅ Token refresh uses user's tenant endpoint
- ✅ Proper data isolation per organization

### Scalability
- ✅ No need to register app in each tenant
- ✅ Works automatically for any organization
- ✅ Centralized app management

## Next Steps

1. ✅ Update Prisma schema (add `microsoftTenantId`)
2. ✅ Run database migration
3. ✅ Update code to extract tenant ID from ID token
4. ✅ Update code to use tenant ID for token refresh
5. ✅ Test with users from different organizations
6. ✅ Verify tenant isolation

## Summary

- **Authorization**: Uses `common` endpoint (multi-tenant)
- **Token Exchange**: Uses `common` endpoint (multi-tenant)
- **Tenant ID**: Extracted from ID token and stored per user
- **Token Refresh**: Uses user's specific tenant endpoint
- **Result**: True multi-tenant support with proper tenant isolation

