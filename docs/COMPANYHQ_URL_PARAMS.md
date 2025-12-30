# CompanyHQ URL Parameters - Full Documentation

**Date**: January 2025  
**Status**: ✅ Active  
**Purpose**: Eliminate localStorage state management for CompanyHQ context - use explicit URL parameters instead

---

## Overview

Previously, CompanyHQ context was managed via localStorage, which led to:
- ❌ Stale state issues
- ❌ Cross-tab sync problems
- ❌ Hard to debug which CompanyHQ was being used
- ❌ Contacts saved to wrong CompanyHQ

**Solution**: Use URL query parameters (`?companyHQId=xxx`) for all CompanyHQ context.

---

## Architecture

### URL Parameter Pattern

All pages that need CompanyHQ context now require it in the URL:

```
/contacts/view?companyHQId=xxx
/contacts/enrich/linkedin?companyHQId=xxx
/people?companyHQId=xxx
/people/load?companyHQId=xxx
```

### Benefits

1. **Explicit Context**: You can see exactly which CompanyHQ you're working with in the URL
2. **No State Sync Issues**: URL is the single source of truth
3. **Easy Debugging**: Console logs show CompanyHQ from URL params
4. **Shareable Links**: URLs can be shared with CompanyHQ context included
5. **Browser History**: Back/forward buttons work correctly with CompanyHQ context

---

## Implementation

### Pages Updated

#### 1. `/contacts/enrich/linkedin`

**Before:**
```javascript
const companyHQId = localStorage.getItem('companyHQId');
```

**After:**
```javascript
const searchParams = useSearchParams();
const companyHQId = searchParams?.get('companyHQId');

// Redirect if missing
if (!companyHQId) {
  const stored = localStorage.getItem('companyHQId');
  if (stored) {
    router.replace(`/contacts/enrich/linkedin?companyHQId=${stored}`);
  } else {
    router.push('/people');
  }
}
```

**Console Logging:**
```javascript
console.log('🏢 CompanyHQ from URL params:', {
  companyHQId,
  timestamp: new Date().toISOString(),
});
```

#### 2. `/contacts/view`

**Before:**
```javascript
const [companyHQId, setCompanyHQId] = useState('');
// Load from localStorage with event listeners
```

**After:**
```javascript
const searchParams = useSearchParams();
const companyHQId = searchParams?.get('companyHQId') || '';

// Redirect if missing
if (!companyHQId) {
  const stored = localStorage.getItem('companyHQId');
  if (stored) {
    router.replace(`/contacts/view?companyHQId=${stored}`);
  } else {
    router.push('/people');
  }
}
```

**Console Logging:**
```javascript
console.log('🔄 Fetching contacts from API:', {
  companyHQId,
  timestamp: new Date().toISOString(),
});

console.log('📞 Fetching contacts from API:', {
  companyHQId,
  pipelineFilter: pipelineFilter || 'all',
  url: `/api/contacts?${params.toString()}`,
});

console.log(`✅ Fetched ${fetchedContacts.length} contacts for CompanyHQ: ${companyHQId}`);
```

#### 3. `/people` (People Hub)

**Navigation Updated:**
```javascript
const ACTION_CARDS = [
  {
    id: 'manage',
    route: companyHQId ? `/contacts/view?companyHQId=${companyHQId}` : '/contacts/view',
    // ...
  },
];
```

#### 4. `/people/load`

**Navigation Updated:**
```javascript
const LOAD_OPTIONS = [
  {
    id: 'discover-linkedin',
    route: companyHQId 
      ? `/contacts/enrich/linkedin?companyHQId=${companyHQId}` 
      : '/contacts/enrich/linkedin',
    // ...
  },
];
```

---

## Contact Save Flow

### LinkedIn Enrich Page

**Save Process:**
1. Get `companyHQId` from URL params
2. Log CompanyHQ being used
3. Create contact with `crmId: companyHQId`
4. Save enrichment with `companyHQId` in request body
5. Log confirmation with `crmId` match check

**Console Output:**
```
💾 Saving contact to CompanyHQ: { companyHQId: "xxx", contactEmail: "...", timestamp: "..." }
📤 Creating contact with data: { crmId: "xxx", firstName: "...", ... }
✅ Contact created: { contactId: "...", email: "...", crmId: "xxx", companyHQId: "xxx", matches: true }
📤 Saving enrichment for contact: { contactId: "...", companyHQId: "xxx" }
✅ Enrichment saved: { success: true, contactId: "...", contactCrmId: "xxx", companyHQId: "xxx", matches: true }
```

### Contacts View Page

**Load Process:**
1. Get `companyHQId` from URL params
2. Log CompanyHQ being queried
3. Fetch contacts from API with `companyHQId` in query params
4. Log results

**Console Output:**
```
🔄 Fetching contacts from API: { companyHQId: "xxx", timestamp: "..." }
📞 Fetching contacts from API: { companyHQId: "xxx", pipelineFilter: "all", url: "/api/contacts?companyHQId=xxx" }
✅ Fetched 4 contacts for CompanyHQ: xxx
```

---

## Navigation Patterns

### From People Hub

```javascript
// Navigate to contacts view
router.push(`/contacts/view?companyHQId=${companyHQId}`);

// Navigate to LinkedIn enrich
router.push(`/contacts/enrich/linkedin?companyHQId=${companyHQId}`);
```

### From Contacts View

```javascript
// Navigate to contact detail
router.push(`/contacts/${contactId}?companyHQId=${companyHQId}`);

// Navigate back to people hub
router.push(`/people?companyHQId=${companyHQId}`);
```

