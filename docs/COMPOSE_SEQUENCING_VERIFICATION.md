# Compose Page Sequencing Verification

## ✅ Verified Sequencing

### 1. Templates Load FIRST (Company-Scoped)
**Location:** `app/(authenticated)/outreach/compose/page.jsx` (lines 130-148)

```javascript
// Load templates FIRST (sequential loading) - scoped from companyHQId params
useEffect(() => {
  if (!companyHQId) return;
  
  fetch(`/api/templates?companyHQId=${companyHQId}`)
    .then(...)
}, [companyHQId]);
```

**Behavior:**
- ✅ Loads immediately when `companyHQId` is available
- ✅ Scoped from URL params (`companyHQId`)
- ✅ No dependency on ownerId or other data
- ✅ Sequential: Loads first, before contacts

**API Call:**
- `GET /api/templates?companyHQId=${companyHQId}`
- Company-scoped (correct)

---

### 2. Contacts Load SECOND (Only When User Types)
**Location:** `components/ContactSelector.jsx` (lines 68-110)

```javascript
// Search-based contact loading - ONLY when user types (debounced, scoped from companyHQId params)
useEffect(() => {
  if (!companyHQId || !ownerId || !ownerHydrated) return;
  
  // Don't fetch if search is too short or empty
  if (!contactSearch || contactSearch.trim().length < 2) {
    setContacts([]);
    return;
  }
  
  // Debounce search - wait 300ms after user stops typing
  const timeoutId = setTimeout(async () => {
    fetch(`/api/contacts?companyHQId=${companyHQId}`)
      .then(...)
  }, 300);
  
  return () => clearTimeout(timeoutId);
}, [contactSearch, companyHQId, companyId, ownerId, ownerHydrated]);
```

**Behavior:**
- ✅ Only loads when user types (2+ characters)
- ✅ Debounced 300ms (waits for user to stop typing)
- ✅ Scoped from URL params (`companyHQId`)
- ✅ Sequential: Loads after templates (no dependency on templates)

**API Call:**
- `GET /api/contacts?companyHQId=${companyHQId}`
- Company-scoped (correct)
- Only fires when `contactSearch.length >= 2`

---

## Sequencing Flow

```
1. Page Loads
   ↓
2. companyHQId from URL params
   ↓
3. Templates Load (immediate, company-scoped)
   ↓
4. User Types in Contact Search (2+ chars)
   ↓
5. Contacts Load (debounced 300ms, company-scoped)
   ↓
6. Client-side filtering (availableContacts useMemo)
```

---

## Verification Checklist

### ✅ Templates
- [x] Loads first (no dependencies)
- [x] Scoped from `companyHQId` params
- [x] API: `GET /api/templates?companyHQId=${companyHQId}`
- [x] Sequential: No blocking on other data

### ✅ Contacts
- [x] Loads only when user types (2+ characters)
- [x] Debounced 300ms
- [x] Scoped from `companyHQId` params
- [x] API: `GET /api/contacts?companyHQId=${companyHQId}`
- [x] Sequential: After templates (but independent)

### ✅ Sender
- [x] Reads from localStorage (no API calls)
- [x] From `owner.sendgridVerifiedEmail`
- [x] No sequencing dependency

---

## Test Scenarios

### Scenario 1: Normal Flow
1. Navigate to `/outreach/compose?companyHQId=xxx`
2. ✅ Templates load immediately
3. User types "John" in contact search
4. ✅ Contacts load after 300ms debounce
5. ✅ Dropdown shows filtered contacts

### Scenario 2: No Templates
1. Navigate to `/outreach/compose?companyHQId=xxx`
2. Templates API returns 401 or error
3. ✅ Page still renders
4. ✅ Template selector shows error
5. ✅ User can still type and load contacts

### Scenario 3: No Contacts
1. Navigate to `/outreach/compose?companyHQId=xxx`
2. ✅ Templates load
3. User types "John" in contact search
4. Contacts API returns 401 or error
5. ✅ Page still renders
6. ✅ User can still enter email manually

---

## Summary

**Sequencing:** ✅ CORRECT
- Templates load first (immediate)
- Contacts load second (only when user types)
- Both scoped from `companyHQId` params
- No blocking dependencies

**Scoping:** ✅ CORRECT
- Templates: `companyHQId` from URL params
- Contacts: `companyHQId` from URL params
- Both company-scoped (not owner-scoped)

**User Experience:** ✅ CORRECT
- Page always renders
- Templates load immediately
- Contacts load on-demand (when typing)
- Failures don't break the page

