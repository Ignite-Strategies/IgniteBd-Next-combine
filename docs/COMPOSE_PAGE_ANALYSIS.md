# Compose Page Analysis

**Date**: January 2025  
**Page**: `/outreach/compose`  
**Issue**: Page stuck showing "Company Keys Missing" error

## Problem Summary

The compose page is not loading because it requires `companyHQId` as a URL parameter, but the outreach dashboard navigates to the compose page without passing this parameter.

## Root Cause

1. **Navigation Issue** (`app/(authenticated)/outreach/page.jsx:230`):
   ```javascript
   onClick={() => router.push('/outreach/compose')}
   ```
   - Missing `companyHQId` parameter in URL

2. **Compose Page Requirement** (`app/(authenticated)/outreach/compose/page.jsx:19`):
   ```javascript
   const companyHQId = searchParams?.get('companyHQId') || '';
   ```
   - Page expects `companyHQId` from URL params

3. **Error Display** (`app/(authenticated)/outreach/compose/page.jsx:402-404`):
   ```javascript
   if (missingCompanyKey) {
     return <CompanyKeyMissingError />;
   }
   ```
   - Shows error when `companyHQId` is missing

## Current Behavior

1. User clicks "Compose Email →" on outreach dashboard
2. Navigates to `/outreach/compose` (no `companyHQId` param)
3. Compose page checks for `companyHQId` in URL → not found
4. Shows `CompanyKeyMissingError` component:
   - "Company Keys Missing" message
   - "Return to Welcome" button
5. User cannot access compose functionality

## Console Errors

```
⚠️ Outreach Compose: No companyHQId in URL or localStorage
```

## Solution

### Option 1: Pass companyHQId from localStorage (Recommended)

Update the navigation in `outreach/page.jsx` to:
1. Read `companyHQId` from localStorage
2. Pass it as URL parameter when navigating to compose

### Option 2: Fallback to localStorage in Compose Page

Update `compose/page.jsx` to:
1. Check URL params first
2. Fallback to localStorage if not in URL
3. Redirect to URL with param if found in localStorage

### Option 3: Auto-redirect Pattern (Like contacts/view)

Similar to `contacts/view/page.jsx:41-49`, automatically redirect with `companyHQId` if found in localStorage.

## Recommended Fix

**Use Option 1 + Option 3 combination**:
- Update outreach dashboard to pass `companyHQId` when available
- Add fallback in compose page to read from localStorage and redirect if missing from URL

## Files to Modify

1. `app/(authenticated)/outreach/page.jsx` - Line 230
2. `app/(authenticated)/outreach/compose/page.jsx` - Lines 18-19, add fallback logic

## Related Patterns

Other pages that handle `companyHQId`:
- `contacts/view/page.jsx` - Auto-redirects if missing from URL but found in localStorage
- `contacts/ingest/microsoft/page.jsx` - Reads from localStorage directly

## Testing Checklist

- [ ] Navigate from outreach dashboard → compose (should work)
- [ ] Direct URL access with `companyHQId` param (should work)
- [ ] Direct URL access without param but with localStorage (should redirect)
- [ ] Direct URL access without param and without localStorage (should show error)

