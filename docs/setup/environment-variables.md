# Environment Variables Setup for Microsoft OAuth

## Required Environment Variables

Make sure these are set in your environment (production/deployment):

```bash
# Azure AD Configuration
AZURE_CLIENT_ID=c94ab2b5-daf8-4fab-970a-f42358bbae34
AZURE_CLIENT_SECRET=<your-client-secret-here>
AZURE_TENANT_ID=39d16fb8-1702-491b-8626-35bba0215ae5  # ✅ MUST BE SET!

# Application URLs
APP_URL=https://ignitegrowth.biz
MICROSOFT_REDIRECT_URI=https://ignitegrowth.biz/api/microsoft/callback
```

## Critical: AZURE_TENANT_ID Must Be Set!

The `AZURE_TENANT_ID` environment variable **must be set** to your tenant ID:
- **Your Tenant ID**: `39d16fb8-1702-491b-8626-35bba0215ae5`
- **This is your GoDaddy Workspace tenant ID**

## What Happens If It's Not Set?

If `AZURE_TENANT_ID` is not set:
- ❌ Code defaults to `'common'` (multi-tenant)
- ❌ But your app registration might not be configured for true multi-tenant
- ❌ OAuth flow might fail or behave unexpectedly

## Setting Environment Variables

### In Vercel/Production

1. Go to your deployment platform (Vercel, etc.)
2. Navigate to **Settings** > **Environment Variables**
3. Add/Update:
   - `AZURE_CLIENT_ID` = `c94ab2b5-daf8-4fab-970a-f42358bbae34`
   - `AZURE_CLIENT_SECRET` = `<your-secret>`
   - `AZURE_TENANT_ID` = `39d16fb8-1702-491b-8626-35bba0215ae5` ✅ **IMPORTANT!**
   - `APP_URL` = `https://ignitegrowth.biz`
   - `MICROSOFT_REDIRECT_URI` = `https://ignitegrowth.biz/api/microsoft/callback`

4. **Redeploy** after adding/updating environment variables

### In Local Development (.env.local)

Create/update `.env.local`:

```bash
AZURE_CLIENT_ID=c94ab2b5-daf8-4fab-970a-f42358bbae34
AZURE_CLIENT_SECRET=your-secret-here
AZURE_TENANT_ID=39d16fb8-1702-491b-8626-35bba0215ae5
APP_URL=http://localhost:3000
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/microsoft/callback
```

## Verification

### Check Environment Variables Are Set

1. **In your deployment platform**: Verify all variables are set
2. **In your code**: The code uses `process.env.AZURE_TENANT_ID || 'common'`
   - If set: Uses your tenant ID ✅
   - If not set: Defaults to 'common' (might not work as expected)

### Test OAuth Flow

1. Go to Settings → Integrations
2. Click "Connect with Microsoft"
3. Should redirect to Microsoft login with your tenant
4. User signs in with their GoDaddy Workspace account
5. Grants consent
6. Redirects back with tokens stored

## Troubleshooting

### "Invalid tenant" Error
- **Cause**: `AZURE_TENANT_ID` not set or incorrect
- **Fix**: Set `AZURE_TENANT_ID=39d16fb8-1702-491b-8626-35bba0215ae5` in environment variables

### "App not found" Error
- **Cause**: App not registered in the specified tenant
- **Fix**: Verify app is registered in tenant `39d16fb8-1702-491b-8626-35bba0215ae5`

### OAuth Redirects to Wrong Tenant
- **Cause**: `AZURE_TENANT_ID` environment variable not set
- **Fix**: Set the environment variable and redeploy

## Current Configuration

- ✅ App Registration: Multi-tenant ("Multiple organizations")
- ✅ Tenant ID: `39d16fb8-1702-491b-8626-35bba0215ae5` (GoDaddy Workspace)
- ✅ Code: Uses `process.env.AZURE_TENANT_ID` (with fallback to 'common')
- ⚠️ **Action Required**: Set `AZURE_TENANT_ID` in environment variables!

## Next Steps

1. ✅ **Set `AZURE_TENANT_ID` in environment variables** (production + local)
2. ✅ **Redeploy** after setting environment variables
3. ✅ **Test OAuth flow** to verify it works
4. ✅ **Verify tokens are stored** in database

Once `AZURE_TENANT_ID` is set correctly, the OAuth flow should work perfectly! 🎉

