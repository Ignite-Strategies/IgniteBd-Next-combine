# Microsoft OAuth + Graph API Audit

**Date:** 2025-01-27  
**Workspace:** IgniteBd-Next-combine  
**Domain:** ignitegrowth.biz (different from ignitebd-crm)

## Architecture Context

**IgniteBd-Next-combine** is a separate Next.jsz application with its own OAuth configuration.

- **App Domain:** `ignitegrowth.biz` (different from `engage.ignitegrowth.biz`)
- **Registered Redirect URI:** `https://ignitegrowth.biz/api/microsoft/callback` (different from ignitebd-crm)
- **Separate from CRM:** `ignitebd-crm` workspace has different env vars and callback URLs
- **OAuth Implementation:** Fully implemented in this workspace

**Note:** This workspace has a **different redirect URI** than `ignitebd-crm`, which makes sense since they are separate applications with separate Microsoft Entra app registrations.

---

## Part 1: Existing OAuth Routes

### `/api/microsoft/login` (GET)
**Location:** `app/api/microsoft/login/route.js`

**Status:** ✅ Exists and functional

**Current Implementation:**
- Requires Firebase authentication (`verifyFirebaseToken`)
- Gets/creates Owner record via `prisma.owners`
- Generates state parameter with ownerId encoded
- Builds OAuth URL with Microsoft Entra
- Returns JSON response with `authUrl` (client-side redirect)

**Current Configuration:**
- **Redirect URI:** `process.env.MICROSOFT_REDIRECT_URI || 'https://ignitegrowth.biz/api/microsoft/callback'`
- **Scopes:** 
  - `openid`, `profile`, `email`, `offline_access`
  - `User.Read`
  - `Mail.Send`, `Mail.Read`
  - `Contacts.Read`, `Contacts.ReadWrite`
  - `Calendars.Read`
- **Authority:** `https://login.microsoftonline.com/common` (multi-tenant)

**Issues Identified:**
1. ⚠️ Too many scopes: Requests `Mail.Send`, `Contacts.ReadWrite`, `Calendars.Read` beyond requirements
2. ⚠️ Returns JSON instead of direct redirect

---

### `/api/microsoft/callback` (GET)
**Location:** `app/api/microsoft/callback/route.js`

**Status:** ✅ Exists and functional

**Current Implementation:**
- Handles OAuth callback from Microsoft
- Validates state parameter (10-minute expiry)
- Uses `@azure/msal-node` ConfidentialClientApplication for token exchange
- Extracts tenant ID from ID token
- Fetches user profile from Graph API if needed
- Stores tokens in `prisma.owners` table:
  - `microsoftAccessToken`
  - `microsoftRefreshToken`
  - `microsoftExpiresAt`
  - `microsoftEmail`
  - `microsoftDisplayName`
  - `microsoftTenantId`
- Redirects to `/settings/integrations` with success/error

**Current Configuration:**
- **Redirect URI:** `process.env.MICROSOFT_REDIRECT_URI || 'https://ignitegrowth.biz/api/microsoft/callback'`
- **Scopes:** Same as login route (too many)

**Issues Identified:**
1. ⚠️ Scopes mismatch: Requests same broad scopes

---

## Part 2: Token Exchange Logic

**Location:** `app/api/microsoft/callback/route.js` (lines 53-72)

**Implementation:**
- Uses `ConfidentialClientApplication` from `@azure/msal-node`
- Exchanges authorization code via `acquireTokenByCode()`
- Extracts tenant ID from JWT ID token payload
- Calculates expiration: `Date.now() + (expiresIn || 3600) * 1000`

**Token Storage:**
- Database: `prisma.owners` table
- Fields: `microsoftAccessToken`, `microsoftRefreshToken`, `microsoftExpiresAt`, `microsoftEmail`, `microsoftDisplayName`, `microsoftTenantId`
- No in-memory or session storage

**Status:** ✅ Usable - token exchange logic is correct

---

## Part 3: Graph Client Usage

### Core Library
**Location:** `lib/microsoftGraphClient.js`

**Status:** ⚠️ Incomplete - has critical bug

**Functions Available:**
1. `getValidAccessToken(ownerId)` - Gets token, auto-refreshes if expired
2. `refreshAccessToken(ownerId)` - Refreshes using refresh token
3. `sendMail(ownerId, mailData)` - Sends email via Graph API
4. `getContacts(ownerId, options)` - Fetches contacts
5. `getUserProfile(ownerId)` - Gets user profile
6. `getCalendarEvents(ownerId, options)` - Fetches calendar events
7. `isMicrosoftConnected(ownerId)` - Checks connection status

**Critical Bug:**
- ❌ Uses `prisma.owner` (singular) but Prisma model is `prisma.owners` (plural)
- **Impact:** Will cause runtime errors when called
- **Affected Functions:** All functions that query the database

**Token Refresh Logic:**
- Uses tenant-specific authority from stored `microsoftTenantId`
- Falls back to `'common'` if tenant ID not available
- 5-minute buffer before expiration triggers refresh

