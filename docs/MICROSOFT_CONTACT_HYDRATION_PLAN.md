# Microsoft Contact Hydration - Audit & Implementation Plan

**Date:** 2025-01-27  
**Workspace:** IgniteBd-Next-combine  
**Scope:** Contact Hydration ONLY (reading inbox metadata to extract contact signals)

---

## 🎯 Goal

Microsoft integration is responsible for **ONE thing only**: Contact Hydration

- Read inbox metadata via Microsoft Graph
- Extract contact signals (email + recency + frequency)
- Return preview list of ContactCandidate

---

## ✅ Reusable Files (For Contact Hydration)

### OAuth Infrastructure
**Status:** ✅ Reusable with minor modifications

1. **`app/api/microsoft/login/route.js`**
   - **Use:** OAuth initiation
   - **Modify:** Reduce scopes to `User.Read`, `Mail.Read` only
   - **Leave:** Token storage, state management, redirect logic

2. **`app/api/microsoft/callback/route.js`**
   - **Use:** Token exchange and storage
   - **Modify:** Reduce scopes to `User.Read`, `Mail.Read` only
   - **Leave:** Token storage in database, tenant ID extraction

3. **`app/api/microsoft/status/route.js`**
   - **Use:** Check if Microsoft is connected
   - **Modify:** None needed
   - **Leave:** As-is

### Token Management
**Status:** ✅ Partially reusable (only specific functions)

4. **`lib/microsoftGraphClient.js`**
   - **Use:**
     - `getValidAccessToken(ownerId)` - ✅ Needed for getting tokens
     - `refreshAccessToken(ownerId)` - ✅ Needed for token refresh
     - `getUserProfile(ownerId)` - ✅ Uses GET /v1.0/me (allowed)
   - **Modify:** Fix Prisma bug (`prisma.owner` → `prisma.owners`) in functions we use
   - **Ignore:** `sendMail()`, `getContacts()`, `getCalendarEvents()` - leave untouched

### Database Schema
**Status:** ✅ Already correct

5. **`prisma/schema.prisma`** - `owners` model
   - **Fields used:** `microsoftAccessToken`, `microsoftRefreshToken`, `microsoftExpiresAt`, `microsoftTenantId`
   - **Modify:** None needed

---

## 🚫 Files to IGNORE (Out of Scope)

**Do NOT touch these files** - they support features explicitly out of scope:

### Email Sending (Out of Scope)
- ❌ `lib/microsoftGraphClient.js::sendMail()` - Leave untouched
- ❌ `app/api/microsoft/send-mail/route.js` - Leave untouched
- ❌ `app/api/microsoft-graph/send-mail/route.js` - Leave untouched

### Contacts Write (Out of Scope)
- ❌ `lib/microsoftGraphClient.js::getContacts()` - Leave untouched
- ❌ `app/api/microsoft-graph/contacts/route.js` - Leave untouched
- ❌ `app/api/microsoft-graph/contacts/auto/route.js` - Leave untouched

### Calendar Access (Out of Scope)
- ❌ `lib/microsoftGraphClient.js::getCalendarEvents()` - Leave untouched

### Other Routes (Out of Scope)
- ❌ `app/api/microsoft/disconnect/route.js` - Not needed for hydration

---

## 📝 Required Changes

### 1. Reduce OAuth Scopes

**Files to modify:**
- `app/api/microsoft/login/route.js` (line 50-61)
- `app/api/microsoft/callback/route.js` (line 70)
- `lib/microsoftGraphClient.js` (line 93) - only in `refreshAccessToken()`

**Change:**
```javascript
// FROM:
scopes: ['openid', 'profile', 'email', 'offline_access', 'User.Read', 'Mail.Send', 'Mail.Read', 'Contacts.Read', 'Contacts.ReadWrite', 'Calendars.Read']

// TO:
scopes: ['openid', 'profile', 'email', 'offline_access', 'User.Read', 'Mail.Read']
```

**Impact:** Users will need to re-authenticate to get new scopes. Existing tokens with old scopes will still work until they expire.

---

### 2. Fix Prisma Model Bug (Only in Functions We Use)

**File:** `lib/microsoftGraphClient.js`

**Functions to fix:**
- `getValidAccessToken()` - line 18: `prisma.owner` → `prisma.owners`
- `refreshAccessToken()` - line 55: `prisma.owner` → `prisma.owners`
- `refreshAccessToken()` - line 104: `prisma.owner` → `prisma.owners`
- `isMicrosoftConnected()` - line 300: `prisma.owner` → `prisma.owners`

**Functions to LEAVE UNTOUCHED:**
- `sendMail()` - Don't fix (out of scope)
- `getContacts()` - Don't fix (out of scope)
- `getCalendarEvents()` - Don't fix (out of scope)

---

### 3. Create New Contact Hydration Endpoint (Redis Preview Pattern)

**New file:** `app/api/microsoft/contacts/preview/route.js`

**Purpose:** Fetch messages, transform to ContactCandidate format, store in Redis (like Apollo preview pattern)

