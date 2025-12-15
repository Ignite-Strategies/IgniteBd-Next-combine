# Welcome & Owner Hydration Flow

## Overview

Simple, single-call hydration flow. No race conditions, no duplicate calls, no complex logic.

## Flow

1. **User lands on welcome page**
2. **useOwner hook auto-hydrates once** (uses Firebase ID from token)
3. **Returns full owner object** with companyHQId from relation
4. **Always goes to dashboard** (no profile setup checks)

## Key Principles

### 1. Single Hydrate Call
- `useOwner` hook makes **ONE** API call to `/api/owner/hydrate`
- Uses `hasHydratedRef` to ensure it only happens once
- No manual refresh needed

### 2. Hydrate Route (`/api/owner/hydrate`)
- Finds owner by `firebaseId` (from Firebase token)
- Returns **full owner object** from database
- Adds `companyHQId` from relation (`company_hqs_company_hqs_ownerIdToowners`)
- That's it. No complex includes, no super admin checks, no company arrays.

```javascript
// Simple query - get owner with companyHQId from relation
const owner = await prisma.owners.findUnique({
  where: { firebaseId },
  include: {
    company_hqs_company_hqs_ownerIdToowners: {
      take: 1,
      select: { id: true },
    },
  },
});

// Add companyHQId to owner object
const ownerWithCompanyHQId = {
  ...owner,
  companyHQId: owner.company_hqs_company_hqs_ownerIdToowners?.[0]?.id || null,
};
```

### 3. Welcome Page
- **Always goes to dashboard** - no routing logic based on companyHQId
- Profile setup is **ONLY** for signup flow (to confirm Firebase data)
- Profile changes happen in Settings, not on welcome page

### 4. Profile Setup
- **Only shown during signup** (after creating owner)
- If firstName/lastName already set, redirects to dashboard
- Signin goes directly to dashboard (skips profile setup)

## useOwner Hook

```javascript
// Loads from localStorage instantly (for immediate display)
// Then auto-hydrates once from API (uses Firebase ID from token)
// Stores full owner object to localStorage
```

**Returns:**
- `owner` - Full owner object with companyHQId
- `ownerId` - Owner ID
- `companyHQId` - From owner object
- `companyHQ` - From owner object (if included)
- `loading` - Loading state
- `hydrated` - Whether data has been hydrated from API
- `error` - Error state

## Routing Logic

### Welcome Page
```javascript
// Always go to dashboard - profile changes happen in settings
const nextRoute = '/growth-dashboard';
```

### Signup Flow
```
Signup → Create Owner → Profile Setup (confirm Firebase) → Dashboard
```

### Signin Flow
```
Signin → Dashboard (skip profile setup)
```

### Welcome Flow
```
Welcome → Dashboard (skip profile setup)
```

## What NOT to Do

❌ **Don't check companyHQId for routing** - that's not the welcome page's job
❌ **Don't make multiple hydrate calls** - useOwner handles it once
❌ **Don't add complex includes** - just get owner, add companyHQId from relation
❌ **Don't check super admin** - not needed for welcome/hydration
❌ **Don't query company arrays** - full companyHQ hydration happens on dashboard

## What TO Do

✅ **Return full owner object** - that's what the frontend needs
✅ **Add companyHQId from relation** - it's a foreign key, get it from the relation
✅ **Store to localStorage** - useOwner hook does this automatically
✅ **Always go to dashboard** - routing logic is elsewhere
✅ **One call, one time** - useOwner ensures this

## Database Schema

```prisma
model owners {
  id                                        String             @id
  firebaseId                                String             @unique
  firstName                                 String?
  lastName                                  String?
  // ... other fields
  company_hqs_company_hqs_ownerIdToowners   company_hqs[]      @relation("company_hqs_ownerIdToowners")
}

model company_hqs {
  id          String   @id
  ownerId     String?  // Foreign key to owners.id
  // ... other fields
}
```

**Relationship:**
- `company_hqs.ownerId` → `owners.id`
- To get owner's companyHQId: query `company_hqs` where `ownerId = owner.id`
- Or use the relation: `owner.company_hqs_company_hqs_ownerIdToowners[0].id`

## Files

- `/src/hooks/useOwner.js` - Auto-hydrates owner data
- `/src/app/api/owner/hydrate/route.js` - Returns full owner object with companyHQId
- `/src/app/(onboarding)/welcome/page.jsx` - Always goes to dashboard
- `/src/app/(onboarding)/profilesetup/page.jsx` - Only for signup flow
- `/src/app/(public)/signin/page.jsx` - Goes to dashboard
- `/src/app/(public)/signup/page.jsx` - Goes to profile setup

## Summary

**One call. Full owner object. companyHQId from relation. Always dashboard. That's it.**
