# Firebase Auth User Creation - Internal Admin Flow

## Overview

**We (internally) create Firebase user accounts for Contacts using Firebase Admin SDK.** This is server-side user creation that happens BEFORE the client ever logs in.

## The Flow - Step by Step

### 1. Contact Selection (Frontend)
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

### 2. API Route Receives contactId

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

### 3. Firebase Admin SDK Initialization

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

### 4. User Creation/Upsert Logic

**File:** `src/app/api/contacts/[contactId]/generate-portal-access/route.js`

```javascript
const auth = admin.auth(); // Firebase Admin Auth instance

// Try to get existing user by email
try {
  firebaseUser = await auth.getUserByEmail(contact.email);
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
}
```

**Critical:** We're **NOT setting a password** when creating the user. Firebase creates the account in a "passwordless" state.

### 5. Generate Password Reset Link

```javascript
// Firebase generates a password reset link
const resetLink = await auth.generatePasswordResetLink(contact.email);
// Returns: https://firebase-auth-link...?oobCode=xxx&mode=resetPassword
```

**What This Does:**
- Firebase creates a secure, time-limited link
- Link allows user to SET their password (not reset an existing one)
- Works even if user has no password yet
- Link expires after a set time (Firebase default)

### 6. Store Firebase UID in Contact

```javascript
// Link Contact to Firebase user
await prisma.contact.update({
  where: { id: contactId },
  data: {
    notes: JSON.stringify({
      ...existingNotes,
      clientPortalAuth: {
        firebaseUid: firebaseUser.uid,  // Link: Contact.id → Firebase UID
        generatedAt: new Date().toISOString(),
        portalUrl: 'http://localhost:3001',
      },
    }),
  },
});
```

**The Link:**
- `Contact.id` (Prisma) → `Contact.notes.clientPortalAuth.firebaseUid` → `Firebase User.uid`
- This is how we connect our Contact record to Firebase user

## Answering Your Questions

### Q: Are we basically upserting?

**A: YES - We're doing an upsert pattern:**

1. **Try to get existing user** by email
   - If exists → Use existing Firebase user
   - If not → Create new Firebase user

2. **Always generate a new reset link** (even for existing users)
   - This allows re-inviting contacts
   - Each link is unique and time-limited

### Q: Does Firebase just spit out a password?

**A: NO - Firebase does NOT create a password for us.**

**What Actually Happens:**
1. We create user **WITHOUT a password** (passwordless state)
2. Firebase generates a **password reset link**
3. Client clicks link → Firebase shows password setup page
4. Client **sets their own password** on Firebase's page
5. Client can then log in with email + their password

**We never see or know the password!**

### Q: Is this even possible?

**A: YES - This is exactly what Firebase Admin SDK is for:**

- **Client SDK** (`firebase/auth`) - For end users to sign up/login
- **Admin SDK** (`firebase-admin`) - For server-side user management

**Admin SDK Capabilities:**
- ✅ Create users programmatically
- ✅ Generate password reset links
- ✅ Manage users without passwords
- ✅ Set custom claims
- ✅ Disable/enable accounts

## The Complete Flow Diagram

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
│    → Update Contact.notes.clientPortalAuth                  │
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
│    → System finds Contact by email                          │
│    → Portal hydrates with Contact data                      │
└─────────────────────────────────────────────────────────────┘
```

## Key Technical Details

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

## Security Model

### Why This Works

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
   - Contact.id → Contact.notes.firebaseUid → Firebase User.uid
   - Universal personhood maintained

## Summary

**We ARE creating Firebase users internally:**
- ✅ Using Firebase Admin SDK (server-side)
- ✅ Creating users WITHOUT passwords
- ✅ Generating password reset links
- ✅ Clients set their own passwords
- ✅ We never see or store passwords

**This is the standard pattern for:**
- Inviting users to platforms
- Onboarding flows
- Enterprise user provisioning

