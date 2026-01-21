# Microsoft Callback Route Audit - Mixed Concerns

**File:** `/app/api/microsoft/callback/route.js`

## Current Issues

### 🔴 MIXED CONCERNS

The callback route is doing **THREE different things**:

1. **Token Exchange** (Route 3) ✅
   - Receives authorization code
   - Exchanges code for tokens
   - This is infrastructure

2. **Database Write** (Route 4) ❌ WRONG PLACE
   - Saves tokens to Owner record (lines 91-101)
   - Requires ownerId resolution
   - This is business logic - should be separate route

3. **Navigation** ❌ WRONG PLACE
   - Redirects to frontend (lines 106-108)
   - This is UI concern - should be separate

## Current Callback Route Breakdown

```javascript
// ✅ Route 3: Exchange tokens (CORRECT)
const tokenData = await exchangeMicrosoftAuthCode({ code, redirectUri });

// ❌ Route 4: Save tokens (WRONG - mixing concerns)
await prisma.owners.update({ where: { id: ownerId }, ... });

// ❌ Navigation (WRONG - mixing concerns)
return NextResponse.redirect(`${appUrl}/contacts/ingest/microsoft?success=1`);
```

## The Problem

**Callback route responsibilities:**
- ✅ Exchange code → tokens (infrastructure)
- ❌ Save tokens to database (business logic)
- ❌ Handle navigation (UI concern)

**Why this is wrong:**
- Callback requires ownerId (from state)
- Callback writes to database
- Callback handles redirects
- All three concerns mixed in one route

## Correct Architecture (4 Routes)

### Route 1: Generate URL
**File:** `lib/microsoftAuthUrl.js`
- Pure function
- ✅ Already correct

### Route 2: Push to Microsoft  
**File:** `/api/microsoft/login`
- Navigation redirect only
- ✅ Already correct

### Route 3: Accept Tokens (CALLBACK)
**File:** `/api/microsoft/callback`
**Should ONLY:**
- Receive authorization code
- Exchange code for tokens (pure service)
- Store tokens temporarily in Redis with session ID
- Redirect to frontend with `?oauth_session=xxx`
- **NO database writes**
- **NO ownerId resolution**
- **NO business logic**

### Route 4: Save Tokens
**File:** `/api/microsoft/tokens/save` (POST)
**Should:**
- Require Firebase auth (verify identity)
- Resolve ownerId from Firebase UID
- Retrieve tokens from Redis using session ID
- Save tokens to Owner record
- Return JSON success
- **NO navigation**
- **NO token exchange**

## Required Fix

Split callback into two routes:

1. **Callback** (`/api/microsoft/callback`) - Exchange + Redis storage
2. **Save** (`/api/microsoft/tokens/save`) - Firebase auth + DB write

Frontend calls save route after callback redirects with session ID.





