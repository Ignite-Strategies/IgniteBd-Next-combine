# How to Find Your GoDaddy Microsoft 365 Tenant ID

Since you're using GoDaddy Workspace Email (Microsoft 365), you need to find your **GoDaddy-specific tenant ID**.

## Step 1: Sign in to Azure Portal with GoDaddy Email

1. Go to [Azure Portal](https://portal.azure.com)
2. Sign in with your GoDaddy email: `adam@ignitestrategies.co`
3. Use your GoDaddy Workspace password (the one you use for email)

## Step 2: Find Your Tenant ID

1. Once signed in, click on **Azure Active Directory** (or search for it)
2. Click **Overview** in the left sidebar
3. Look for **Tenant ID** (it's a GUID like: `39d16fb8-1702-491b-8626-35bba0215ae5`)
4. Copy this Tenant ID

## Step 3: Update Your Environment Variable

Update your `AZURE_TENANT_ID` environment variable with the GoDaddy tenant ID:

```bash
AZURE_TENANT_ID=<your-godaddy-tenant-id-here>
```

## Alternative: Use "common" Tenant

If you want your app to work with any Microsoft 365 account (not just GoDaddy), you can use:

```bash
AZURE_TENANT_ID=common
```

This allows users from any organization (including GoDaddy, regular Microsoft, etc.) to connect.

## Verify Your Setup

After updating the tenant ID:

1. **Accept the consent screen** (if you haven't already)
2. **Check if tokens are stored** in your database
3. **Test sending an email** via the Microsoft Graph API

## Common Issues

### "Can't access Azure Portal"
- **Solution**: Make sure you're using your GoDaddy Workspace admin credentials
- GoDaddy Workspace admins can access Azure Portal
- Regular users might not have access

### "Tenant ID doesn't work"
- **Solution**: Try using `common` as the tenant ID
- This makes your app multi-tenant (works with any Microsoft 365 account)

### "App not found in tenant"
- **Cause**: Your app is registered in a different tenant
- **Solution**: 
  - Register the app in your GoDaddy tenant, OR
  - Use `common` tenant and make the app multi-tenant

## Current Status

Based on the Microsoft consent screen you saw:
- ✅ You're using Microsoft 365 (through GoDaddy)
- ✅ Our Microsoft Graph integration should work
- ✅ You just need the correct tenant ID

## Next Steps

1. **Find your GoDaddy tenant ID** (see steps above)
2. **Update `AZURE_TENANT_ID`** environment variable
3. **Test the integration** by accepting the consent
4. **Verify tokens are stored** in the database
5. **Test sending an email**

If you can't access Azure Portal, you can also try using `common` as the tenant ID - this should work for most Microsoft 365 accounts!

