# Authentication - Complete Guide

## Overview

This document covers the complete authentication system for IgniteBD, including Firebase Auth user creation, client portal login flows, activation processes, and data normalization.

**Key Principle:** Firebase UID is the Universal Identifier
- One Firebase UID = One Contact across all systems
- Contact.email = Firebase login username
- Contact.firebaseUid = Portal identity

---

## Table of Contents

1. [Firebase Auth User Creation](#firebase-auth-user-creation)
2. [Client Portal Login Flow](#client-portal-login-flow)
3. [Activation Flow](#activation-flow)
4. [Auth Normalization](#auth-normalization)
5. [Why Identity Toolkit](#why-identity-toolkit)
6. [Testing](#testing)

---

## Firebase Auth User Creation

### Overview

**We (internally) create Firebase user accounts for Contacts using Firebase Admin SDK.** This is server-side user creation that happens BEFORE the client ever logs in.

### The Flow - Step by Step

#### 1. Contact Selection (Frontend)
```
User selects Contact → contactId sent to API
```

**File:** `src/app/(authenticated)/client-operations/invite-prospect/page.jsx`

```javascript
// User clicks "Generate Portal Access"
const response = await api.post(
  `/api/contacts/${selectedContact.id}/generate-portal-access`
);
```

#### 2. API Route Receives contactId

**File:** `src/app/api/contacts/[contactId]/generate-portal-access/route.js`

```javascript
// contactId comes from URL params
const { contactId } = await params;

// Fetch Contact from database
const contact = await prisma.contact.findUnique({
  where: { id: contactId },
});
// contact.email = "joel@example.com"
```

#### 3. Firebase Admin SDK Initialization

**File:** `src/lib/firebaseAdmin.js`

```javascript
// We use Firebase Admin SDK (server-side, privileged)
const admin = getFirebaseAdmin();
// Uses FIREBASE_SERVICE_ACCOUNT_KEY from environment
// This gives us admin privileges to create users
```

**Key Point:** We're using **Firebase Admin SDK**, not the client SDK. This allows us to:
- Create users programmatically
- Generate password reset links
- Manage users without their password

#### 4. User Creation/Upsert Logic (Server-Side Only)

**File:** `src/app/api/contacts/[contactId]/generate-portal-access/route.js`

```javascript
const auth = admin.auth(); // Firebase Admin Auth instance (SERVER-SIDE)

// Try to get existing user by email
try {
  firebaseUser = await auth.getUserByEmail(contact.email);
  // Returns: { uid, email, displayName, ... } - Firebase UserRecord object
  // User already exists in Firebase - we'll reuse it
} catch (error) {
  // User doesn't exist - CREATE NEW USER
  firebaseUser = await auth.createUser({
    email: contact.email,                    // joel@example.com
    displayName: `${firstName} ${lastName}`,  // "Joel Gulick"
    emailVerified: false,                     // They'll verify via reset link
    disabled: false,                          // Account is active
    // NOTE: NO PASSWORD SET HERE!
  });
  // Returns: { uid, email, displayName, ... } - Firebase UserRecord object
}
```

**What Admin SDK Returns:**
- `firebaseUser` is a **Firebase UserRecord object** (server-side only)
- Contains: `uid`, `email`, `displayName`, `emailVerified`, `disabled`, `metadata`, etc.
- **NOT a token** - it's the user record itself
- This happens **entirely server-side** - frontend never sees this

**Critical:** We're **NOT setting a password** when creating the user. Firebase creates the account in a "passwordless" state.

#### 5. Generate Password Reset Link (Full URL String)

```javascript
// Firebase generates a password reset link
const resetLink = await auth.generatePasswordResetLink(contact.email);
// Returns: "https://your-project.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=ABC123xyz&apiKey=..."
```

**What This Returns:**
- A **complete URL string** (not a parameter, not a token)
- Example: `https://your-project.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=ABC123xyz&apiKey=...`
- This is a **clickable link** that the client will use in their browser

**Critical: How It Works Even Without a Password**
- Firebase's `generatePasswordResetLink` works **even when the user has NO password set**
- When the client clicks the link, they go to **our custom `/reset-password` page** in the client portal (NOT Firebase's hosted page)
- We use `handleCodeInApp: true` to handle the password reset on our own page
- The `oobCode` (out-of-band code) is passed in the URL query params
- Our page extracts the `oobCode` and uses Firebase Client SDK's `confirmPasswordReset()` to set the password
- It's not really a "reset" - it's more like a "set your initial password" link
- The client doesn't need to know any existing password because **there isn't one**
- The link is time-limited and expires after a set time (Firebase default)
- After setting their password, they're redirected to our client portal login page
- Once they set their password via the link, they can then log in normally with email + password

**Important:** The password setup happens on **our client portal page** (`/reset-password`), styled with our black/silver theme, NOT Firebase's generic page.

#### 6. Store Firebase UID in Database (Server-Side)

```javascript
// Link Contact to Firebase user
await prisma.contact.update({
  where: { id: contactId },
  data: {
    firebaseUid: firebaseUser.uid,  // Extract UID from Firebase UserRecord
    clientPortalUrl: 'https://clientportal.ignitegrowth.biz',
  },
});
```

**What Gets Stored:**
- `firebaseUser.uid` → Stored in `Contact.firebaseUid` (Prisma DB)
- This is the **link** between our Contact and Firebase user
- Stored server-side in database - frontend doesn't hydrate this directly

**The Link:**
- `Contact.id` (Prisma) → `Contact.firebaseUid` → `Firebase User.uid`
- This is how we connect our Contact record to Firebase user

#### 7. Return Password Reset Link to Frontend

```javascript
// Return reset link to frontend
return NextResponse.json({
  success: true,
  invite: {
    contactId,
    contactEmail: contact.email,
    passwordResetLink: resetLink,  // This is what frontend gets
    loginUrl: 'https://clientportal.ignitegrowth.biz/login',
  },
});
```

**What Frontend Receives:**
- ✅ `passwordResetLink` - A **complete URL string** like `https://your-project.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=...`
- ✅ `contactId` - For reference
- ✅ `contactEmail` - For display
- ❌ **NOT** the Firebase UID (stored in DB, not sent to frontend)
- ❌ **NOT** a token (no token needed - the URL itself is the credential)
- ❌ **NOT** a parameter (it's a full URL the client clicks)

### Upsert Pattern

**We're doing an upsert pattern:**

1. **Try to get existing user** by email
   - If exists → Use existing Firebase user
   - If not → Create new Firebase user

2. **Always generate a new reset link** (even for existing users)
   - This allows re-inviting contacts
   - Each link is unique and time-limited

### The Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. BD User selects Contact (joel@example.com)              │
│    → contactId sent to API                                 │
└────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. API Route: /api/contacts/:contactId/generate-portal-access│
│    → Fetch Contact from Prisma by contactId                 │
│    → Get contact.email                                       │
└────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Firebase Admin SDK                                        │
│    → admin.auth().getUserByEmail(email)                     │
│    → If not found: admin.auth().createUser({ email })      │
│    → NO PASSWORD SET - User created passwordless             │
└────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Generate Password Reset Link                             │
│    → admin.auth().generatePasswordResetLink(email)          │
│    → Returns: https://firebase-auth...?oobCode=xxx          │
└────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Store Link in Contact                                    │
│    → Update Contact.firebaseUid                             │
│    → Store firebaseUid for future lookups                    │
└────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Return Reset Link to BD User                             │
│    → BD User sends link to Contact                          │
└────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Contact Clicks Link                                      │
│    → Firebase shows password setup page                     │
│    → Contact sets their own password                        │
│    → Password stored in Firebase (we never see it)          │
└────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. Contact Logs In                                          │
│    → Client Portal: /login                                 │
│    → Uses Firebase Client SDK                              │
│    → signInWithEmailAndPassword(email, password)            │
│    → System finds Contact by firebaseUid                    │
│    → Portal hydrates with Contact data                      │
└─────────────────────────────────────────────────────────────┘
```

### Firebase Admin SDK Setup

**Environment Variable:**
```
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
```

**Initialization:**
```javascript
// src/lib/firebaseAdmin.js
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
```

### User Creation vs User Signup

**What We Do (Admin SDK):**
```javascript
// Server-side, privileged
admin.auth().createUser({
  email: 'joel@example.com',
  // No password - user will set it via reset link
});
```

**What Client Does (Client SDK):**
```javascript
// Client-side, in client portal
signInWithEmailAndPassword(auth, email, password);
// Uses password they set via reset link
```

### The Password Reset Link

**What It Actually Does:**
- Works for users **with or without** passwords
- If no password: User sets initial password
- If password exists: User resets existing password
- Link is **one-time use** and **time-limited**

**Link Format:**
```
https://[project].firebaseapp.com/__/auth/action?
  mode=resetPassword
  &oobCode=[code]
  &continueUrl=[portal-url]
```

### Security Model

#### Why This Works

1. **Admin SDK is server-side only**
   - Requires service account key
   - Never exposed to client
   - Can only run on our backend

2. **Password reset links are secure**
   - Cryptographically signed by Firebase
   - Time-limited (expires)
   - One-time use
   - Can't be guessed

3. **Contact.email is the bridge**
   - Contact.email → Firebase User.email
   - Contact.id → Contact.firebaseUid → Firebase User.uid
   - Universal personhood maintained

### Data Flow Summary

#### Server-Side (API Route)
```
1. Admin SDK creates/gets Firebase user
   → Returns: Firebase UserRecord { uid, email, ... }
   
2. Extract firebaseUser.uid
   → Store in Prisma: Contact.firebaseUid
   
3. Generate password reset link
   → Returns: Full URL string (e.g., "https://project.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=...")
   
4. Return to frontend
   → { passwordResetLink: "https://...", contactId, contactEmail }
```

#### What Gets Stored Where

**In Prisma Database:**
- `Contact.firebaseUid` - Firebase UID (for linking)
- `Contact.clientPortalUrl` - Portal URL
- `Contact.isActivated` - Activation status
- Stored server-side, not hydrated to frontend directly

**Sent to Frontend:**
- `passwordResetLink` - A **complete URL string** (e.g., `"https://project.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=ABC123..."`)
- `contactId` - For reference
- `contactEmail` - For display

**NOT Sent to Frontend:**
- ❌ Firebase UID (stored in DB only)
- ❌ Token (not needed - the URL itself contains the credential)
- ❌ Password (doesn't exist yet)
- ❌ Parameter (it's a full URL, not a query param)

#### Frontend Hydration

**Frontend does NOT hydrate Firebase user data:**
- Frontend only receives the password reset link (full URL string)
- Frontend displays/copies the URL to send to client
- Client clicks the URL → Redirects to Firebase's password reset page
- Client sets password on Firebase's page
- Client then logs in using Firebase Client SDK (not Admin SDK)

---

## Client Portal Login Flow

### Architecture Alignment

This flow follows **FIREBASE-AUTH-AND-USER-MANAGEMENT.md** Pattern B (Hydrate Route).

### Step-by-Step Login Flow

#### 1. User Enters Email/Password (Frontend)
**File:** `ignitebd-clientportal/app/login/page.jsx`

```javascript
// User submits form with email and password
credentials = {
  username: "joel@businesspointlaw.com",
  password: "user-password"
}
```

#### 2. Firebase Authentication (Frontend)
**File:** `ignitebd-clientportal/app/login/page.jsx`

```javascript
// Step 1: Authenticate with Firebase
const result = await signInWithEmailAndPassword(
  auth,
  credentials.username, // Email
  credentials.password
);

// Result contains:
// - result.user.uid (Firebase UID - UNIVERSAL IDENTIFIER)
// - result.user.email
// - result.user.displayName
```

**✅ Firebase establishes universal identity**
- Firebase UID = Universal Person Identifier
- One Firebase UID = One Contact across all systems

#### 3. Get Firebase Token (Frontend)
**File:** `ignitebd-clientportal/app/login/page.jsx`

```javascript
// Step 2: Get Firebase token for API calls
const idToken = await result.user.getIdToken();
// Token is automatically managed by Firebase SDK
// No manual storage needed - axios interceptor handles it
```

#### 4. Find Contact by Firebase UID (Backend API)
**File:** `IgniteBd-Next-combine/src/app/api/contacts/by-firebase-uid/route.js`

**Request:**
```javascript
// Axios interceptor automatically adds token:
// Authorization: Bearer <firebase-token>

GET /api/contacts/by-firebase-uid
Headers: {
  Authorization: "Bearer <firebase-token>"
}
```

**Backend Process:**
1. `verifyFirebaseToken(request)` extracts Firebase UID from token
2. `prisma.contact.findUnique({ where: { firebaseUid } })`
3. Returns contact data

**Response:**
```json
{
  "success": true,
  "contact": {
    "id": "contact-id",
    "firebaseUid": "firebase-uid",
    "email": "joel@businesspointlaw.com",
    "firstName": "Joel",
    "lastName": "Gulick",
    "crmId": "company-hq-id",
    "role": "contact",
    "isActivated": true
  }
}
```

#### 5. Store Session (Frontend)
**File:** `ignitebd-clientportal/app/login/page.jsx`

```javascript
// Store contact session data
localStorage.setItem('clientPortalContactId', contact.id);
localStorage.setItem('clientPortalCompanyHQId', contact.crmId);
localStorage.setItem('clientPortalContactEmail', contact.email);
localStorage.setItem('firebaseId', firebaseUid);

// Firebase token is NOT stored manually
// Axios interceptor gets fresh token on each request via Firebase SDK
```

#### 6. Redirect to Dashboard
```javascript
router.push('/welcome');
```

### Key Architecture Points

#### ✅ What We're Doing Right

1. **Firebase UID is Universal Identifier**
   - Not email lookup
   - Not contact ID lookup
   - Firebase UID connects Contact across all systems

2. **Pattern B: Hydrate Route**
   - `/api/contacts/by-firebase-uid` = Hydrate route
   - Uses `verifyFirebaseToken` middleware
   - Gets Firebase UID from verified token (not from body)

3. **Axios Interceptor Pattern**
   - Uses Firebase SDK's `getIdToken()` (automatic refresh)
   - No manual token storage
   - Tokens persist via Firebase SDK internally

#### ❌ What Was Wrong Before

1. **Email Lookup Instead of Firebase UID**
   ```javascript
   // OLD (WRONG):
   api.get(`/api/contacts/by-email?email=${email}`)
   
   // NEW (CORRECT):
   api.get(`/api/contacts/by-firebase-uid`) // Token in header
   ```

2. **Manual Token Storage**
   ```javascript
   // OLD (WRONG):
   localStorage.setItem('firebaseToken', idToken);
   
   // NEW (CORRECT):
   // No manual storage - Firebase SDK + axios interceptor handles it
   ```

### Database Schema

**Contact Model:**
```prisma
model Contact {
  id          String  @id @default(cuid())
  firebaseUid String? @unique // Firebase Auth UID - UNIVERSAL IDENTIFIER
  email       String? @unique
  firstName   String?
  lastName    String?
  crmId       String  // CompanyHQId (tenant identifier)
  // ... other fields
}
```

**Key Point:** `firebaseUid` is the lookup field, not `email`.

### Error Handling

#### Contact Not Found
```javascript
// If Firebase auth succeeds but Contact not found:
{
  "success": false,
  "error": "Contact not found"
}

// This means:
// - Firebase user exists
// - But Contact.firebaseUid is not set
// - Contact needs to be linked to Firebase UID
```

#### Firebase Auth Fails
```javascript
// If email/password is wrong:
FirebaseError: auth/wrong-password
// User sees: "Sign-in failed. Please check your credentials."
```

### Flow Diagram

```
User Login
    ↓
[1] Enter email/password
    ↓
[2] Firebase signInWithEmailAndPassword()
    ↓
[3] Get Firebase UID (result.user.uid)
    ↓
[4] Get Firebase Token (result.user.getIdToken())
    ↓
[5] Axios interceptor adds token to request
    ↓
[6] GET /api/contacts/by-firebase-uid
    ↓
[7] Backend: verifyFirebaseToken() extracts UID
    ↓
[8] Backend: prisma.contact.findUnique({ where: { firebaseUid } })
    ↓
[9] Return Contact data
    ↓
[10] Store session + redirect to dashboard
```

### Testing Checklist

- [ ] User can sign in with email/password
- [ ] Firebase authentication succeeds
- [ ] `/api/contacts/by-firebase-uid` returns contact
- [ ] Contact has `firebaseUid` set in database
- [ ] Axios interceptor adds token automatically
- [ ] Session data stored correctly
- [ ] Redirect to dashboard works

---

## Activation Flow

### Overview

Users must complete activation before they can log in. The activation flow sets their initial password.

### Activation Flow Steps

```
1. Admin generates invite link
   → /api/invite/send creates Firebase user (NO PASSWORD)

2. User clicks activation link
   → /activate?token=xxx

3. User sets password
   → /set-password → /api/set-password sets Firebase password

4. NOW user can login
   → signInWithEmailAndPassword(email, password)
```

**Key Point:** User CANNOT login until step 3 is complete!

### Testing the Activation Flow

#### Step-by-Step Test Flow

**1. Generate Invite for Contact**

Go to: `/client-operations/invite-prospect`

1. Search for contact (e.g., "joel" or "joel.gulick@businesspointlaw.com")
2. Click on contact
3. Click "Generate Portal Access"
4. **Copy the activation link** that appears (e.g., `https://clientportal.ignitegrowth.biz/activate?token=abc123...`)

**2. Test Activation Flow**

**Option A: Use the Activation Link Directly**

1. Open the activation link in a browser (or incognito window)
2. You'll be redirected to `/activate` page
3. It validates the token and redirects to `/set-password`
4. Set a password (e.g., `TestPassword123!`)
5. Click "Set Password"
6. You'll be redirected to `/login?activated=true`

**Option B: Test Each Step Manually**

1. **Activate Token:**
   ```
   POST https://app.ignitegrowth.biz/api/activate
   Body: { "token": "your-token-from-invite" }
   ```
   Returns: `{ uid, email, contactId }`

2. **Set Password:**
   ```
   POST https://app.ignitegrowth.biz/api/set-password
   Body: { 
     "uid": "firebase-uid-from-activate",
     "password": "TestPassword123!",
     "contactId": "contact-id"
   }
   ```

3. **Login:**
   Go to `https://clientportal.ignitegrowth.biz/login`
   - Email: `joel.gulick@businesspointlaw.com`
   - Password: `TestPassword123!`
   - Click "Sign In"

### Verify It Worked

After login, you should:
- ✅ See contact's dashboard
- ✅ Be logged in as contact
- ✅ See contact's proposals (if any)
- ✅ Contact marked as `isActivated: true` in database

### Check Database State

```sql
SELECT email, "firebaseUid", "isActivated", "activatedAt", "clientPortalUrl"
FROM contacts 
WHERE email = 'joel.gulick@businesspointlaw.com';
```

Expected after activation:
```json
{
  "email": "joel.gulick@businesspointlaw.com",
  "firebaseUid": "gGkeaOGmQDgqXayazG4RAveIvkk2",
  "isActivated": true,
  "activatedAt": "2025-11-12T...",
  "clientPortalUrl": "https://clientportal.ignitegrowth.biz"
}
```

### Common Issues

#### "Invalid activation token"
- **Cause:** Token expired (24 hours) or already used
- **Fix:** Generate a new invite

#### "Token already used"
- **Cause:** Token was already used to activate
- **Fix:** Generate a new invite

#### "Firebase user not found"
- **Cause:** Firebase user wasn't created during invite
- **Fix:** Check `/api/invite/send` logs, ensure Firebase user was created

#### Can't login after setting password
- **Cause:** Password not set correctly in Firebase
- **Fix:** Check `/api/set-password` logs, verify Firebase Admin SDK is working

### Testing Checklist

- [ ] Generate invite for contact
- [ ] Copy activation link
- [ ] Click activation link (opens `/activate`)
- [ ] Token validates successfully
- [ ] Redirects to `/set-password`
- [ ] Set a test password
- [ ] Password saves to Firebase
- [ ] Contact marked as `isActivated: true`
- [ ] Redirects to `/login?activated=true`
- [ ] Login with contact's email + test password
- [ ] Login successful
- [ ] See contact's dashboard
- [ ] Can access portal features

### Notes

- **Activation links expire in 24 hours**
- **Each token can only be used once**
- **Password is stored in Firebase, not in your database**
- **After activation, contact can reset password via Firebase password reset**

---

## Auth Normalization

### Overview

All Firebase + Client Portal auth data has been normalized from `notes` JSON into proper Prisma fields.

### Completed Steps

#### 1️⃣ Prisma Schema Updated
- ✅ Added `firebaseUid String? @unique`
- ✅ Added `clientPortalUrl String? @default("https://clientportal.ignitegrowth.biz")`
- ✅ Added `isActivated Boolean @default(false)`
- ✅ Added `activatedAt DateTime?`
- ✅ Added `@@index([firebaseUid])` for performance

**Next Step:** Run migration:
```bash
npx prisma migrate dev --name add_client_portal_auth_fields
```

#### 2️⃣ Migration Script Created
- ✅ Created `scripts/migrateNotesToAuth.js`
- ✅ Script extracts `clientPortalAuth.firebaseUid` and `clientPortalAuth.portalUrl` from notes JSON
- ✅ Migrates to `firebaseUid` and `clientPortalUrl` fields

**Next Step:** Run migration script:
```bash
node scripts/migrateNotesToAuth.js
```

#### 3️⃣ API Routes Updated
- ✅ `/api/invite/send` - Writes to `firebaseUid` and `clientPortalUrl` fields
- ✅ `/api/contacts/[contactId]/generate-portal-access` - Writes to `firebaseUid` field
- ✅ `/api/proposals/[proposalId]/approve` - Writes to `firebaseUid` field
- ✅ `/api/set-password` - Updates `isActivated` and `activatedAt` fields
- ✅ **NO routes write to `notes` JSON anymore**

### Verification Query

After running migration, verify with:
```sql
SELECT email, firebaseUid, clientPortalUrl, isActivated, activatedAt, notes
FROM "contacts"
WHERE firebaseUid IS NOT NULL;
```

**Expected Results:**
- ✅ `firebaseUid` is filled correctly
- ✅ `clientPortalUrl` is set
- ✅ `notes` field no longer contains `clientPortalAuth` JSON

### Benefits

1. **Clean Data Model** - Auth data in proper fields, not JSON strings
2. **Queryable** - Can query by `firebaseUid` directly
3. **Type Safe** - Prisma validates field types
4. **Indexed** - Fast lookups by `firebaseUid`
5. **No Parsing** - No more `JSON.parse(contact.notes)` for auth data

### Status Verification

#### ✅ What's Complete

1. **Prisma Schema**
   - ✅ `firebaseUid String? @unique` - EXISTS
   - ✅ `isActivated Boolean @default(false)` - EXISTS  
   - ✅ `activatedAt DateTime?` - EXISTS
   - ✅ `clientPortalUrl String?` - EXISTS

2. **API Routes (Main App)**
   - ✅ `/api/invite/send` - Uses `firebaseUid` field, NOT notes
   - ✅ `/api/contacts/[contactId]/generate-portal-access` - Uses `firebaseUid` field, NOT notes
   - ✅ `/api/proposals/[proposalId]/approve` - Uses `firebaseUid` field, NOT notes
   - ✅ `/api/set-password` - Updates `isActivated` and `activatedAt` fields

3. **No Notes JSON Writing**
   - ✅ No API routes are writing `clientPortalAuth` to notes JSON anymore

### Going Forward

All new invites will:
- ✅ Write to `firebaseUid` field (NOT notes)
- ✅ Write to `clientPortalUrl` field (NOT notes)
- ✅ Keep `notes` clean for actual notes/context

---

## Why Identity Toolkit

### Short Answer

**That IS Firebase!** `identitytoolkit.googleapis.com` is Firebase Authentication's backend service. This is normal and expected.

### What's Happening

When you call `signInWithEmailAndPassword()` from Firebase SDK:

```
Frontend: signInWithEmailAndPassword(email, password)
    ↓
Firebase Client SDK
    ↓
Google Identity Toolkit API (identitytoolkit.googleapis.com)
    ↓
Firebase Authentication Service
    ↓
Returns: User object or error
```

**This is the correct flow!** Firebase Auth uses Google Identity Toolkit under the hood.

### The Real Issue: `auth/invalid-credential`

The error `auth/invalid-credential` means:

1. ✅ **Firebase user exists** (created by `ensureFirebaseUser`)
2. ❌ **BUT password is wrong OR not set yet**

#### Scenario A: User Hasn't Completed Activation
- Firebase user was created (no password)
- User tries to login before setting password
- **Solution:** User must complete activation flow first

#### Scenario B: User Set Password But It's Wrong
- User completed activation
- User enters wrong password
- **Solution:** User needs to use the password they set

#### Scenario C: Password Wasn't Set Correctly
- User went through activation
- But `/api/set-password` failed silently
- **Solution:** Check backend logs for set-password errors

### Debugging Steps

#### 1. Check if Firebase User Exists
```javascript
// In Firebase Console or via Admin SDK
admin.auth().getUserByEmail('joel@businesspointlaw.com')
```

#### 2. Check if Contact Has firebaseUid
```sql
SELECT id, email, "firebaseUid", "isActivated" 
FROM contacts 
WHERE email = 'joel@businesspointlaw.com';
```

#### 3. Check if Password Was Set
- Look for `/api/set-password` calls in logs
- Check if `isActivated = true` in database

#### 4. Test Activation Flow
- Generate new invite link
- Complete activation
- Try login again

### Common Issues

#### Issue: "User not found" but Firebase user exists
**Cause:** Contact.firebaseUid is not set  
**Fix:** Run activation flow or manually link:
```sql
UPDATE contacts 
SET "firebaseUid" = 'firebase-uid-here' 
WHERE email = 'user@example.com';
```

#### Issue: "Invalid credential" after activation
**Cause:** Password wasn't set correctly  
**Fix:** Check `/api/set-password` logs, regenerate invite link

#### Issue: User can't find activation link
**Cause:** Email not sent or link expired  
**Fix:** Generate new invite link from contact detail page

### The URL is Correct!

✅ `identitytoolkit.googleapis.com` = Firebase Auth backend  
✅ This is where ALL Firebase email/password auth goes  
✅ This is normal and expected behavior  

**We ARE hitting Firebase** - it just uses Google Identity Toolkit as the backend service.

---

## Testing

### Complete Testing Checklist

#### Firebase User Creation
- [ ] Can generate portal access for contact
- [ ] Firebase user created (or reused if exists)
- [ ] Firebase UID stored in Contact.firebaseUid
- [ ] Password reset link generated
- [ ] Link returned to frontend

#### Activation Flow
- [ ] Activation link works
- [ ] Token validates
- [ ] Password sets successfully  
- [ ] Contact marked as `isActivated: true`
- [ ] `activatedAt` timestamp set

#### Login Flow
- [ ] Can login with email + password
- [ ] Firebase authentication succeeds
- [ ] `/api/contacts/by-firebase-uid` returns contact
- [ ] Session data stored correctly
- [ ] Redirect to dashboard works

#### Data Normalization
- [ ] Auth data in proper Prisma fields (not notes JSON)
- [ ] Can query by `firebaseUid` directly
- [ ] `notes` field clean (no `clientPortalAuth` JSON)

---

## Summary

**We ARE creating Firebase users internally:**
- ✅ Using Firebase Admin SDK (server-side only)
- ✅ Admin SDK returns UserRecord object (not a token)
- ✅ Extract `firebaseUser.uid` and store in Prisma DB
- ✅ Generate password reset link (string URL)
- ✅ Return link to frontend (not the UID or token)
- ✅ Creating users WITHOUT passwords
- ✅ Clients set their own passwords via reset link
- ✅ We never see or store passwords

**This is the standard pattern for:**
- Inviting users to platforms
- Onboarding flows
- Enterprise user provisioning

---

**Last Updated:** November 2025  
**Status:** ✅ Complete and Normalized  
**Architecture:** Firebase UID as Universal Identifier  
**Pattern:** Admin SDK (server) + Client SDK (portal)

