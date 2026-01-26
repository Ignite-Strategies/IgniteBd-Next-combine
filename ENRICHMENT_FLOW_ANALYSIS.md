# Enrichment Flow Analysis - LinkedIn Contact Enrichment

## Problem Statement

User wants a simple flow: "I just want this person's email" → hit save → done. But the current implementation is doing too much, including company creation/updates even for basic saves, which is causing errors and complexity.

---

## Current Flow Analysis

### 1. Apollo First Call (`handleEnrich` → `/api/enrich/enrich`)

**What it does:**
- User enters LinkedIn URL
- Frontend calls `/api/enrich/enrich` with `linkedinUrl`
- Backend calls Apollo `/people/enrich` endpoint
- Apollo returns: name, email, title, company name, domain, phone, etc.
- **NO database writes**
- **Redis storage is optional** - tries to store but non-critical (wrapped in try-catch)
- Returns normalized data + raw Apollo response directly to frontend
- Frontend stores data in component state (no Redis needed)

**Code location:**
- Frontend: `app/(authenticated)/contacts/enrich/linkedin/page.jsx` → `handleEnrich()`
- Backend: `app/api/enrich/enrich/route.ts`

**Returns:**
```typescript
{
  success: true,
  enrichedProfile: NormalizedContactData, // firstName, lastName, email, title, etc.
  rawApolloResponse: ApolloPersonMatchResponse, // Full Apollo response
  redisKey: string | null // Optional - not used by frontend
}
```

**Redis Status:**
- ✅ **Redis is OPTIONAL** - Frontend stores data in component state
- ✅ Enrich route tries to store in Redis but doesn't fail if Redis is down
- ✅ Frontend doesn't use `redisKey` - just stores `rawEnrichmentPayload` in state
- ✅ Save route accepts `rawEnrichmentPayload` directly (bypasses Redis)

---

### 2. User Options After Enrichment

**Two buttons appear:**
1. **"Save Contact"** - Should be basic save (contact only)
2. **"Enrich Full Profile"** - Full intelligence + company data

**Code location:**
- `app/(authenticated)/contacts/enrich/linkedin/page.jsx` lines 424-448

---

### 3. Current "Save Contact" Flow (`handleSave`)

**Step 1: Create Contact**
- Calls `/api/contacts` (POST)
- Creates contact with: firstName, lastName, email, phone, title
- **This works fine**

**Step 2: Save Enrichment**
- Calls `/api/contacts/enrich/save` with:
  - `contactId`
  - `rawEnrichmentPayload` (sent directly from frontend state - **no Redis needed**)
  - `skipIntelligence: true` (because no intelligence was generated)
  - `companyHQId`
  
**Redis Status:**
- ✅ Frontend sends `rawEnrichmentPayload` directly in request body
- ✅ Backend uses it directly (line 169-172: "Using enrichment payload from request body (skipping Redis)")
- ✅ Redis is only fallback if `redisKey` provided but no `rawEnrichmentPayload`
- ✅ **Redis is not needed for this flow** - data comes from frontend state

**THE PROBLEM:**
- Even though `skipIntelligence: true`, the save route **ALWAYS** runs STEP 2 (company creation/update)
- This tries to find/create/update companies even for basic saves
- This is causing errors and unnecessary complexity

**Code location:**
- Frontend: `app/(authenticated)/contacts/enrich/linkedin/page.jsx` → `handleSave()` lines 160-236
- Backend: `app/api/contacts/enrich/save/route.ts` lines 430-688

---

### 4. Company Uniqueness Issue

**Schema constraint:**
```prisma
model companies {
  domain String? @unique  // Line 271 - domain is globally unique
  // ...
}
```

**Problem:**
- Domain is **globally unique** across all CompanyHQs
- If a company with domain `sroacapital.com` already exists (from another CompanyHQ or previous enrichment), trying to create another one will fail
- This can cause errors during basic saves when we shouldn't even be touching companies

**Error example:**
```
Invalid `prisma.companies.create()` invocation
Argument `lastFundingAmount`: Invalid value provided. Expected Float or Null, provided String.
```

**Root cause:**
- Apollo returns `lastFundingAmount` as string like `"930M"` but schema expects `Float?`
- We're trying to create companies even for basic saves
- Company creation logic is too complex and error-prone

---

### 5. What's Happening in `/api/contacts/enrich/save`

**STEP 1: Update Contact** ✅
- Updates contact with enrichment fields (title, linkedinUrl, etc.)
- Stores raw enrichment payload
- **This is fine**

