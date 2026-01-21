# Compose Page: Company & Owner Usage Audit

## Overview

This document maps all usages of `companyHQId` (from URL params) and `ownerId` (from localStorage) in the compose page and related components.

---

## 🔍 CompanyHQId Usage (33 occurrences in compose page)

### Source: URL Params → localStorage fallback
- **Line 19-20:** Read from URL params, initialize state
- **Line 24-48:** Fallback to localStorage if not in URL, redirect to add to URL
- **Line 118:** Check if missing (show error)

### Used For:

#### 1. **Templates Loading** (Company-Scoped)
- **Line 144-170:** `useEffect` loads templates
- **API Call:** `GET /api/templates?companyHQId=${companyHQId}`
- **Dependency:** `[companyHQId]`
- **Purpose:** Load email templates for the company
- **Scope:** ✅ Company-scoped (correct)

#### 2. **ContactSelector Component** (Company-Scoped)
- **Line 594:** Passed as prop to `<ContactSelector companyHQId={companyHQId} />`
- **Inside ContactSelector:** 
  - **Line 82:** `GET /api/contacts?companyHQId=${companyHQId}`
  - **Purpose:** Load contacts for the company
  - **Scope:** ✅ Company-scoped (correct)

#### 3. **Quick Contact Creation** (Company-Scoped)
- **Line 202-215:** Quick save contact
- **API Call:** `POST /api/contacts/create` with `companyHQId` in body
- **Purpose:** Create new contact scoped to company
- **Scope:** ✅ Company-scoped (correct)

#### 4. **Tenant ID** (Fallback)
- **Line 245-246:** If contact has no `crmId`, use `companyHQId` as `tenantId`
- **Purpose:** Used in email payload
- **Scope:** ✅ Company-scoped (correct)

#### 5. **Navigation/URLs**
- **Line 534:** Back button URL: `/outreach?companyHQId=${companyHQId}`
- **Purpose:** Maintain company context in navigation

---

## 👤 OwnerId Usage (16 occurrences in compose page)

### Source: localStorage only
- **Line 51-62:** Read from localStorage on mount
- **No URL param fallback** (unlike companyHQId)

### Used For:

#### 1. **Sender Verification** (Owner-Scoped)
- **Line 564:** Passed to `<SenderIdentityPanel ownerId={ownerId} />`
- **Inside SenderIdentityPanel:**
  - **Line 42:** `GET /api/outreach/verified-senders`
  - **Purpose:** Load verified sender email for the owner
  - **Scope:** ✅ Owner-scoped (correct - sender is per owner, not per company)

#### 2. **Form Validation** (Auth Check)
- **Line 291:** Preview validation - requires `ownerId`
- **Line 452:** Send validation - requires `ownerId`
- **Line 850:** Preview button disabled if no `ownerId`
- **Line 867:** Send button disabled if no `ownerId`
- **Purpose:** Ensure user is authenticated before sending

#### 3. **Contact from URL** (Owner-Scoped for Auth)
- **Line 174-193:** Load contact from URL param `contactId`
- **API Call:** `GET /api/contacts/${urlContactId}`
- **Dependency:** `[searchParams, ownerId]`
- **Purpose:** Pre-fill form when navigating from contact page
- **Note:** Uses `ownerId` for auth, but contact is company-scoped

#### 4. **State Reset**
- **Line 130-140:** Reset sender state if `ownerId` is missing
- **Purpose:** Clear sender when user logs out

---

## 📊 Summary: What Calls What

### Company-Scoped API Calls (Need `companyHQId`)
1. ✅ **Templates:** `GET /api/templates?companyHQId=${companyHQId}`
2. ✅ **Contacts:** `GET /api/contacts?companyHQId=${companyHQId}` (via ContactSelector)
3. ✅ **Create Contact:** `POST /api/contacts/create` with `companyHQId` in body

### Owner-Scoped API Calls (Need `ownerId`)
1. ✅ **Verified Sender:** `GET /api/outreach/verified-senders` (via SenderIdentityPanel)
2. ✅ **Update Sender:** `PUT /api/outreach/verified-senders` (via SenderIdentityPanel)
3. ✅ **Find Senders:** `POST /api/outreach/verified-senders/find-or-create` (via SenderIdentityPanel)

