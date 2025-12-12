# SuperAdmin Implementation - Current State

**Date**: January 2025  
**Status**: Phase 1 - SuperAdmin Only (Modular)  
**Next Step**: Ultra Tenant Container (Phase 2)

---

## 🎯 Current Goal

**Simple SuperAdmin initialization flow:**
1. Owner has `ownerId` in localStorage (from existing hydration)
2. Owner clicks "Become Platform SuperAdmin" button in Settings
3. System creates SuperAdmin record linked to that `ownerId`
4. Owner can now access admin features

**NOT YET IMPLEMENTED:**
- Ultra Tenant Container (IgniteBD Master CompanyHQ)
- Tenant Switchboard (will come in Phase 2)

---

## 📋 Current Implementation

### 1. Database Model

**Location:** `prisma/schema.prisma`

```prisma
model SuperAdmin {
  id        String   @id @default(cuid())
  ownerId   String   @unique
  owner     Owner    @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  active    Boolean  @default(true)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@map("super_admins")
}
```

**Relationship:**
- `SuperAdmin.ownerId` → `Owner.id` (one-to-one, unique)
- Cascade delete when Owner is deleted

### 2. Owner Hydration Enhancement

**Location:** `src/app/api/owner/hydrate/route.js`

**What it does:**
- After loading Owner, checks for SuperAdmin record
- Returns `isSuperAdmin: true/false` in response

**Code:**
```javascript
const superAdmin = await prisma.superAdmin.findUnique({
  where: { ownerId: owner.id },
});

const isSuperAdmin = superAdmin?.active === true;

return NextResponse.json({
  success: true,
  owner: hydratedOwner,
  isSuperAdmin: isSuperAdmin,  // NEW FIELD
  timestamp: new Date().toISOString(),
});
```

**No breaking changes** - existing hydration flow unchanged.

### 3. Settings Page - Platform Admin Tools

**Location:** `src/app/(authenticated)/settings/page.jsx`

**What it shows:**
- "IgniteBD Platform Admin Tools" section
- Only visible when:
  - `owner.email === NEXT_PUBLIC_PLATFORM_ADMIN_EMAIL` OR
  - `isSuperAdmin === true`

**Button:**
- "Become Platform SuperAdmin" (if not already SuperAdmin)
- "Open Tenant Switchboard" (if already SuperAdmin) - **Phase 2 feature**

**Flow:**
1. User clicks "Become Platform SuperAdmin"
2. Calls `POST /api/admin/superadmin/upsert`
3. On success: Updates `isSuperAdmin` state, refreshes owner data
4. Shows success state

### 4. API Route: SuperAdmin Upsert

**Location:** `src/app/api/admin/superadmin/upsert/route.js`

**Endpoint:** `POST /api/admin/superadmin/upsert`

**Authentication:**
- Requires valid Firebase token
- Optional email restriction via `NEXT_PUBLIC_PLATFORM_ADMIN_EMAIL`

**Logic:**
1. Verify Firebase token → get `firebaseId`
2. Find Owner by `firebaseId`
3. Upsert SuperAdmin record:
   - If exists: Update `active = true`
   - If not exists: Create with `ownerId` and `active = true`

**Response:**
```json
{
  "success": true,
  "superAdmin": { ... },
  "message": "SuperAdmin activated successfully"
}
```

**Error Cases:**
- 401: No Firebase token
- 403: Email restriction (if `NEXT_PUBLIC_PLATFORM_ADMIN_EMAIL` is set)
- 404: Owner not found
- 500: Database error

---

## 🔍 Current Issue: 400 Error

**Problem:** Getting 400 error when clicking "Become Platform SuperAdmin"

**What We're Trying to Do:**
1. User has `ownerId` in localStorage (from existing `/api/owner/hydrate`)
2. User clicks "Become Platform SuperAdmin" button
3. Frontend calls `POST /api/admin/superadmin/upsert` (no body needed)
4. API should:
   - Verify Firebase token from Authorization header
   - Find Owner by firebaseId
   - Create/update SuperAdmin record with `ownerId`

**Possible Causes of 400:**
1. **Firebase token not being sent** - API interceptor not adding token
2. **Email restriction** - If `NEXT_PUBLIC_PLATFORM_ADMIN_EMAIL` is set and doesn't match
3. **Route not found** - Next.js routing issue
4. **Request format** - Next.js expecting body when we send empty POST
5. **CORS issue** - Request being blocked

**Debug Steps:**
1. **Check Browser Console:**
   - Look for `🚀 Settings: Calling SuperAdmin upsert API...`
   - Look for `📥 Settings: API response:` or `❌ Settings: Error`
   - Check Network tab → Request to `/api/admin/superadmin/upsert`
   - Check Request Headers → Should have `Authorization: Bearer <token>`
   - Check Response → Status code and body

2. **Check Server Logs:**
   - Look for `🚀 SuperAdmin Upsert: Starting...`
   - Look for `✅ SuperAdmin Upsert: Firebase token verified`
   - Look for `❌ SuperAdmin Upsert: Auth error:` or other errors

3. **Verify Firebase Token:**
   - Token should be in `Authorization: Bearer <token>` header
   - Token should be valid Firebase ID token
   - Check if token is expired

