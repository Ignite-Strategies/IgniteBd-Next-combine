# Owner Debug Guide - Fix "Owner Not Found" Error

**Date:** 2025-01-28

---

## 🔍 Problem

You're getting a 401/403 error when accessing `/api/admin/billing` because your Owner record is missing or your `firebaseId` doesn't match.

---

## 🛠️ Quick Fix Steps

### Step 1: Check Your Owner Status

Open your browser console and run:

```javascript
// Get your Firebase token
const user = firebase.auth().currentUser;
const token = await user.getIdToken();
console.log('Firebase UID:', user.uid);

// Check Owner record
fetch('/api/debug/owner-check', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(r => r.json())
.then(data => console.log('Owner Check:', data));
```

Or visit in browser (while logged in):
```
https://app.ignitegrowth.biz/api/debug/owner-check
```

This will show:
- Your Firebase UID
- Whether Owner record exists
- Your Owner ID and companies
- All owners in the database

### Step 2: Fix Your Owner Record

If Owner record is missing, create/fix it:

```javascript
// In browser console
const user = firebase.auth().currentUser;
const token = await user.getIdToken();

fetch('/api/debug/fix-owner', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: user.email,
    name: user.displayName
  })
})
.then(r => r.json())
.then(data => console.log('Owner Fixed:', data));
```

Or visit:
```
POST https://app.ignitegrowth.biz/api/debug/fix-owner
```

---

## 🔎 What to Check

### 1. Firebase UID vs Owner.firebaseId

The route looks for:
```javascript
Owner.findUnique({ where: { firebaseId: firebaseUser.uid } })
```

**Common Issues:**
- ✅ Firebase UID: `abc123xyz`
- ❌ Owner.firebaseId: `different-uid` (mismatch!)
- ❌ Owner.firebaseId: `null` (missing!)

### 2. Owner Record Exists But Wrong firebaseId

If you have an Owner record but wrong `firebaseId`:

```sql
-- Check your Firebase UID (from browser console)
-- Then update Owner record:
UPDATE owners 
SET "firebaseId" = 'YOUR_FIREBASE_UID_HERE'
WHERE email = 'your-email@example.com';
```

### 3. No Owner Record At All

If no Owner record exists, the `/api/debug/fix-owner` route will create one.

---

## 🧪 Debug Routes

### `/api/debug/owner-check`
**GET** - Shows your Firebase UID and Owner record status

**Response:**
```json
{
  "success": true,
  "debug": {
    "firebaseUser": {
      "uid": "abc123...",
      "email": "you@example.com"
    },
    "owner": {
      "id": "owner-id",
      "firebaseId": "abc123...",
      "email": "you@example.com"
    },
    "ownerFound": true,
    "allOwnersInDb": [...]
  }
}
```

### `/api/debug/fix-owner`
**POST** - Creates or updates Owner record

**Body (optional):**
```json
{
  "email": "you@example.com",
  "name": "Your Name"
}
```

---

## 📊 Common Scenarios

### Scenario 1: Owner Record Missing
**Symptom:** `ownerFound: false`

**Fix:**
```bash
# Use the fix-owner route
POST /api/debug/fix-owner
```

### Scenario 2: firebaseId Mismatch
**Symptom:** Owner exists but `firebaseId` doesn't match Firebase UID

**Fix:**
```sql
UPDATE owners 
SET "firebaseId" = 'YOUR_ACTUAL_FIREBASE_UID'
WHERE id = 'your-owner-id';
```

### Scenario 3: Multiple Owner Records
**Symptom:** Multiple owners with same email but different firebaseIds

**Fix:**
```sql
-- Find the correct one
SELECT id, "firebaseId", email FROM owners WHERE email = 'your-email@example.com';

-- Update the one you want to use
UPDATE owners 
SET "firebaseId" = 'YOUR_FIREBASE_UID'
WHERE id = 'correct-owner-id';

-- Delete duplicates (be careful!)
DELETE FROM owners WHERE id IN ('duplicate-id-1', 'duplicate-id-2');
```

---

## 🔧 Manual SQL Fix

If the debug routes don't work, fix directly in database:

```sql
-- 1. Get your Firebase UID (from browser console: firebase.auth().currentUser.uid)

-- 2. Check if Owner exists
SELECT id, "firebaseId", email, name FROM owners WHERE email = 'your-email@example.com';

-- 3. Update firebaseId
UPDATE owners 
SET "firebaseId" = 'YOUR_FIREBASE_UID_HERE'
WHERE email = 'your-email@example.com';

-- 4. Or create new Owner if missing
INSERT INTO owners (id, "firebaseId", email, name, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'YOUR_FIREBASE_UID_HERE',
  'your-email@example.com',
  'Your Name',
  NOW(),
  NOW()
);
```

---

## ✅ Verification

After fixing, verify it works:

1. **Check Owner record:**
   ```
   GET /api/debug/owner-check
   ```
   Should show `ownerFound: true`

2. **Test billing route:**
   ```
   GET /api/admin/billing
   ```
   Should return invoices (or empty array if no invoices)

---

## 🚨 Still Not Working?

1. **Check Firebase Auth:**
   - Is user logged in?
   - Is `firebase.auth().currentUser` not null?
   - Does token refresh work?

2. **Check Database:**
   - Is Owner table accessible?
   - Are there any constraints blocking the update?

3. **Check Logs:**
   - Server logs should show the Firebase UID being searched
   - Check for any Prisma errors

---

**Last Updated:** 2025-01-28