### From LinkedIn Enrich

```javascript
// Navigate to contact detail after save
router.push(`/contacts/${savedContactId}?companyHQId=${companyHQId}`);

// Navigate to compose email
router.push(`/outreach/compose?contactId=${savedContactId}&companyHQId=${companyHQId}`);
```

---

## Fallback Behavior

If `companyHQId` is missing from URL:

1. **Check localStorage** for stored `companyHQId`
2. **If found**: Redirect to same page with `?companyHQId=xxx` added
3. **If not found**: Redirect to `/people` (People Hub)

This ensures backward compatibility while migrating to URL params.

---

## Debugging

### Console Logs

All pages now log CompanyHQ context:

**On Page Load:**
```
🏢 CompanyHQ from URL params: { companyHQId: "xxx", timestamp: "..." }
```

**On API Calls:**
```
📞 Fetching contacts from API: { companyHQId: "xxx", url: "/api/contacts?companyHQId=xxx" }
✅ Fetched X contacts for CompanyHQ: xxx
```

**On Contact Save:**
```
💾 Saving contact to CompanyHQ: { companyHQId: "xxx", contactEmail: "...", timestamp: "..." }
✅ Contact created: { contactId: "...", crmId: "xxx", matches: true }
```

### Verification

To verify which CompanyHQ is being used:

1. **Check URL**: Look for `?companyHQId=xxx` in the address bar
2. **Check Console**: Look for `🏢 CompanyHQ from URL params` log
3. **Check API Calls**: Look for `companyHQId` in API request URLs
4. **Check Save Logs**: Look for `matches: true/false` in contact creation logs

---

## Related Fixes

### Contact Service Bug Fix

**File**: `lib/services/contactService.ts`

**Issue**: Was using global email lookup instead of CompanyHQ-scoped lookup

**Before:**
```typescript
const contact = await prisma.contact.upsert({
  where: {
    email: normalizedEmail, // ❌ Global lookup
  },
  // ...
});
```

**After:**
```typescript
const contact = await prisma.contact.upsert({
  where: {
    email_crmId: { // ✅ CompanyHQ-scoped lookup
      email: normalizedEmail,
      crmId: crmId,
    },
  },
  // ...
});
```

This ensures contacts are scoped to the correct CompanyHQ and prevents cross-tenant data leaks.

---

## Migration Notes

### For Developers

When adding new pages that need CompanyHQ context:

1. **Get from URL params:**
   ```javascript
   const searchParams = useSearchParams();
   const companyHQId = searchParams?.get('companyHQId');
   ```

2. **Add fallback redirect:**
   ```javascript
   if (!companyHQId) {
     const stored = localStorage.getItem('companyHQId');
     if (stored) {
       router.replace(`/your-page?companyHQId=${stored}`);
     } else {
       router.push('/people');
     }
   }
   ```

3. **Pass in navigation:**
   ```javascript
   router.push(`/next-page?companyHQId=${companyHQId}`);
   ```

4. **Add console logging:**
   ```javascript
   console.log('🏢 CompanyHQ from URL params:', { companyHQId });
   ```

### For Users

- URLs now include `?companyHQId=xxx` - this is normal and expected
- If you see a redirect, it's automatically adding the CompanyHQ to the URL
- You can bookmark URLs with CompanyHQ context included
- Browser back/forward buttons preserve CompanyHQ context

---

## Files Modified

1. `app/(authenticated)/contacts/enrich/linkedin/page.jsx`
   - Get `companyHQId` from URL params
   - Remove localStorage dependency
   - Add console logging
   - Pass `companyHQId` in navigation

2. `app/(authenticated)/contacts/view/page.jsx`
   - Get `companyHQId` from URL params
   - Remove localStorage event listeners
   - Add console logging
   - Pass `companyHQId` in navigation
   - Wrap in Suspense for useSearchParams

3. `app/(authenticated)/people/page.jsx`
   - Pass `companyHQId` when navigating to contacts/view

4. `app/(authenticated)/people/load/page.jsx`
   - Get `companyHQId` from URL params
   - Pass `companyHQId` when navigating to enrich/linkedin

5. `lib/services/contactService.ts`
   - Fix upsert to use `email_crmId` composite constraint
   - Ensure CompanyHQ-scoped contact lookups

---

## Testing Checklist

- [x] LinkedIn enrich page loads with `companyHQId` in URL
- [x] Contacts view page loads with `companyHQId` in URL
- [x] Console logs show correct CompanyHQ
- [x] Contact save uses correct CompanyHQ
- [x] Contacts fetch uses correct CompanyHQ
- [x] Navigation preserves `companyHQId` in URLs
- [x] Fallback redirect works if `companyHQId` missing
- [x] Contact service uses CompanyHQ-scoped lookups

---

## Future Improvements

1. **CompanyHQ Selector Component**: Add dropdown to switch CompanyHQ (updates URL)
2. **URL Validation**: Validate `companyHQId` format and membership
3. **Error Handling**: Better error messages if CompanyHQ is invalid
4. **Breadcrumbs**: Show current CompanyHQ in breadcrumb navigation

---

## Summary

✅ **Removed**: localStorage state management for CompanyHQ  
✅ **Added**: URL parameter-based CompanyHQ context  
✅ **Fixed**: Contact service CompanyHQ-scoped lookups  
✅ **Added**: Comprehensive console logging  
✅ **Result**: Explicit, debuggable, shareable CompanyHQ context

