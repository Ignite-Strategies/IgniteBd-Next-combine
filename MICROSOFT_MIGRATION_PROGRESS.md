# Microsoft Migration Progress

## ✅ Completed: Step 4 Clean Up

### 1. Removed Microsoft Logic from `/api/owner/hydrate`
- **File**: `app/api/owner/hydrate/route.js`
- **Changes**:
  - Removed `microsoftConnected` computation
  - Removed Microsoft token destructuring (still excludes them for security)
  - Removed `microsoftEmail` from response
  - Added comment noting Microsoft status should use `/api/microsoft/status`

### 2. Updated Frontend to Use Correct Endpoint
- **File**: `app/(authenticated)/contacts/ingest/microsoft/page.jsx`
- **Changes**:
  - Line 29: Changed from `/api/owner/hydrate` to `/api/microsoft/status`
  - Line 53: Changed OAuth callback check to use `/api/microsoft/status`
  - Now uses `response.data.connected` instead of `response.data.owner.microsoftConnected`

**Result**: No more Microsoft connection checks in owner/hydrate endpoint. Frontend uses dedicated Microsoft status endpoint.

---

## ✅ Completed: MicrosoftAccount Model Created

### Schema Changes
- **File**: `prisma/schema.prisma`
- **Added**: `MicrosoftAccount` model with:
  - `id`, `ownerId` (unique constraint)
  - Microsoft identity: `microsoftEmail`, `microsoftDisplayName`, `microsoftTenantId`
  - OAuth tokens: `accessToken`, `refreshToken`, `expiresAt`
  - Metadata: `connectedAt`, `lastRefreshedAt`, `createdAt`, `updatedAt`
- **Updated**: `owners` model to include `MicrosoftAccount` relation

**Note**: Follows same pattern as `GoogleOAuthToken` model.

---

## 📋 Next Steps

### Step 1: Generate Prisma Client
```bash
npx prisma generate
```

### Step 2: Create Database Migration
```bash
npx prisma migrate dev --name add_microsoft_account_model
```

This will:
- Create the `MicrosoftAccount` table in the database
- Generate the migration SQL file

### Step 3: Run Data Migration Script
```bash
node scripts/migrate-microsoft-to-account.js
```

This will:
- Find all owners with Microsoft tokens
- Create `MicrosoftAccount` records for each
- Skip owners that already have a MicrosoftAccount
- Report migration statistics

### Step 4: Update Code to Use MicrosoftAccount

**Files that need updating** (search for `owner.microsoftAccessToken` or similar):

1. **`lib/microsoftGraphClient.js`**
   - `getValidAccessToken()` - query MicrosoftAccount instead of owner
   - `refreshAccessToken()` - update MicrosoftAccount instead of owner
   - `isMicrosoftConnected()` - check MicrosoftAccount existence

2. **`app/api/microsoft/status/route.js`**
   - Query MicrosoftAccount instead of owner.microsoft* fields

3. **`app/api/microsoft/callback/route.js`**
   - Create/update MicrosoftAccount instead of owner.microsoft* fields

4. **`app/api/microsoft/disconnect/route.js`**
   - Delete MicrosoftAccount instead of clearing owner.microsoft* fields

5. **`app/api/microsoft/email-contacts/preview/route.js`**
   - Use MicrosoftAccount for token retrieval

6. **`app/api/microsoft/contacts/preview/route.js`**
   - Use MicrosoftAccount for token retrieval

7. **Any other files using `owner.microsoft*` fields**

### Step 5: Remove Microsoft Fields from Owners Model

**After all code is updated and tested**:

1. Remove Microsoft fields from `owners` model in `schema.prisma`:
   ```prisma
   // Remove these lines:
   microsoftAccessToken    String?
   microsoftRefreshToken   String?
   microsoftExpiresAt      DateTime?
   microsoftEmail          String?
   microsoftDisplayName    String?
   microsoftTenantId       String?
   ```

2. Create migration to remove columns:
   ```bash
   npx prisma migrate dev --name remove_microsoft_fields_from_owners
   ```

### Step 6: Consolidate Hydrate/Fetch Calls

**Goal**: Reduce duplicate API calls

**Current issues**:
- Multiple places checking Microsoft connection status
- Some pages might call both `/api/owner/hydrate` and `/api/microsoft/status`

**Approach**:
- Review all pages that check Microsoft connection
- Ensure they use `/api/microsoft/status` (not hydrate)
- Consider caching connection status in React context/state
- Remove any redundant API calls

---

## 🔍 Files to Search for Updates

Use these grep patterns to find all places that need updating:

```bash
# Find all uses of Microsoft fields on owner
grep -r "owner\.microsoft" app/ lib/
grep -r "microsoftAccessToken" app/ lib/
grep -r "microsoftRefreshToken" app/ lib/
grep -r "microsoftEmail" app/ lib/
grep -r "microsoftDisplayName" app/ lib/
grep -r "microsoftTenantId" app/ lib/
grep -r "microsoftExpiresAt" app/ lib/

# Find Prisma queries that select Microsoft fields
grep -r "microsoftAccessToken.*true" app/ lib/
grep -r "select.*microsoft" app/ lib/
```

---

## 📊 Migration Checklist

- [x] Step 4 Clean Up: Remove Microsoft from `/api/owner/hydrate`
- [x] Step 4 Clean Up: Update frontend to use `/api/microsoft/status`
- [x] Create MicrosoftAccount model in schema
- [ ] Generate Prisma client
- [ ] Create database migration
- [ ] Run data migration script
- [ ] Update `lib/microsoftGraphClient.js`
- [ ] Update `app/api/microsoft/status/route.js`
- [ ] Update `app/api/microsoft/callback/route.js`
- [ ] Update `app/api/microsoft/disconnect/route.js`
- [ ] Update all preview/save routes
- [ ] Test all Microsoft features
- [ ] Remove Microsoft fields from owners model
- [ ] Create final migration to remove fields
- [ ] Consolidate hydrate/fetch calls

---

## 🎯 Benefits After Migration

1. **Clean Separation**: Owner = user identity, MicrosoftAccount = Microsoft integration
2. **Consistent Architecture**: Matches GoogleOAuthToken pattern
3. **Better Queries**: Simple `prisma.microsoftAccount.findUnique({ where: { ownerId } })`
4. **Future-Proof**: Easy to support multiple Microsoft accounts later
5. **Reduced API Calls**: No more Microsoft checks in owner/hydrate
6. **Clearer Code**: No confusion between `owner.email` and `microsoftEmail`
