# Multi-Tenant Wiring Fix

## The Issue

The Azure AD app was correctly registered as **multi-tenant** ("Multiple organizations"), but the code was using a **specific tenant ID** instead of `common` for the OAuth endpoints.

## What Was Wrong

- ❌ Using `process.env.AZURE_TENANT_ID` (specific tenant: `39d16fb8-1702-491b-8626-35bba0215ae5`)
- ❌ This limits OAuth to only that specific tenant
- ❌ Users from other organizations can't sign in

## What's Fixed

- ✅ Always use `common` endpoint for OAuth authorization
- ✅ Always use `common` endpoint for token exchange
- ✅ Always use `common` endpoint for token refresh
- ✅ Works for users from any organization

## Changes Made

### 1. Login Route (`/api/microsoft/login`)
- Changed from: `process.env.AZURE_TENANT_ID || 'common'`
- Changed to: `'common'` (hardcoded for multi-tenant)

### 2. Callback Route (`/api/microsoft/callback`)
- Changed from: `process.env.AZURE_TENANT_ID || 'common'`
- Changed to: `'common'` (hardcoded for multi-tenant)

### 3. Graph Client (`/lib/microsoftGraphClient.js`)
- Changed from: `process.env.AZURE_TENANT_ID || 'common'`
- Changed to: `'common'` (hardcoded for multi-tenant)

## How It Works Now

1. **User clicks "Connect with Microsoft"**
   - OAuth URL uses `common` endpoint
   - Microsoft shows organization picker
   - User selects their organization

2. **User signs in**
   - Microsoft authenticates with user's organization
   - User grants consent
   - Authorization code is returned

3. **Token exchange**
   - Code is exchanged for tokens using `common` endpoint
   - Microsoft determines the tenant from the authorization code
   - Tokens are scoped to user's organization

4. **Token refresh**
   - Refresh token contains tenant information
   - Using `common` endpoint allows refresh for any tenant
   - New access token is scoped to user's organization

## Environment Variables

You can now **remove** `AZURE_TENANT_ID` from environment variables (it's not needed):

```bash
# Required
AZURE_CLIENT_ID=c94ab2b5-daf8-4fab-970a-f42358bbae34
AZURE_CLIENT_SECRET=<your-secret>

# Optional (but recommended)
APP_URL=https://ignitegrowth.biz
MICROSOFT_REDIRECT_URI=https://ignitegrowth.biz/api/microsoft/callback

# Not needed for multi-tenant (removed)
# AZURE_TENANT_ID=common  # ❌ Not needed - code uses 'common' directly
```

## Why This Works

- **`common` endpoint** = Microsoft's multi-tenant endpoint
- **Authorization code** = Contains tenant information
- **Refresh token** = Contains tenant information
- **Access token** = Scoped to user's tenant (determined automatically)

Microsoft automatically routes to the correct tenant based on:
- The authorization code (which tenant issued it)
- The refresh token (which tenant it belongs to)
- The user's organization (from the sign-in)

## Testing

1. **Test with GoDaddy user**:
   - User from `ignitestrategies.co` should be able to connect
   - Tokens should be scoped to GoDaddy tenant

2. **Test with other organization**:
   - User from any Microsoft 365 organization should be able to connect
   - Tokens should be scoped to their organization's tenant

3. **Test with personal account**:
   - User with `@outlook.com` or `@hotmail.com` should be able to connect
   - Tokens should be scoped to personal Microsoft account

## Key Points

- ✅ App registration is correct (multi-tenant)
- ✅ Code now uses `common` endpoint (multi-tenant)
- ✅ Works for any organization
- ✅ No tenant-specific configuration needed
- ✅ Each user's tokens are automatically scoped to their organization

## What the Tenant ID Is For

The tenant ID you see in Azure Portal (`39d16fb8-1702-491b-8626-35bba0215ae5`) is:
- **Your organization's tenant ID** (where the app is registered)
- **Not used for OAuth flow** (we use `common` instead)
- **Used for admin operations** (if you're managing the app)

For multi-tenant user sign-in, we don't need the specific tenant ID - we use `common` so any organization can sign in!

