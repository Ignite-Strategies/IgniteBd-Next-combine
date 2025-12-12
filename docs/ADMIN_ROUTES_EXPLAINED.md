# Admin Routes Explained

**Date:** 2025-01-28

---

## 🎯 What `/api/admin/*` Routes Do

The `/api/admin/*` routes are **owner-only** routes that:

1. ✅ **Verify Firebase Token** - Ensures user is authenticated
2. ✅ **Check for Owner Record** - Verifies user exists in `Owner` table
3. ✅ **Filter by Owner's Companies** - Only shows data for companies the owner has access to

---

## 🔐 Authentication Flow

### Step 1: Firebase Token Verification
```javascript
const firebaseUser = await verifyFirebaseToken(request);
// Returns: { uid, email, name, picture, emailVerified }
```

### Step 2: Find Owner Record
```javascript
const owner = await prisma.owner.findUnique({
  where: { firebaseId: firebaseUser.uid },
  include: {
    managedCompanies: { select: { id: true } },
    ownedCompanies: { select: { id: true } },
  },
});

if (!owner) {
  return 403; // Owner not found
}
```

### Step 3: Filter Data by Owner's Companies
```javascript
const ownerCompanyIds = [
  ...owner.managedCompanies.map((c) => c.id),
  ...owner.ownedCompanies.map((c) => c.id),
];

// Filter invoices by owner's companies
const where = {
  workPackage: {
    company: {
      companyHQId: { in: ownerCompanyIds },
    },
  },
};
```

---

## 📊 Why This Pattern?

### Multi-Tenant Architecture
- Each **Owner** can have multiple **CompanyHQs**
- Each **CompanyHQ** has multiple **Companies**
- Each **Company** has **WorkPackages**
- Each **WorkPackage** has **Invoices**

### Data Isolation
- Owners only see invoices for their companies
- Prevents cross-tenant data access
- Enforces proper authorization

---

## ⚠️ Common Issues

### Issue: "No Firebase user found"
**Cause:** User not logged in or Firebase not initialized

**Solution:**
- Ensure user is authenticated
- Check Firebase initialization
- Verify `auth.currentUser` exists

### Issue: "Owner not found"
**Cause:** Firebase user exists but no Owner record in database

**Solution:**
- Create Owner record with matching `firebaseId`
- Or use non-admin route if user doesn't need to be Owner

### Issue: "Empty results"
**Cause:** Owner has no companies assigned

**Solution:**
- Assign CompanyHQs to Owner via `managedCompanies` or `ownedCompanies`
- Or check if user should use different route

---

## 🔄 Route Patterns

### Admin Routes (Owner-Only)
- `/api/admin/billing` - List invoices for owner's companies
- `/api/admin/companyhq/create` - Create company (requires SuperAdmin)
- `/api/admin/superadmin/upsert` - Manage super admin

### Regular Routes (Any Authenticated User)
- `/api/billing/invoices/create` - Create invoice (any authenticated user)
- `/api/billing/invoices/[id]` - Get invoice (any authenticated user)
- `/api/workpackages` - List work packages (filtered by access)

---

## 📝 Example: `/api/admin/billing`

```javascript
export async function GET(request) {
  // 1. Verify Firebase token
  const firebaseUser = await verifyFirebaseToken(request);
  
  // 2. Find Owner
  const owner = await prisma.owner.findUnique({
    where: { firebaseId: firebaseUser.uid },
    include: {
      managedCompanies: { select: { id: true } },
      ownedCompanies: { select: { id: true } },
    },
  });
  
  if (!owner) {
    return 403; // Not an owner
  }
  
  // 3. Get owner's company IDs
  const ownerCompanyIds = [
    ...owner.managedCompanies.map((c) => c.id),
    ...owner.ownedCompanies.map((c) => c.id),
  ];
  
  // 4. Filter invoices by owner's companies
  const invoices = await prisma.invoice.findMany({
    where: {
      workPackage: {
        company: {
          companyHQId: { in: ownerCompanyIds },
        },
      },
    },
  });
  
  return { invoices };
}
```

---

## ✅ Summary

**`/api/admin/*` routes:**
- ✅ Require Owner authentication
- ✅ Filter data by owner's companies
- ✅ Enforce multi-tenant isolation
- ✅ Return 403 if user is not an Owner

**If you're not an Owner:**
- Use non-admin routes (e.g., `/api/billing/invoices/*`)
- Or create an Owner record for your Firebase user

---

**Last Updated:** 2025-01-28