---

## Part 4: Graph API Endpoints in Use

### Current Graph API Calls:

1. **`GET /v1.0/me`** - User profile
   - Used in: `microsoftGraphClient.js` (getUserProfile), `callback/route.js`

2. **`GET /v1.0/me/contacts`** - Contacts
   - Used in: `microsoftGraphClient.js` (getContacts), `microsoft-graph/contacts/auto/route.js`, `microsoft-graph/contacts/route.js`

3. **`POST /v1.0/me/sendMail`** - Send email
   - Used in: `microsoftGraphClient.js` (sendMail), `microsoft-graph/send-mail/route.js`

4. **`GET /v1.0/me/events`** - Calendar events
   - Used in: `microsoftGraphClient.js` (getCalendarEvents)

**Note:** No existing endpoint fetches `/v1.0/me/messages` (required for contacts preview)

---

## Part 5: Additional Routes

### `/api/microsoft/status` (GET)
**Location:** `app/api/microsoft/status/route.js`
- Returns Microsoft connection status for current user
- Requires Firebase auth
- Returns `microsoftAuth` object (without tokens)

### `/api/microsoft/disconnect` (GET)
**Location:** `app/api/microsoft/disconnect/route.js`
- Clears Microsoft auth fields from Owner record
- Requires Firebase auth

### `/api/microsoft/send-mail` (POST)
**Location:** `app/api/microsoft/send-mail/route.js`
- Proxy route for sending email
- Uses `microsoftGraphClient.sendMail()`

### `/api/microsoft-graph/contacts/auto` (GET)
**Location:** `app/api/microsoft-graph/contacts/auto/route.js`
- Automatically fetches contacts using owner's stored token
- Requires Firebase auth
- Uses `getValidAccessToken()` from `microsoftGraphClient`

### `/api/microsoft-graph/contacts` (GET)
**Location:** `app/api/microsoft-graph/contacts/route.js`
- Proxy route for fetching contacts
- Requires access token in request body

### `/api/microsoft-graph/send-mail` (POST)
**Location:** `app/api/microsoft-graph/send-mail/route.js`
- Proxy route for sending email
- Requires access token in request body

---

## Part 6: Database Schema

**Model:** `owners` (plural)

**Microsoft-related fields:**
```prisma
microsoftAccessToken      String?
microsoftRefreshToken     String?
microsoftExpiresAt        DateTime?
microsoftEmail            String?
microsoftDisplayName      String?
microsoftTenantId         String?
```

**Status:** ✅ Schema is correct

---

## Part 7: Dependencies

**Package:** `@azure/msal-node`
- Used for server-side OAuth token exchange
- Version: `^3.8.1` (from package.json)

**Package:** `@microsoft/microsoft-graph-client`
- Listed in package.json but not actively used in server-side code
- Version: `^3.0.7`

---

## Summary

### ✅ Usable
- OAuth login route (functional)
- OAuth callback route (functional)
- Token exchange logic
- Database schema
- Token storage mechanism
- Multiple Graph API endpoints implemented

### ⚠️ Incomplete
- `microsoftGraphClient.js` - Prisma model name bug (`owner` vs `owners`)
- OAuth scopes too broad (should be minimal: `User.Read`, `Mail.Read`)

### ❌ Missing
- No route at `/api/auth/microsoft/login` (but has `/api/microsoft/login`)
- No route at `/api/auth/microsoft/callback` (but has `/api/microsoft/callback`)
- Endpoint `/api/microsoft/contacts/preview` (for messages-based contact signals)

### 🗑️ Safe to Remove
- No dead code identified
- All Microsoft-related code appears to be in use

---

## Comparison with ignitebd-crm

| Aspect | IgniteBd-Next-combine | ignitebd-crm |
|--------|----------------------|-------------|
| **Domain** | `ignitegrowth.biz` | `engage.ignitegrowth.biz` |
| **Redirect URI** | `/api/microsoft/callback` | `/api/auth/microsoft/callback` |
| **OAuth Status** | ✅ Fully implemented | ❌ Stubs only |
| **Graph Client** | ✅ Has library (with bug) | ❌ None |
| **Dependencies** | ✅ Has `@azure/msal-node` | ❌ No OAuth libs |

**Key Difference:** These are **separate applications** with **separate Microsoft Entra app registrations**, which is why they have different redirect URIs. This makes architectural sense.

---

## Notes

- **Workspace Separation:** This audit is for `IgniteBd-Next-combine` workspace only. `ignitebd-crm` workspace has separate Microsoft integration code.
- **Redirect URI Difference:** This workspace uses `/api/microsoft/callback` while `ignitebd-crm` uses `/api/auth/microsoft/callback` - both are correct for their respective app registrations.
- **Prisma Model Bug:** The `microsoftGraphClient.js` uses `prisma.owner` (singular) but the actual model is `prisma.owners` (plural). This will cause runtime errors.
