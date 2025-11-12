# 🧪 Testing the Client Portal Activation Flow

## ✅ Yes, You Can Test It Yourself!

You can test the entire flow without sending it to Joel. Here's how:

## 📋 Step-by-Step Test Flow

### 1. Generate Invite for Joel

Go to: `/client-operations/invite-prospect`

1. Search for "joel" or "joel.gulick@businesspointlaw.com"
2. Click on Joel's contact
3. Click "Generate Portal Access"
4. **Copy the activation link** that appears (e.g., `https://clientportal.ignitegrowth.biz/activate?token=abc123...`)

### 2. Test Activation Flow Yourself

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

### 3. Verify It Worked

After login, you should:
- ✅ See Joel's dashboard
- ✅ Be logged in as Joel
- ✅ See Joel's proposals (if any)
- ✅ Contact marked as `isActivated: true` in database

## 🔍 Check Database State

```bash
export DATABASE_URL="your-database-url"
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});
(async () => {
  const contact = await prisma.contact.findUnique({
    where: { email: 'joel.gulick@businesspointlaw.com' },
    select: {
      email: true,
      firebaseUid: true,
      isActivated: true,
      activatedAt: true,
      clientPortalUrl: true
    }
  });
  console.log(JSON.stringify(contact, null, 2));
  await prisma.\$disconnect();
})();
"
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

## 🎯 What Happens When You Send It to Joel

**For Joel (the actual client):**

1. **You send Joel the activation link** (from step 1)
2. **Joel clicks the link** → Goes to `/activate`
3. **Token validates** → Redirects to `/set-password`
4. **Joel sets his password** → Password stored in Firebase
5. **Joel logs in** → Uses Firebase Auth with his email + password
6. **Joel sees his portal** → Dashboard, proposals, etc.

**Key Point:** Joel sets HIS OWN password. You don't know what it is. He controls it.

## 🧪 Testing Checklist

- [ ] Generate invite for Joel
- [ ] Copy activation link
- [ ] Click activation link (opens `/activate`)
- [ ] Token validates successfully
- [ ] Redirects to `/set-password`
- [ ] Set a test password
- [ ] Password saves to Firebase
- [ ] Contact marked as `isActivated: true`
- [ ] Redirects to `/login?activated=true`
- [ ] Login with Joel's email + test password
- [ ] Login successful
- [ ] See Joel's dashboard
- [ ] Can access portal features

## 🚨 Common Issues

### "Invalid activation token"
- **Cause:** Token expired (24 hours) or already used
- **Fix:** Generate a new invite

### "Token already used"
- **Cause:** Token was already used to activate
- **Fix:** Generate a new invite

### "Firebase user not found"
- **Cause:** Firebase user wasn't created during invite
- **Fix:** Check `/api/invite/send` logs, ensure Firebase user was created

### Can't login after setting password
- **Cause:** Password not set correctly in Firebase
- **Fix:** Check `/api/set-password` logs, verify Firebase Admin SDK is working

## 📝 Notes

- **Activation links expire in 24 hours**
- **Each token can only be used once**
- **Password is stored in Firebase, not in your database**
- **After activation, Joel can reset password via Firebase password reset**

## 🎉 Success Indicators

✅ Activation link works
✅ Token validates
✅ Password sets successfully  
✅ Can login with email + password
✅ Contact marked as activated
✅ Portal access works

---

**TL;DR:** Yes, test it yourself! Generate invite → Click link → Set password → Login as Joel. Then when it works, send Joel the link and he does the same thing.

