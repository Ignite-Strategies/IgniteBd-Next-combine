# Owner Model & Routes Audit

## Owner Model Schema (Current)

```prisma
model owners {
  id                                        String                @id
  firebaseId                                String                @unique
  firstName                                 String?
  lastName                                  String?
  name                                      String? // Deprecated: Use firstName and lastName instead
  email                                     String?
  photoURL                                  String?
  teamSize                                  String?
  
  // Microsoft OAuth fields (stored directly on owner)
  microsoftAccessToken                      String?
  microsoftRefreshToken                     String?
  microsoftExpiresAt                        DateTime?
  microsoftEmail                            String?
  microsoftDisplayName                      String?
  microsoftTenantId                         String?
  
  // SendGrid fields
  sendgridVerifiedEmail                     String?
  sendgridVerifiedName                      String?
  
  createdAt                                 DateTime              @default(now())
  updatedAt                                 DateTime
  
  // Relations...
}
```

## Standard Owner Resolution Pattern (CURRENT)

**ALL routes MUST use this pattern:**

```javascript
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

// 1. Verify Firebase token (gets firebaseUser)
const firebaseUser = await verifyFirebaseToken(request);

// 2. Find owner by firebaseId (NOT by ownerId!)
const owner = await prisma.owners.findUnique({
  where: { firebaseId: firebaseUser.uid },
});

// 3. Use owner.id as ownerId
const ownerId = owner.id;
```

**Key Points:**
- `firebaseId` is the unique identifier (from Firebase UID)
- `id` is the database primary key (used as `ownerId` in app)
- **NEVER** query by `id` directly - always resolve from `firebaseId`
- This is the **ONLY** way to get owner from authenticated requests

## Owner API Routes

### ✅ CURRENT Routes

#### `/api/owner/hydrate` (GET)
**Purpose:** Hydrate owner with memberships (used by `useOwner` hook)
**Pattern:** ✅ Uses standard pattern
- Verifies Firebase token
- Finds owner by `firebaseId`
- Returns owner with `companyHQId`, `companyHQ`, `memberships`
- **This is the source of truth for frontend owner data**

#### `/api/owner/create` (POST)
**Purpose:** Create new owner record
**Pattern:** ✅ Uses standard pattern

#### `/api/owner/[ownerId]/profile` (GET/PUT)
**Purpose:** Get/update owner profile
**Pattern:** ⚠️ Uses `ownerId` from URL param (but should verify Firebase token matches)

### ❌ DEPRECATED Routes

#### `/api/microsoft/status` (GET)
**Status:** ❌ **DEPRECATED - DUPLICATES LOGIC**
**Why:** 
- Duplicates owner resolution logic (already done in preview route)
- Preview route already checks Microsoft connection via `getValidAccessToken`
- Returns 401 if not connected (same behavior)
- Frontend can check `owner.microsoftAccessToken` from `useOwner` hook instead

**Current Usage:**
- `/app/(authenticated)/settings/page.jsx` - Should use `useOwner` hook
- `/app/(authenticated)/contacts/enrich/microsoft/page.jsx` - Old enrich page (may be deprecated)

**Replacement:**
- Use `useOwner()` hook to get `owner` object
- Check `owner.microsoftAccessToken` directly
- Or call preview route and handle 401

## Microsoft Routes (All Use Standard Pattern)

### ✅ Current Routes

#### `/api/microsoft/login` (GET)
**Pattern:** ✅ No owner resolution needed (redirect only)

#### `/api/microsoft/callback` (GET)
**Pattern:** ✅ Uses `ownerId` from OAuth state param (validated against Firebase)

#### `/api/microsoft/email-contacts/preview` (GET)
**Pattern:** ✅ Uses standard pattern
- Resolves owner from Firebase
- Checks Microsoft connection via `getValidAccessToken(owner.id)`
- Returns 401 if not connected
- **This route already handles connection checking - no need for status route!**

#### `/api/microsoft/email-contacts/save` (POST)
**Pattern:** ✅ Uses standard pattern

#### `/api/microsoft/disconnect` (POST)
**Pattern:** ✅ Uses standard pattern

#### `/api/microsoft/send-mail` (POST)
**Pattern:** ✅ Uses standard pattern

## Frontend Pattern (CURRENT)

### ✅ `useOwner` Hook
**Location:** `/hooks/useOwner.js`
**Purpose:** Provides owner data to all components
**How it works:**
1. Loads from localStorage (instant)
2. Calls `/api/owner/hydrate` to hydrate with memberships
3. Returns: `{ ownerId, owner, companyHQId, companyHQ, memberships }`

**Usage:**
```javascript
import { useOwner } from '@/hooks/useOwner';

const { ownerId, owner } = useOwner();

// Check Microsoft connection:
const isMicrosoftConnected = !!owner?.microsoftAccessToken;
```

### ❌ Deprecated Frontend Patterns

**DON'T:**
- Call `/api/microsoft/status` to check connection
- Resolve `ownerId` from status API response
- Use Firebase auth state directly (use `useOwner` hook instead)

**DO:**
- Use `useOwner()` hook for all owner data
- Check `owner.microsoftAccessToken` for Microsoft connection
- Call preview route directly (it handles connection checking)

## Migration Checklist

- [x] Remove `/api/microsoft/status` calls from ingest page
- [ ] Update `/app/(authenticated)/settings/page.jsx` to use `useOwner` hook
- [ ] Check if `/app/(authenticated)/contacts/enrich/microsoft/page.jsx` is deprecated
- [ ] Delete `/api/microsoft/status/route.js` file
- [ ] Update documentation

## Summary

**The correct pattern:**
1. Frontend: Use `useOwner()` hook (calls `/api/owner/hydrate`)
2. Backend: Always resolve owner via `firebaseId` from Firebase token
3. Microsoft connection: Check `owner.microsoftAccessToken` or call preview route
4. **Never** call `/api/microsoft/status` - it's deprecated duplicate logic
