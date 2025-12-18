# Multi-CompanyHQ Access Implementation

**Date**: December 2024  
**Status**: ✅ **COMPLETE**

---

## 🎯 Goal

Allow owners (like Adam) to have memberships in multiple CompanyHQs and switch between them without breaking the app.

**Use Case**:
- Adam is OWNER in "Ignite Strategies"
- Adam is OWNER in "Gmail"  
- Adam becomes MANAGER in "BusinessPoint Law"
- Adam can switch between all three and access their data

---

## 🏗️ Architecture

### Before (Single CompanyHQ)
```javascript
localStorage:
  - ownerId: "adam-123"
  - companyHQId: "ignite-strategies-id" // ONE CompanyHQ only
  - companyHQ: { ... } // ONE CompanyHQ object

owner.companyHQ // Only ONE CompanyHQ
```

### After (Multi-CompanyHQ)
```javascript
localStorage:
  - ownerId: "adam-123"
  - companyHQId: "ignite-strategies-id" // CURRENT CompanyHQ
  - companyHQ: { ... } // CURRENT CompanyHQ object
  - memberships: [  // ALL memberships
      { companyHqId: "ignite-strategies-id", role: "OWNER", company_hqs: {...} },
      { companyHqId: "gmail-id", role: "OWNER", company_hqs: {...} },
      { companyHqId: "businesspoint-id", role: "MANAGER", company_hqs: {...} }
    ]

owner.memberships // Array of ALL CompanyHQs
owner.companyHQId // CURRENT/default CompanyHQ
```

---

## 📝 Implementation

### 1. API Changes

**`/api/owner/hydrate`** now returns:

```javascript
{
  success: true,
  owner: {
    id: "adam-123",
    email: "adam@example.com",
    companyHQId: "ignite-strategies-id", // Primary/default
    companyHQ: { id: "ignite-strategies-id", companyName: "Ignite Strategies" },
    memberships: [
      { 
        id: "membership-1",
        userId: "adam-123",
        companyHqId: "ignite-strategies-id",
        role: "OWNER",
        isPrimary: true,
        company_hqs: { id: "...", companyName: "Ignite Strategies" }
      },
      {
        id: "membership-2",
        userId: "adam-123",
        companyHqId: "gmail-id",
        role: "OWNER",
        isPrimary: false,
        company_hqs: { id: "...", companyName: "Gmail" }
      }
    ]
  },
  memberships: [...] // Also at top level
}
```

**Query**:
```javascript
const memberships = await prisma.company_memberships.findMany({
  where: { userId: owner.id },
  include: { company_hqs: true },
  orderBy: [
    { isPrimary: 'desc' },
    { createdAt: 'asc' }
  ]
});
```

---

### 2. Hook Changes

**`useOwner()` hook** now returns:

```javascript
const { 
  ownerId, 
  owner, 
  companyHQId,     // Current CompanyHQ
  companyHQ,       // Current CompanyHQ object
  memberships,     // Array of ALL memberships ← NEW
  loading, 
  hydrated, 
  error 
} = useOwner();
```

**Usage**:
```javascript
// Current CompanyHQ
console.log('Current:', companyHQ.companyName);

// All CompanyHQs user can access
memberships.forEach(m => {
  console.log(`${m.company_hqs.companyName} (${m.role})`);
});
```

---

### 3. Switcher Utility

**`/lib/companyhq-switcher.js`** provides:

```javascript
import { 
  switchCompanyHQ, 
  getCurrentCompanyHQId,
  getAllMemberships,
  hasMembership,
  getRole 
} from '@/lib/companyhq-switcher';

// Switch to a different CompanyHQ
const result = switchCompanyHQ('new-companyhq-id');
// Updates localStorage and returns: { companyHQId, companyHQ, role }

// Get current CompanyHQ
const currentId = getCurrentCompanyHQId();

// Get all memberships
const memberships = getAllMemberships();

// Check if user has access
if (hasMembership('some-companyhq-id')) {
  // User can access this CompanyHQ
}

// Get user's role
const role = getRole('some-companyhq-id'); // 'OWNER' | 'MANAGER' | null
```

---

## 🎨 UI Component Example