**Implementation:**
- Use `getValidAccessToken()` from `microsoftGraphClient.js`
- Call: `GET https://graph.microsoft.com/v1.0/me/messages?$select=from,receivedDateTime&$top=25`
- Transform messages into ContactCandidate array:
  ```typescript
  // Type definition (mental model)
  type ContactCandidate = {
    email: string
    displayName: string
    domain: string
    lastSeenAt: string
    messageCount: number
  }
  
  // In code, use descriptive name (following existing pattern):
  // Apollo uses: normalizedContact
  // Microsoft should use: outlookContact or microsoftContact
  // const outlookContacts: ContactCandidate[] = [...]
  ```
- Store in Redis (like Apollo preview pattern):
  - Generate previewId: `preview:microsoft:${timestamp}:${random}`
  - Redis key: `microsoft:${previewId}`
  - TTL: 1 hour
- Return: `{ previewId, redisKey, contactCandidates: [...] }`
  - Variable name in code: `outlookContacts` (following `{source}Contact` pattern, like Apollo's `normalizedContact`)
- No database persistence

**Pattern:** Matches Apollo's `/api/contacts/enrich/generate-intel` pattern:
- Fetch data from external API
- Transform/normalize data
- Store in Redis with previewId
- Return previewId for retrieval

**Dependencies:**
- Requires Firebase auth (like other routes)
- Uses existing token from database
- Uses Redis helper functions from `lib/redis.ts`

---

## 🏗️ Implementation Strategy

### Phase 1: Fix Prisma Bug (Minimal)
- Fix `getValidAccessToken()` and `refreshAccessToken()` only
- Leave other functions untouched
- Test token retrieval works

### Phase 2: Reduce Scopes (Breaking Change)
- Update OAuth scopes in login, callback, and refresh
- Document that users need to re-authenticate
- Existing tokens will work until expiration

### Phase 3: Create Hydration Endpoint (Redis Preview)
- Create new `/api/microsoft/contacts/preview` route
- Use existing `getValidAccessToken()` function
- Implement message fetching and transformation
- Store ContactCandidate array in Redis (like Apollo preview pattern)
- Return `{ previewId, redisKey, contactCandidates: [...] }`
  - Variable name in code: `outlookContacts` (like Apollo uses `normalizedContact`)
- Add Redis helper function for Microsoft preview storage (similar to Apollo preview functions)

---

## 📊 Graph API Usage

### Allowed Endpoints (Contact Hydration Only)
- ✅ `GET /v1.0/me` - User profile (already used)
- ✅ `GET /v1.0/me/messages?$select=from,receivedDateTime&$top=25` - **NEW**

### Forbidden Endpoints (Out of Scope)
- ❌ `POST /v1.0/me/sendMail` - Email sending
- ❌ `GET /v1.0/me/contacts` - Contacts read/write
- ❌ `GET /v1.0/me/events` - Calendar access

---

## 🔍 Code Isolation Strategy

### New Code Location
- **New endpoint:** `app/api/microsoft/contacts/preview/route.js`
- **Isolated:** Doesn't import or use out-of-scope functions
- **Minimal:** Only imports `getValidAccessToken` from `microsoftGraphClient.js`

### Existing Code Boundaries
- **OAuth routes:** Modify scopes only, leave structure intact
- **Token management:** Fix bug in functions we use, ignore others
- **Out-of-scope code:** Leave completely untouched

---

## ✅ Validation Checklist

Before implementation:
- [ ] Identify all files that will be modified
- [ ] Confirm out-of-scope files will be left untouched
- [ ] Verify OAuth scope reduction won't break existing tokens immediately
- [ ] Plan for user re-authentication after scope change

After implementation:
- [ ] OAuth flow works with minimal scopes
- [ ] Token refresh works with minimal scopes
- [ ] New endpoint fetches messages correctly
- [ ] ContactCandidate transformation is correct
- [ ] No database persistence in hydration endpoint
- [ ] Out-of-scope code remains untouched

---

## 📋 Summary

### Files to Modify (3)
1. `app/api/microsoft/login/route.js` - Reduce scopes
2. `app/api/microsoft/callback/route.js` - Reduce scopes
3. `lib/microsoftGraphClient.js` - Fix Prisma bug + reduce scopes (only in functions we use)

### Files to Create (2)
1. `app/api/microsoft/contacts/preview/route.js` - New hydration endpoint (Redis preview pattern)
2. `lib/redis.ts` - Add Microsoft preview storage functions (similar to Apollo preview functions)

### Files to Ignore (7+)
- All email sending routes
- All contacts read/write routes
- All calendar routes
- Disconnect route

### Minimal Change Set
- **3 existing files** modified (scope reduction + bug fix)
- **2 new files** created (hydration endpoint + Redis helper functions)
- **0 files** deleted or refactored
- **Isolated** from out-of-scope functionality
- **Pattern:** Matches Apollo's Redis preview pattern (proven approach)

---

## 🎯 Success Criteria

Contact hydration is complete when:
1. User can connect Microsoft account (OAuth with minimal scopes)
2. User can call `/api/microsoft/contacts/preview`
3. Endpoint fetches messages, transforms to ContactCandidate format, stores in Redis
4. Endpoint returns `{ previewId, redisKey, contactCandidates: [...] }` (like Apollo preview pattern)
   - Variable name in code: `outlookContacts` (following existing pattern - Apollo uses `normalizedContact`)
   - Type: `ContactCandidate[]` (mental model), variable: `outlookContacts` (descriptive name)
5. Preview can be retrieved by previewId (like Apollo does)
6. No database persistence happens in hydration flow
7. All out-of-scope code remains untouched

