# 🔐 Client Portal Login Flow

## Architecture Alignment

This flow follows **FIREBASE-AUTH-AND-USER-MANAGEMENT.md** Pattern B (Hydrate Route).

---

## Step-by-Step Login Flow

### 1. User Enters Email/Password (Frontend)
**File:** `ignitebd-clientportal/app/login/page.jsx`

```javascript
// User submits form with email and password
credentials = {
  username: "joel@businesspointlaw.com",
  password: "user-password"
}
```

### 2. Firebase Authentication (Frontend)
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

### 3. Get Firebase Token (Frontend)
**File:** `ignitebd-clientportal/app/login/page.jsx`

```javascript
// Step 2: Get Firebase token for API calls
const idToken = await result.user.getIdToken();
// Token is automatically managed by Firebase SDK
// No manual storage needed - axios interceptor handles it
```

### 4. Find Contact by Firebase UID (Backend API)
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

### 5. Store Session (Frontend)
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

### 6. Redirect to Dashboard
```javascript
router.push('/welcome');
```

---

## Key Architecture Points

### ✅ What We're Doing Right

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

### ❌ What Was Wrong Before

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

---

## Database Schema

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

---

## Error Handling

### Contact Not Found
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

### Firebase Auth Fails
```javascript
// If email/password is wrong:
FirebaseError: auth/wrong-password
// User sees: "Sign-in failed. Please check your credentials."
```

---

## Flow Diagram

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

---

## Testing Checklist

- [ ] User can sign in with email/password
- [ ] Firebase authentication succeeds
- [ ] `/api/contacts/by-firebase-uid` returns contact
- [ ] Contact has `firebaseUid` set in database
- [ ] Axios interceptor adds token automatically
- [ ] Session data stored correctly
- [ ] Redirect to dashboard works

---

**Last Updated:** 2025-11-12  
**Status:** ✅ Aligned with FIREBASE-AUTH-AND-USER-MANAGEMENT.md