**STEP 2: Company Creation/Update** ❌ **THE PROBLEM**
- **ALWAYS runs** regardless of `skipIntelligence` flag
- Tries to:
  1. Find existing company by `contactCompanyId`
  2. If not found, find by domain (globally unique)
  3. If still not found, **create new company**
  4. Update company with enrichment data
- This runs even for basic saves when user just wants the contact

**Code location:**
- `app/api/contacts/enrich/save/route.ts` lines 430-688

---

## The Core Problem

**Basic save should:**
- ✅ Update contact with basic enrichment fields (title, linkedinUrl, etc.)
- ❌ **NOT** touch companies at all
- ❌ **NOT** try to create/update companies

**Full enrichment should:**
- ✅ Update contact with all enrichment fields
- ✅ Create/update companies with full data
- ✅ Include intelligence scores
- ✅ Include company intelligence

**Current behavior:**
- Both paths try to create/update companies
- This causes errors (domain uniqueness, funding amount parsing, etc.)
- Too much complexity for a simple "just save the contact" use case

---

## Solution

### Add `skipCompanyCreation` Flag

**Basic Save Flow:**
```typescript
// Frontend: handleSave() for basic contact
const saveResponse = await api.post('/api/contacts/enrich/save', {
  contactId,
  rawEnrichmentPayload: enrichmentData.rawEnrichmentPayload,
  companyHQId,
  skipIntelligence: true,
  skipCompanyCreation: true,  // NEW: Skip company logic
});
```

**Full Enrichment Flow:**
```typescript
// Frontend: handleSave() after "Enrich Full Profile"
const saveResponse = await api.post('/api/contacts/enrich/save', {
  contactId,
  rawEnrichmentPayload: enrichmentData.rawEnrichmentPayload,
  companyHQId,
  skipIntelligence: false,
  skipCompanyCreation: false,  // Do company creation/update
  // ... intelligence fields
});
```

**Backend Logic:**
```typescript
// In /api/contacts/enrich/save/route.ts
if (skipCompanyCreation) {
  console.log('⏭️ Skipping company creation/update (basic save mode)');
  // Skip entire STEP 2
} else {
  // Run full company creation/update logic
  // ... existing company logic
}
```

---

## Additional Fixes Needed

### 1. Fix `lastFundingAmount` Parsing
- Apollo returns `"930M"` (string) but schema expects `Float?`
- **Status:** ✅ Fixed in `lib/enrichment/normalizeCompanyApollo.ts`
- Added `parseFundingAmount()` function to convert strings to numbers

### 2. Company Domain Uniqueness
- Domain is globally unique - can't have duplicates
- Need to handle case where company already exists
- **Current:** Tries to create, fails if exists
- **Should:** Find by domain first, then update if exists

### 3. Redis Cleanup (Optional)
- **Status:** Redis is already optional for enrichment flow
- Frontend stores data in state, sends directly to save route
- Enrich route still tries to store in Redis (non-critical, wrapped in try-catch)
- **Could remove:** Redis storage from `/api/enrich/enrich` route since it's not used
- **Keep:** Redis fallback in save route for backward compatibility

---

## Implementation Checklist

- [ ] Add `skipCompanyCreation` parameter to `/api/contacts/enrich/save`
- [ ] Update frontend `handleSave()` to pass `skipCompanyCreation: true` for basic saves
- [ ] Update frontend `handleSave()` to pass `skipCompanyCreation: false` for full enrichment
- [ ] Wrap STEP 2 (company logic) in `if (!skipCompanyCreation)` check
- [ ] Test basic save (should only update contact, no company)
- [ ] Test full enrichment (should update contact + create/update company)
- [ ] Verify `lastFundingAmount` parsing works correctly
- [ ] Handle company domain uniqueness edge cases

---

## Files to Modify

1. **Backend:**
   - `app/api/contacts/enrich/save/route.ts` - Add `skipCompanyCreation` flag and wrap STEP 2

2. **Frontend:**
   - `app/(authenticated)/contacts/enrich/linkedin/page.jsx` - Pass `skipCompanyCreation` flag in `handleSave()`

3. **Already Fixed:**
   - `lib/enrichment/normalizeCompanyApollo.ts` - Added funding amount parsing

---

## Notes

- The enrichment flow has become too complex
- Basic saves shouldn't require company creation
- Company creation should be optional and only for full enrichment
- Domain uniqueness constraint needs careful handling
- Apollo data format (strings vs numbers) needs proper parsing

