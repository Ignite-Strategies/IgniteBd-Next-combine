# Hydration Systems Overview

## Current Hydration Points

### 1. **Owner Hydration** (`/api/owner/hydrate`)
**Location**: `src/app/api/owner/hydrate/route.js`  
**Hook**: `src/hooks/useOwner.js`  
**Used In**: `welcome/page.jsx`

**What it hydrates:**
- `ownerId` → localStorage
- `owner` (full object) → localStorage
- `companyHQId` → localStorage (from first ownedCompany)
- `companyHQ` → localStorage (from first ownedCompany)
- `ownedCompanies[]` → in owner object
- `managedCompanies[]` → in owner object

**When it runs:**
- Welcome page on mount
- When `refresh()` is called

**localStorage keys:**
- `ownerId`
- `owner`
- `companyHQId`
- `companyHQ`

---

### 2. **CompanyHQ Hook** (`useCompanyHQ`)
**Location**: `src/hooks/useCompanyHQ.js`  
**Used In**: Various pages

**What it hydrates:**
- Reads `companyHQId` from localStorage
- Reads `companyHQ` from localStorage
- Can refresh via `/api/owner/hydrate` (gets latest companyHQ)

**localStorage keys:**
- `companyHQId`
- `companyHQ`

---

### 3. **Company Hydration** (`/api/company/hydrate`) ⭐ NEW
**Location**: `src/app/api/company/hydrate/route.js`  
**Hook**: `src/hooks/useCompanyHydration.js` ⭐ NEW

**What it hydrates:**
- `companyHQ` (full object)
- `personas[]` → localStorage
- `contacts[]` → localStorage (limit 100)
- `products[]` → localStorage
- `pipelines[]` → localStorage (limit 100)
- `stats` (counts and metrics)

**When it runs:**
- Should run on Growth Dashboard
- When `refresh()` is called

**localStorage keys:**
- `companyHydration_{companyHQId}` (full cached object with timestamp)
- `companyHQ`
- `companyHQId`
- `personas`
- `personaId` (first persona ID or null)
- `contacts`
- `products`
- `pipelines`

**Cache TTL**: 5 minutes

---

## Current Issues

### ❌ **Scattered Hydration**
- Each page fetches its own data individually
- Personas page: Fetches `/api/personas` directly
- Growth Dashboard: Fetches `/api/contacts` directly
- No centralized hydration point

### ❌ **Missing Data**
- `personaId` not stored in localStorage
- No centralized place to get all company data
- Each page does its own API call

### ❌ **No Graceful Fallbacks**
- Pages fail if API calls fail
- No localStorage fallback for personas, contacts, etc.

---

## Proposed Solution

### ✅ **Centralized Hydration Flow**

1. **Welcome Page** → Hydrates `ownerId` + `companyHQId`
   - Uses: `useOwner()` hook
   - API: `/api/owner/hydrate`
   - Stores: `ownerId`, `owner`, `companyHQId`, `companyHQ`

2. **Growth Dashboard** → Hydrates ALL company data
   - Uses: `useCompanyHydration(companyHQId)` hook
   - API: `/api/company/hydrate?companyHQId=...`
   - Stores: `personas`, `contacts`, `products`, `pipelines`, `personaId`, etc.

3. **All Other Pages** → Read from localStorage
   - Personas page: Read `personas` from localStorage
   - Contacts page: Read `contacts` from localStorage
   - Products page: Read `products` from localStorage
   - Write `null` if data doesn't exist yet

---

## localStorage Schema

```javascript
{
  // Owner level (from welcome)
  "ownerId": "owner_123",
  "owner": { /* full owner object */ },
  
  // Company level (from welcome + growth dashboard)
  "companyHQId": "company_123",
  "companyHQ": { /* full company object */ },
  
  // Company data (from growth dashboard hydration)
  "personas": [ /* array of personas */ ],
  "personaId": "persona_123" || null,  // First persona or null
  "contacts": [ /* array of contacts */ ],
  "products": [ /* array of products */ ],
  "pipelines": [ /* array of pipelines */ ],
  
  // Cached hydration (with timestamp)
  "companyHydration_{companyHQId}": {
    "data": { /* all company data */ },
    "timestamp": "2025-11-10T..."
  }
}
```

---

## Migration Plan

### Step 1: Update Growth Dashboard
- Use `useCompanyHydration(companyHQId)` hook
- Call `refresh()` on mount if `companyHQId` exists
- Store all data in localStorage

### Step 2: Update Personas Page
- Read `personas` from localStorage first
- If empty/null, show empty state gracefully
- Optionally fetch from API as fallback

### Step 3: Update Other Pages
- Contacts page: Read from localStorage
- Products page: Read from localStorage
- All pages: Write `null` if data doesn't exist

---

## Benefits

✅ **Single source of truth**: Growth Dashboard hydrates everything  
✅ **Fast page loads**: Read from localStorage (no API calls)  
✅ **Graceful degradation**: Pages work even if API fails  
✅ **Consistent data**: All pages see same data  
✅ **Better UX**: Pages load instantly, data updates in background