4. **Check Environment Variables:**
   - Is `NEXT_PUBLIC_PLATFORM_ADMIN_EMAIL` set?
   - If yes, does it match the user's email exactly?

5. **Verify Owner Exists:**
   - Check if Owner record exists for the Firebase UID
   - Run: `SELECT * FROM owners WHERE firebase_id = '<firebase-uid>';`

**Enhanced Logging Added:**
- API route now logs each step
- Frontend now logs request/response
- Better error messages with details

---

## 🏗️ Architecture Flow

### Current Flow (Phase 1 - SuperAdmin Only)

```
User logged in
  ↓
localStorage.ownerId exists (from /api/owner/hydrate)
  ↓
Settings page loads
  ↓
Checks isSuperAdmin from /api/owner/hydrate response
  ↓
Shows "Become Platform SuperAdmin" button
  ↓
User clicks button
  ↓
POST /api/admin/superadmin/upsert
  ↓
API: verifyFirebaseToken → get firebaseId
  ↓
API: find Owner by firebaseId
  ↓
API: upsert SuperAdmin { ownerId: owner.id, active: true }
  ↓
Success: Update isSuperAdmin state
  ↓
User is now SuperAdmin
```

### Future Flow (Phase 2 - Ultra Tenant + Switchboard)

```
SuperAdmin user
  ↓
Access Tenant Switchboard
  ↓
See all CompanyHQs
  ↓
Switch between tenants
  ↓
Create new CompanyHQs
```

---

## 📝 Data Flow

### localStorage State

**Before SuperAdmin:**
```javascript
{
  ownerId: "cmxxx...",
  owner: { id: "cmxxx...", email: "...", ... },
  companyHQId: "cmxxx...",
  companyHQ: { ... }
}
```

**After SuperAdmin (no change to localStorage):**
- Same structure
- `isSuperAdmin` is checked via API call, not stored in localStorage
- Owner hydration response includes `isSuperAdmin: true`

### Database State

**Before:**
```
Owner { id: "cmxxx...", firebaseId: "firebase-uid" }
SuperAdmin: null
```

**After:**
```
Owner { id: "cmxxx...", firebaseId: "firebase-uid" }
SuperAdmin { id: "cmxxx...", ownerId: "cmxxx...", active: true }
```

---

## 🔧 Troubleshooting 400 Error

### Step 1: Check Browser Console
Look for:
- Network request to `/api/admin/superadmin/upsert`
- Request headers (should have `Authorization: Bearer <token>`)
- Response status and body

### Step 2: Check API Route Logs
The route logs:
- `❌ Upsert SuperAdmin error:` on failure
- Check server logs for actual error message

### Step 3: Verify Firebase Token
The `verifyFirebaseToken` function should:
- Extract token from `Authorization` header
- Verify with Firebase Admin SDK
- Return `{ uid, email, ... }`

### Step 4: Check Environment Variables
- Is `NEXT_PUBLIC_PLATFORM_ADMIN_EMAIL` set?
- If yes, does it match the user's email?

### Step 5: Verify Owner Exists
- Check if Owner record exists for the Firebase UID
- Run: `SELECT * FROM owners WHERE firebase_id = '<firebase-uid>';`

---

## 🎯 Next Steps (Phase 2 - Not Yet Implemented)

1. **Ultra Tenant Container**
   - Create IgniteBD Master CompanyHQ
   - Seed script for master tenant

2. **Tenant Switchboard**
   - List all CompanyHQs
   - Switch between tenants
   - Create new CompanyHQs

3. **Tenant Switching Logic**
   - Update localStorage.companyHQId
   - Rehydrate owner data
   - Redirect to dashboard

---

## 📁 Files Involved

### Current (Phase 1)
- `prisma/schema.prisma` - SuperAdmin model
- `src/app/api/owner/hydrate/route.js` - Returns isSuperAdmin
- `src/app/api/admin/superadmin/upsert/route.js` - Creates SuperAdmin
- `src/app/(authenticated)/settings/page.jsx` - UI for becoming SuperAdmin

### Future (Phase 2)
- `src/app/(authenticated)/admin/switchboard/page.jsx` - Tenant switchboard
- `src/app/(authenticated)/admin/companyhq/create/page.jsx` - Create CompanyHQ
- `src/app/api/admin/companyhqs/route.js` - List all CompanyHQs
- `src/lib/tenant.js` - Tenant switching utility

---

## 🚨 Known Issues

1. **400 Error on SuperAdmin Upsert**
   - Status: Investigating
   - Need to check: Firebase token, email restriction, request format

2. **Email Restriction Logic**
   - Currently: If `NEXT_PUBLIC_PLATFORM_ADMIN_EMAIL` is set, only that email can become SuperAdmin
   - Consider: Making this optional or removing for Phase 1

---

## ✅ What Works

- SuperAdmin model in database
- Owner hydration returns `isSuperAdmin` flag
- Settings page shows Platform Admin Tools section
- Button appears for eligible users
- API route structure is correct

---

## ❌ What's Not Working

- 400 error when clicking "Become Platform SuperAdmin"
- Need to debug the actual error response

---

**Last Updated**: January 2025  
**Phase**: 1 - SuperAdmin Only (Modular)  
**Status**: Debugging 400 error

