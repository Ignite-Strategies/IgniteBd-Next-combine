# Microsoft Azure AD App Verification Guide

## Current Status: Unverified App ✅

Your app is showing as "unverified" in the consent screen, which is **completely normal** for new Azure AD app registrations. This doesn't prevent the app from working!

## Do You Need Verification?

### ✅ **Verification NOT Required If:**
- Your app is only used by your organization (internal use)
- You're the admin and can grant consent
- You're okay with the "unverified" warning in the consent screen
- The app works correctly (which it does!)

### 🔐 **Verification Recommended If:**
- You want to remove the "unverified" warning
- You want to publish the app for other organizations to use
- You want to appear more trustworthy to users
- You want to use certain high-privilege permissions

## Quick Setup (Improve Consent Screen)

Even without full verification, you can improve the consent screen:

### 1. Update App Branding in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Find your app (Client ID: `c94ab2b5-daf8-4fab-970a-f42358bbae34`)
4. Go to **Branding & properties**

### 2. Configure App Details

**Required:**
- **Name**: `IgniteGrowth Outreach` (or your preferred name)
- **Supported account types**: Choose based on your needs
  - `Accounts in any organizational directory and personal Microsoft accounts` (most common)
  - `Accounts in this organizational directory only` (single tenant)

**Optional (but recommended):**
- **Logo**: Upload a square logo (240x240px recommended)
- **Home page URL**: `https://ignitegrowth.biz`
- **Terms of service URL**: `https://ignitegrowth.biz/terms` (if you have one)
- **Privacy statement URL**: `https://ignitegrowth.biz/privacy` (if you have one)

### 3. Configure API Permissions

1. Go to **API permissions**
2. Make sure you have these **Delegated permissions**:
   - ✅ `User.Read` - Sign in and read user profile
   - ✅ `Mail.Send` - Send mail as user
   - ✅ `Mail.Read` - Read user mail
   - ✅ `Contacts.Read` - Read user contacts
   - ✅ `Contacts.ReadWrite` - Read and write user contacts
   - ✅ `Calendars.Read` - Read user calendars
   - ✅ `offline_access` - Maintain access to resources (for refresh tokens)

3. Click **Grant admin consent for [Your Organization]** if you're an admin
   - This removes the need for users to consent individually

## Full Verification Process (Optional)

If you want to go through Microsoft's verification process:

### Requirements:
1. **Terms of Service URL** - Must be publicly accessible
2. **Privacy Statement URL** - Must be publicly accessible
3. **App Logo** - 240x240px, square, PNG/JPG
4. **Home Page URL** - Your app's homepage
5. **Support URL** - Where users can get help
6. **Publisher Verification** - Verify your organization domain

### Steps:
1. Complete all branding information in Azure Portal
2. Submit for verification in Azure Portal
3. Microsoft reviews your app (can take several days/weeks)
4. Once verified, the "unverified" warning disappears

### Verification Review Criteria:
- App functionality matches description
- Privacy policy is comprehensive
- Terms of service are clear
- App doesn't violate Microsoft policies
- Publisher domain is verified

## For Now: Just Accept the Consent! ✅

**You can proceed without verification:**

1. **Click "Accept"** on the consent screen
2. The app will work perfectly fine
3. Users in your organization can use it
4. The "unverified" warning is just informational

## Admin Consent (Recommended)

If you're an admin, grant admin consent to skip user consent:

1. Go to Azure Portal > App registrations > Your app
2. Go to **API permissions**
3. Click **Grant admin consent for [Your Organization]**
4. Confirm the consent

This means:
- ✅ Users won't see the consent screen
- ✅ App works automatically for all users
- ✅ No individual user consent needed

## Current Setup Status

✅ **Working:**
- OAuth flow is working
- Consent screen appears
- App can request permissions

⚠️ **Optional Improvements:**
- Add app logo
- Add terms of service URL
- Add privacy policy URL
- Grant admin consent
- Submit for verification (optional)

## Next Steps

1. **Immediate**: Click "Accept" to continue testing
2. **Soon**: Add branding (logo, URLs) to improve consent screen
3. **Optional**: Grant admin consent to skip user consent
4. **Later**: Submit for verification if you want to remove "unverified" label

## Testing After Consent

After accepting:
1. You'll be redirected back to `/settings/integrations?success=1`
2. Microsoft tokens will be stored in your Owner record
3. You can send emails via Microsoft Graph API
4. Connection status will show in Settings

## Troubleshooting

**If consent fails:**
- Check that redirect URI matches Azure AD configuration
- Verify app permissions are configured correctly
- Ensure you're using the correct tenant ID

**If "unverified" warning concerns you:**
- It's safe to proceed for internal apps
- You can improve branding without full verification
- Full verification is only needed for multi-tenant apps


