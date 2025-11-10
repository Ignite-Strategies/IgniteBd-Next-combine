# Microsoft OAuth Environment Variables Checklist

## Required Variables (You Have These ✅)

- ✅ `AZURE_CLIENT_ID` - Azure AD Application (Client) ID
- ✅ `AZURE_CLIENT_SECRET` - Azure AD Client Secret
- ✅ `AZURE_TENANT_ID` - Azure AD Directory (Tenant) ID
- ✅ `DATABASE_URL` - PostgreSQL connection string
- ✅ `FIREBASE_SERVICE_ACCOUNT_KEY` - Firebase Admin SDK credentials

## Optional Variables (Recommended)

These have defaults but should be set for production:

- ⚠️ `APP_URL` - Your application URL (defaults to `https://ignitegrowth.biz`)
  - **Set to**: `https://ignitegrowth.biz` (or your production URL)
  
- ⚠️ `MICROSOFT_REDIRECT_URI` - OAuth callback URL (defaults to `https://ignitegrowth.biz/api/microsoft/callback`)
  - **Set to**: `https://ignitegrowth.biz/api/microsoft/callback`

## Next Steps

1. **Add Optional Variables** (if not already set):
   ```
   APP_URL=https://ignitegrowth.biz
   MICROSOFT_REDIRECT_URI=https://ignitegrowth.biz/api/microsoft/callback
   ```

2. **Push Prisma Schema Changes**:
   - The database needs to be updated with the new Microsoft fields on the Owner model
   - Run this in your deployment environment or locally with production DATABASE_URL:
   ```bash
   npx prisma db push
   ```
   Or create a migration:
   ```bash
   npx prisma migrate deploy
   ```

3. **Verify Azure AD App Registration**:
   - Make sure the redirect URI is configured in Azure AD:
   - `https://ignitegrowth.biz/api/microsoft/callback`
   - Platform: **Web**

4. **Deploy Code Changes**:
   - Make sure the latest code with Microsoft OAuth integration is deployed
   - The fix for authenticated API calls should be live

## Testing

After setting up:
1. Go to Settings → Integrations
2. Click "Connect with Microsoft"
3. Should redirect to Microsoft login
4. After authorizing, should redirect back to settings
5. Should show "Connected as [Display Name]"

## Troubleshooting

If you see "No authorization token provided":
- ✅ Fixed: We changed the login route to return JSON instead of redirecting
- Make sure the code is deployed with the latest changes

If you see database errors:
- Run `npx prisma db push` to update the schema
- Verify DATABASE_URL is correct

If OAuth callback fails:
- Verify MICROSOFT_REDIRECT_URI matches Azure AD configuration
- Check that APP_URL is set correctly