### Mixed (Need Both)
1. ✅ **Contact from URL:** `GET /api/contacts/${contactId}` - Uses `ownerId` for auth, contact is company-scoped
2. ✅ **Send Email:** `POST /api/outreach/build-payload` - Uses both (ownerId for auth, companyHQId for context)

---

## 🤔 Key Observations

### 1. **CompanyHQId Flow**
- ✅ **Source:** URL params (primary) → localStorage (fallback)
- ✅ **Used for:** Company-scoped resources (templates, contacts)
- ✅ **Pattern:** Consistent - always from URL/localStorage

### 2. **OwnerId Flow**
- ⚠️ **Source:** localStorage only (no URL param)
- ✅ **Used for:** Owner-scoped resources (sender verification)
- ⚠️ **Pattern:** Inconsistent - only localStorage, no URL fallback

### 3. **The "Haunted" Problem**
The page has **two separate loading flows**:
- **Company flow:** URL → localStorage → redirect → load company data
- **Owner flow:** localStorage → load owner data

These flows are **independent** and can cause race conditions:
- Templates wait for `companyHQId` ✅
- Sender waits for `ownerId` ✅
- But they load **in parallel**, not sequentially
- If one fails, the other still tries to load

### 4. **Sender is Owner-Scoped, Not Company-Scoped**
- ✅ **Correct:** Sender verification is per owner (one owner can have multiple companies)
- ✅ **Current implementation:** Uses `ownerId` from localStorage
- ⚠️ **Potential issue:** If owner switches companies, sender stays the same (correct behavior)

---

## 💡 Reframing Ideas

### Option 1: **Unified Loading Hook**
Create a single hook that manages both:
```javascript
const { companyHQId, ownerId, ready } = useComposeContext();
```
- Handles URL/localStorage for companyHQId
- Handles localStorage for ownerId
- Provides `ready` flag when both are available
- All components wait for `ready` before making API calls

### Option 2: **Context Provider**
Wrap compose page in a context provider:
```javascript
<ComposeProvider companyHQId={urlCompanyHQId} ownerId={localStorageOwnerId}>
  <ComposeForm />
  <TemplateSelector />
</ComposeProvider>
```
- Single source of truth for both IDs
- Components can access via context
- No prop drilling

### Option 3: **Sequential Loading**
Load in order:
1. **Owner first** (from localStorage - fast)
2. **Company second** (from URL/localStorage - might redirect)
3. **Then load data** (templates, contacts, sender)

### Option 4: **Separate Concerns More Clearly**
- **CompanyHQId:** Only for company-scoped data (templates, contacts)
- **OwnerId:** Only for owner-scoped data (sender) + auth validation
- Make the distinction explicit in component names/props

### Option 5: **URL-First Everything**
- Put `ownerId` in URL params too (like `companyHQId`)
- Single source of truth: URL params
- localStorage only as fallback
- Consistent pattern

---

## 🎯 Recommended Approach

**Option 1 + Option 4 Hybrid:**
1. Create `useComposeContext()` hook that:
   - Manages `companyHQId` (URL → localStorage)
   - Manages `ownerId` (localStorage)
   - Provides `ready` flag
   - Handles redirects

2. Make scope explicit:
   - Components that need company: `<TemplateSelector companyHQId={companyHQId} />`
   - Components that need owner: `<SenderIdentityPanel ownerId={ownerId} />`
   - Components that need both: Wait for `ready`

3. Sequential loading:
   - Load owner data first (sender)
   - Load company data second (templates, contacts)
   - Both wait for `ready` flag

This would:
- ✅ Reduce race conditions
- ✅ Make dependencies explicit
- ✅ Simplify debugging
- ✅ Keep scope clear (company vs owner)

---

## 📝 Next Steps

1. **Audit complete** ✅ (this document)
2. **Decide on reframing approach** (Option 1+4 recommended)
3. **Implement unified loading hook**
4. **Refactor components to use hook**
5. **Test sequential loading**