```jsx
'use client';

import { useOwner } from '@/hooks/useOwner';
import { switchCompanyHQ } from '@/lib/companyhq-switcher';
import { useRouter } from 'next/navigation';

export function CompanyHQSwitcher() {
  const { companyHQId, memberships } = useOwner();
  const router = useRouter();

  const handleSwitch = (newCompanyHQId) => {
    switchCompanyHQ(newCompanyHQId);
    // Reload to refresh data with new CompanyHQ context
    window.location.reload();
  };

  if (memberships.length <= 1) {
    return null; // No switcher needed if only one CompanyHQ
  }

  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-semibold mb-2">Switch CompanyHQ</h3>
      <div className="space-y-2">
        {memberships.map((membership) => (
          <button
            key={membership.companyHqId}
            onClick={() => handleSwitch(membership.companyHqId)}
            className={`w-full text-left px-3 py-2 rounded ${
              membership.companyHqId === companyHQId
                ? 'bg-blue-100 text-blue-900 font-semibold'
                : 'hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span>{membership.company_hqs.companyName}</span>
              <span className="text-xs text-gray-500">
                {membership.role}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

## 🔐 Security (Unchanged)

**Membership guards still work the same way:**

```javascript
// In any route:
const { membership } = await resolveMembership(owner.id, companyHQId);
if (!membership) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// If owner has membership → access granted
// If owner doesn't have membership → 403
```

**Switching CompanyHQ just changes the "current context"** - guards still check actual membership in DB.

---

## 📊 Data Flow

### On Login/Welcome

1. **Firebase auth** → Get firebaseId
2. **`/api/owner/hydrate`** → Get owner + ALL memberships
3. **localStorage** → Store:
   - `owner` (with memberships)
   - `memberships` (array)
   - `companyHQId` (current/primary)
   - `companyHQ` (current/primary object)

### On CompanyHQ Switch

1. **User clicks** "Switch to Gmail"
2. **`switchCompanyHQ('gmail-id')`**:
   - Finds membership in localStorage
   - Updates `companyHQId`
   - Updates `companyHQ`
3. **Page reload** → All components use new `companyHQId`
4. **API calls** → Use new `companyHQId` from localStorage
5. **Guards check** → Verify membership in DB

### On API Call

1. **Component** → Gets `companyHQId` from `useOwner()` or localStorage
2. **API request** → Includes `companyHQId` in params/body
3. **Route guard** → `resolveMembership(owner.id, companyHQId)`
4. **Database check** → Verify membership exists
5. **Response** → Return data scoped to `companyHQId`

---

## ✅ What This Enables

1. **Adam can be OWNER in multiple CompanyHQs** ✅
2. **Adam can be MANAGER (different role) in other CompanyHQs** ✅
3. **Adam can switch between them without re-auth** ✅
4. **Each CompanyHQ has isolated data** ✅
5. **Guards enforce membership at DB level** ✅
6. **No breaking changes to existing code** ✅

---

## 🧪 Testing

### Test 1: Multiple Memberships
1. Log in as Adam
2. Check `localStorage.memberships` → Should see array
3. Check UI → Should show all accessible CompanyHQs

### Test 2: Switch CompanyHQ
1. Call `switchCompanyHQ(newId)`
2. Check `localStorage.companyHQId` → Should update
3. Reload page
4. Check contacts → Should show new CompanyHQ's contacts

### Test 3: Access Control
1. Get Owner B (not Adam)
2. Try to access Adam's CompanyHQ data
3. Should get 403 Forbidden

---

## 🚀 Future Enhancements

### Phase 2: Add to UI
- [ ] CompanyHQ switcher in navbar/settings
- [ ] Show current CompanyHQ name in header
- [ ] Badge showing role (OWNER/MANAGER)

### Phase 3: Roles Enforcement
- [ ] OWNER can delete CompanyHQ
- [ ] OWNER can invite MANAGERs
- [ ] MANAGER has limited settings access

### Phase 4: Permissions
- [ ] Fine-grained permissions per role
- [ ] Custom roles beyond OWNER/MANAGER

---

## 📝 Migration Notes

**No migration needed!** This is additive:
- ✅ Old code still works (uses single `companyHQId`)
- ✅ New code uses `memberships` array
- ✅ Guards ensure DB-level enforcement
- ✅ localStorage backward compatible

---

**END OF DOCUMENTATION**
