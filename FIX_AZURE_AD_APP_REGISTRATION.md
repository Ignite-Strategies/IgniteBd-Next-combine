# Fix Azure AD App Registration for Multi-Tenant User Sign-In

## The Problem

The app was registered as:
- ❌ **Single-tenant** (only works for one organization)
- ❌ **Client credentials flow** (application permissions, no user sign-in)

But we need:
- ✅ **Multi-tenant** (works for any organization)
- ✅ **Authorization code flow** (user sign-in with delegated permissions)

## How to Fix in Azure Portal

### Step 1: Update App Registration to Multi-Tenant

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Find your app (Client ID: `c94ab2b5-daf8-4fab-970a-f42358bbae34`)
4. Click on the app name to open it

### Step 2: Change Supported Account Types

1. Click **Authentication** in the left sidebar
2. Under **Supported account types**, select:
   - ✅ **Accounts in any organizational directory and personal Microsoft accounts (Common)** 
   - ❌ NOT "Accounts in this organizational directory only (Single tenant)"

3. Click **Save**

### Step 3: Configure Authentication

1. Still in **Authentication** section
2. Under **Platform configurations**, make sure you have:
   - **Web** platform added
   - **Redirect URI**: `https://ignitegrowth.biz/api/microsoft/callback`

3. Under **Implicit grant and hybrid flows**:
   - ✅ **Access tokens** (optional, but recommended)
   - ✅ **ID tokens** (optional, but recommended)

4. Click **Save**

### Step 4: Update API Permissions (Delegated, NOT Application)

1. Click **API permissions** in the left sidebar
2. **Remove any Application permissions** (these are for client credentials flow)
3. **Add Delegated permissions** for Microsoft Graph:
   - ✅ `User.Read` - Sign in and read user profile
   - ✅ `Mail.Send` - Send mail as user
   - ✅ `Mail.Read` - Read user mail
   - ✅ `Contacts.Read` - Read user contacts
   - ✅ `Contacts.ReadWrite` - Read and write user contacts
   - ✅ `Calendars.Read` - Read user calendars
   - ✅ `offline_access` - Maintain access to resources (for refresh tokens)

4. **Important**: These should be **Delegated permissions**, NOT Application permissions

5. Click **Save**

### Step 5: Verify Client Secret (if using one)

1. Click **Certificates & secrets** in the left sidebar
2. Make sure you have a **Client secret** (not a certificate)
3. Copy the secret value (you won't see it again)
4. Update `AZURE_CLIENT_SECRET` environment variable

### Step 6: Update Environment Variables

```bash
# Multi-tenant configuration
AZURE_TENANT_ID=common  # ✅ Use 'common' for multi-tenant
AZURE_CLIENT_ID=c94ab2b5-daf8-4fab-970a-f42358bbae34
AZURE_CLIENT_SECRET=<your-client-secret>

# Application URLs
APP_URL=https://ignitegrowth.biz
MICROSOFT_REDIRECT_URI=https://ignitegrowth.biz/api/microsoft/callback
```

## Key Differences

### Single-Tenant (Wrong) ❌
- Only works for one organization
- Uses client credentials flow
- Application permissions
- No user sign-in
- Tokens are app-level, not user-level

### Multi-Tenant (Correct) ✅
- Works for any organization
- Uses authorization code flow
- Delegated permissions
- User sign-in required
- Tokens are user-level, scoped to user's organization

## Verification Checklist

- [ ] App is set to "Accounts in any organizational directory and personal Microsoft accounts (Common)"
- [ ] Redirect URI is configured: `https://ignitegrowth.biz/api/microsoft/callback`
- [ ] API permissions are **Delegated** (not Application)
- [ ] `offline_access` permission is included (for refresh tokens)
- [ ] Client secret is created and stored in environment variables
- [ ] `AZURE_TENANT_ID=common` in environment variables

## After Fixing

1. **Test the OAuth flow**:
   - User clicks "Connect with Microsoft"
   - Should see Microsoft login page
   - User signs in with their organization account
   - User grants consent
   - Redirects back to settings with tokens stored

2. **Verify tokens are stored**:
   - Check database for `microsoftAccessToken`, `microsoftRefreshToken`
   - Check that `microsoftEmail` and `microsoftDisplayName` are populated

3. **Test email sending**:
   - Try sending an email via Microsoft Graph API
   - Should work with user's Microsoft 365 account

## Common Issues After Fix

### "Invalid client" Error
- **Cause**: App not configured for multi-tenant
- **Fix**: Change to "Accounts in any organizational directory" in Authentication

### "Invalid redirect URI" Error
- **Cause**: Redirect URI not configured in Azure AD
- **Fix**: Add redirect URI in Authentication > Platform configurations

### "Insufficient privileges" Error
- **Cause**: Using Application permissions instead of Delegated
- **Fix**: Remove Application permissions, add Delegated permissions

### "Consent required" Error
- **Cause**: User hasn't granted consent
- **Fix**: User needs to complete OAuth flow and grant consent (this is normal)

## Next Steps

1. ✅ Update Azure AD app registration to multi-tenant
2. ✅ Change to Delegated permissions
3. ✅ Update environment variables
4. ✅ Test OAuth flow
5. ✅ Verify tokens are stored
6. ✅ Test email sending

The app should now work for users from any organization! 🎉

