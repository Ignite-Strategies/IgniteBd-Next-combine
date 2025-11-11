# Multi-Tenant Microsoft OAuth Configuration

## Overview

This application is **multi-tenant**, meaning users from different organizations (GoDaddy, Microsoft, any Azure AD tenant) can connect their Microsoft 365 accounts.

## Tenant Configuration

### Use "common" Tenant ✅

For multi-tenant support, use `common` as the tenant ID:

```bash
AZURE_TENANT_ID=common
```

This allows:
- ✅ Users from any Microsoft 365 organization to connect
- ✅ Personal Microsoft accounts (@outlook.com, @hotmail.com)
- ✅ GoDaddy Workspace Email users
- ✅ Any Azure AD organization
- ✅ Office 365 users

### How It Works

When `AZURE_TENANT_ID=common`:
1. User clicks "Connect with Microsoft"
2. Microsoft OAuth shows organization picker
3. User selects their organization or personal account
4. OAuth completes with their organization's tenant
5. Tokens are stored per user (scoped to their organization)

## Azure AD App Registration

### Multi-Tenant App Setup

1. **App Registration**:
   - Register app in Azure Portal (any tenant)
   - Set **Supported account types** to:
     - `Accounts in any organizational directory and personal Microsoft accounts (Common)` ✅

2. **Redirect URIs**:
   - Add: `https://ignitegrowth.biz/api/microsoft/callback`
   - Platform: **Web**

3. **API Permissions**:
   - Add Microsoft Graph **Delegated permissions**:
     - `User.Read`
     - `Mail.Send`
     - `Mail.Read`
     - `Contacts.Read`
     - `Contacts.ReadWrite`
     - `Calendars.Read`
     - `offline_access`

4. **Admin Consent** (Optional):
   - Each organization's admin can grant consent
   - Or users grant consent individually
   - No global admin consent needed for multi-tenant

## Environment Variables

```bash
# Multi-tenant configuration
AZURE_TENANT_ID=common  # ✅ Allows any organization
AZURE_CLIENT_ID=<your-app-client-id>
AZURE_CLIENT_SECRET=<your-client-secret>

# Application URLs
APP_URL=https://ignitegrowth.biz
MICROSOFT_REDIRECT_URI=https://ignitegrowth.biz/api/microsoft/callback
```

## User Flow

### For GoDaddy Users
1. User connects Microsoft account
2. Sees Microsoft login page
3. Selects "Work or school account"
4. Enters `user@ignitestrategies.co`
5. Authenticates with GoDaddy credentials
6. Grants consent for IgniteGrowth
7. Tokens stored in database (scoped to GoDaddy tenant)

### For Regular Microsoft 365 Users
1. User connects Microsoft account
2. Sees Microsoft login page
3. Selects their organization
4. Authenticates
5. Grants consent
6. Tokens stored (scoped to their tenant)

### For Personal Microsoft Accounts
1. User connects Microsoft account
2. Sees Microsoft login page
3. Selects "Personal account"
4. Authenticates with @outlook.com/@hotmail.com
5. Grants consent
6. Tokens stored (scoped to personal account)

## Token Storage

Each user's tokens are stored separately in the `Owner` model:
- `microsoftAccessToken` - User's access token
- `microsoftRefreshToken` - User's refresh token
- `microsoftExpiresAt` - Token expiration
- `microsoftEmail` - User's Microsoft email
- `microsoftDisplayName` - User's display name

Tokens are **tenant-specific** - each user's tokens only work for their organization.

## Security Considerations

### Tenant Isolation
- ✅ Each user's tokens are isolated
- ✅ Users can only access their own Microsoft data
- ✅ Tokens are scoped to the user's organization
- ✅ No cross-tenant access

### Consent
- Each organization grants consent independently
- Users see consent screen for their organization
- Admin consent can be granted per organization
- Personal accounts grant individual consent

### Token Refresh
- Tokens are refreshed per user
- Refresh uses the user's organization's token endpoint
- No cross-tenant token refresh

## Error Handling

The error handler filters third-party errors (GoDaddy, browser extensions) for **all users**:
- ✅ Works for multi-tenant scenarios
- ✅ Filters errors regardless of user's organization
- ✅ Doesn't interfere with Microsoft OAuth flow
- ✅ Keeps console clean for all users

## Testing Multi-Tenant

### Test with Different Organizations

1. **GoDaddy User**:
   - Connect with `user@ignitestrategies.co`
   - Should authenticate via GoDaddy tenant
   - Tokens stored with GoDaddy tenant scope

2. **Microsoft 365 User**:
   - Connect with `user@contoso.com`
   - Should authenticate via Contoso tenant
   - Tokens stored with Contoso tenant scope

3. **Personal Account**:
   - Connect with `user@outlook.com`
   - Should authenticate via personal account
   - Tokens stored with personal account scope

### Verify Token Isolation

- User A's tokens should only work for User A's organization
- User B's tokens should only work for User B's organization
- No cross-tenant access possible

## Troubleshooting

### "Invalid tenant" Error
- **Cause**: App not configured for multi-tenant
- **Fix**: Set `AZURE_TENANT_ID=common` and configure app for multi-tenant

### "App not found" Error
- **Cause**: App not registered in user's tenant
- **Fix**: App must be multi-tenant (supports "common" tenant)

### "Consent required" Error
- **Cause**: User hasn't granted consent
- **Fix**: User needs to complete OAuth flow and grant consent

### Organization-Specific Issues
- Some organizations may have restrictions
- Some organizations may require admin consent
- Some organizations may block third-party apps

## Best Practices

1. ✅ **Always use `common` tenant** for multi-tenant apps
2. ✅ **Store tokens per user** (already done in Owner model)
3. ✅ **Handle consent per organization** (Microsoft handles this)
4. ✅ **Refresh tokens per user** (already implemented)
5. ✅ **Isolate data per user** (tokens are tenant-scoped)

## Current Configuration

The app is already configured for multi-tenant:
- ✅ Uses `AZURE_TENANT_ID || 'common'` (defaults to common)
- ✅ Stores tokens per user in Owner model
- ✅ Refreshes tokens per user
- ✅ Supports any Microsoft 365 organization

Just make sure your Azure AD app registration is configured for multi-tenant support!

