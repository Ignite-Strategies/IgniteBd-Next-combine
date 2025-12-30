# CompanyHQ URL Scoping - Implementation Audit

**Date**: January 2025  
**Status**: ✅ Dashboard Complete | 🔄 Full Refactor In Progress  
**Purpose**: Audit all pages to assess ease of implementing companyHQ URL scoping pattern

---

## Overview

This document audits all pages in the application to determine how easy it would be to implement the companyHQ URL scoping pattern (using `?companyHQId=xxx` in URLs instead of localStorage).

**Pattern**: All pages that need CompanyHQ context should:
1. Get `companyHQId` from URL params using `useSearchParams()`
2. Redirect if missing (check localStorage, then redirect to `/people`)
3. Add console logging for debugging
4. Pass `companyHQId` in all navigation links
5. Wrap in `Suspense` for `useSearchParams()`

---

## Implementation Difficulty Levels

### ✅ **EASY** (1-2 hours per page)
- Simple pages using `useCompanyHQ()` hook
- Pages with minimal navigation
- Pages that already use `useSearchParams()` for other params

### 🟡 **MEDIUM** (2-4 hours per page)
- Pages with complex state management
- Pages with multiple navigation points
- Pages using `localStorage.getItem('companyHQId')` directly
- Pages with dynamic routes that need URL param preservation

### 🔴 **HARD** (4+ hours per page)
- Pages with deeply nested components passing companyHQId as props
- Pages with complex layouts that share companyHQId context
- Pages with server-side rendering that needs special handling

---

## Pages Already Implemented ✅

### 1. `/contacts/view` ✅
- **Status**: Complete
- **Pattern**: Uses `useSearchParams()` + redirect + Suspense
- **Reference**: `app/(authenticated)/contacts/view/page.jsx`

### 2. `/contacts/enrich/linkedin` ✅
- **Status**: Complete
- **Pattern**: Uses `useSearchParams()` + redirect + Suspense
- **Reference**: `app/(authenticated)/contacts/enrich/linkedin/page.jsx`

### 3. `/growth-dashboard` ✅
- **Status**: Complete (just implemented)
- **Pattern**: Uses `useSearchParams()` + redirect + Suspense
- **Reference**: `app/(authenticated)/growth-dashboard/page.jsx`

---

## Pages Needing Implementation

### 🟢 EASY - Direct `useCompanyHQ()` Hook Usage

These pages use `useCompanyHQ()` hook and can be easily converted:

#### 1. `/outreach/compose`
- **File**: `app/(authenticated)/outreach/compose/page.jsx`
- **Current**: `const { companyHQId } = useCompanyHQ();`
- **Effort**: ~30 minutes
- **Changes**:
  ```jsx
  // Replace:
  const { companyHQId } = useCompanyHQ();
  
  // With:
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  
  // Add redirect logic (copy from dashboard)
  // Wrap in Suspense
  ```

#### 2. `/outreach/campaigns/create`
- **File**: `app/(authenticated)/outreach/campaigns/create/page.jsx`
- **Current**: `const { companyHQId } = useCompanyHQ();`
- **Effort**: ~30 minutes

#### 3. `/outreach/campaigns/[campaignId]/edit`
- **File**: `app/(authenticated)/outreach/campaigns/[campaignId]/edit/page.jsx`
- **Current**: `const { companyHQId } = useCompanyHQ();`
- **Effort**: ~45 minutes (needs to preserve campaignId in URL)

#### 4. `/content/presentations/create`
- **File**: `app/(authenticated)/content/presentations/create/page.jsx`
- **Current**: `const { companyHQId, companyHQ, loading, refresh } = useCompanyHQ();`
- **Effort**: ~1 hour (has complex companyHQ resolution logic)

#### 5. `/personas/from-contact`
- **File**: `app/(authenticated)/personas/from-contact/page.jsx`
- **Current**: `const { companyHQId, loading, refresh } = useCompanyHQ();`
- **Effort**: ~45 minutes

#### 6. `/personas/contact-select`
- **File**: `app/(authenticated)/personas/contact-select/page.jsx`
- **Current**: `const { companyHQId, loading, refresh } = useCompanyHQ();`
- **Effort**: ~45 minutes

#### 7. `/contacts/list-builder/preview`
- **File**: `app/(authenticated)/contacts/list-builder/preview/page.jsx`
- **Current**: `const { companyHQId } = useCompanyHQ();`
- **Effort**: ~30 minutes

#### 8. `/products/builder`
- **File**: `app/(authenticated)/products/builder/page.jsx`
- **Current**: `const { companyHQId: derivedCompanyId, loading, refresh } = useCompanyHQ();`
- **Effort**: ~1 hour (has alias variable name)

#### 9. `/crmdashboard`
- **File**: `app/(authenticated)/crmdashboard/page.jsx`
- **Current**: `const { companyHQId, loading, hydrated } = useCompanyHQ();`
- **Effort**: ~1 hour

#### 10. `/contacts/companies`
- **File**: `app/(authenticated)/contacts/companies/page.jsx`
- **Current**: `const { companyHQId } = useCompanyHQ();`
- **Effort**: ~30 minutes

#### 11. `/pipelines`
- **File**: `app/(authenticated)/pipelines/page.jsx`
- **Current**: `const { companyHQId } = useCompanyHQ();`
- **Effort**: ~30 minutes

**Total Easy Pages**: 11 pages  
**Estimated Total Time**: ~8-10 hours

---

### 🟡 MEDIUM - Direct localStorage Usage

These pages read from localStorage directly and need more work:

#### 1. `/people`
- **File**: `app/(authenticated)/people/page.jsx`
- **Current**: `localStorage.getItem('companyHQId')`
- **Effort**: ~1.5 hours
- **Notes**: Has complex redirect logic for empty contacts

#### 2. `/people/load`
- **File**: `app/(authenticated)/people/load/page.jsx`
- **Current**: Likely uses localStorage
- **Effort**: ~1 hour
- **Notes**: Entry point - should get from URL or redirect

#### 3. `/products`
- **File**: `app/(authenticated)/products/page.jsx`
- **Current**: `localStorage.getItem('companyHQId')`
- **Effort**: ~1.5 hours
- **Notes**: Has TODO comment about tenant scoping

#### 4. `/personas`
- **File**: `app/(authenticated)/personas/page.jsx`
- **Current**: `localStorage.getItem('companyHQId')`
- **Effort**: ~1.5 hours
- **Notes**: Has TODO comment about tenant scoping, uses `useSearchParams()` already

#### 5. `/workpackages/view`
- **File**: `app/(authenticated)/workpackages/view/page.jsx`
- **Current**: `localStorage.getItem('companyHQId')`
- **Effort**: ~1 hour
- **Notes**: Uses `useCompanyHydration` hook

#### 6. `/content/presentations`
- **File**: `app/(authenticated)/content/presentations/page.jsx`
- **Current**: `localStorage.getItem('companyHQId')`
- **Effort**: ~1.5 hours
- **Notes**: Has local-first flag and complex sync logic

#### 7. `/content/blog`
- **File**: `app/(authenticated)/content/blog/page.tsx`
- **Current**: `localStorage.getItem('companyHQId')` (multiple places)
- **Effort**: ~2 hours
- **Notes**: TypeScript file, multiple localStorage reads

#### 8. `/content/blog/[id]`
- **File**: `app/(authenticated)/content/blog/[id]/page.tsx`
- **Current**: `localStorage.getItem('companyHQId')`
- **Effort**: ~1.5 hours
- **Notes**: Dynamic route, needs to preserve blog ID

#### 9. `/content/blog/[id]/edit`
- **File**: `app/(authenticated)/content/blog/[id]/edit/page.tsx`
- **Current**: `localStorage.getItem('companyHQId')` (multiple places)
- **Effort**: ~2 hours
- **Notes**: Complex edit page with multiple localStorage reads

#### 10. `/content/blog/build/*`
- **Files**: Multiple build pages
- **Current**: `localStorage.getItem('companyHQId')`
- **Effort**: ~1 hour each (4-5 pages)
- **Notes**: Build flow pages

#### 11. `/events/*`
- **Files**: Multiple event pages (TypeScript)
- **Current**: `localStorage.getItem('companyHQId')`
- **Effort**: ~1 hour each (10+ pages)
- **Notes**: Event planning flow

#### 12. `/contacts/manual`
- **File**: `app/(authenticated)/contacts/manual/page.jsx`
- **Current**: `localStorage.getItem('companyHQId')`
- **Effort**: ~1 hour

#### 13. `/contacts/upload`
- **File**: `app/(authenticated)/contacts/upload/page.jsx`
- **Current**: `localStorage.getItem('companyHQId')`
- **Effort**: ~1 hour

#### 14. `/contacts/ingest/microsoft`
- **File**: `app/(authenticated)/contacts/ingest/microsoft/page.jsx`
- **Current**: `localStorage.getItem('companyHQId')`
- **Effort**: ~1 hour

#### 15. `/contacts/[contactId]/prep`
- **File**: `app/(authenticated)/contacts/[contactId]/prep/page.jsx`
- **Current**: `localStorage.getItem('companyHQId')`
- **Effort**: ~1.5 hours
- **Notes**: Dynamic route, needs to preserve contactId

#### 16. `/meetings`
- **File**: `app/(authenticated)/meetings/page.jsx`
- **Current**: `localStorage.getItem('companyHQId')`
- **Effort**: ~1 hour

#### 17. `/personas/builder`
- **File**: `app/(authenticated)/personas/builder/page.jsx`
- **Current**: `localStorage.getItem('companyHQId')`
- **Effort**: ~1.5 hours

#### 18. `/personas/build-from-contacts`
- **File**: `app/(authenticated)/personas/build-from-contacts/page.jsx`
- **Current**: `localStorage.getItem('companyHQId')`
- **Effort**: ~1 hour

#### 19. `/assessment`
- **File**: `app/(authenticated)/assessment/page.jsx`
- **Current**: `localStorage.getItem('companyHQId')`
- **Effort**: ~1 hour

#### 20. `/templates/*`
- **Files**: Multiple template pages
- **Current**: `localStorage.getItem('companyHQId')`
- **Effort**: ~1 hour each (7+ pages)
- **Notes**: Template creation/editing flow

#### 21. `/builder/*`
- **Files**: Multiple builder pages
- **Current**: `localStorage.getItem('companyHQId')`
- **Effort**: ~1.5 hours each (5+ pages)
- **Notes**: Dynamic routes with IDs

**Total Medium Pages**: ~50+ pages  
**Estimated Total Time**: ~60-80 hours

---

### 🔴 HARD - Layout Files & Complex Context

These require more architectural changes:

#### 1. `/contacts/layout.jsx`
- **File**: `app/(authenticated)/contacts/layout.jsx`
- **Current**: Uses `useCompanyHQ()` hook
- **Effort**: ~2-3 hours
- **Notes**: Layout file - affects all child routes. May need to pass context down or use URL params in each child.

#### 2. `/people/layout.jsx`
- **File**: `app/(authenticated)/people/layout.jsx`
- **Current**: Uses `useCompanyHQ()` hook
- **Effort**: ~2-3 hours
- **Notes**: Layout file - affects all child routes

**Total Hard Pages**: 2 layout files  
**Estimated Total Time**: ~4-6 hours

---

## Implementation Template

### Standard Pattern (Copy-Paste Ready)

```jsx
'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
// ... other imports

function YourPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  
  // Redirect if no companyHQId in URL
  useEffect(() => {
    if (!companyHQId && typeof window !== 'undefined') {
      const stored = localStorage.getItem('companyHQId');
      if (stored) {
        router.replace(`/your-page?companyHQId=${stored}`);
      } else {
        router.push('/people');
      }
    }
  }, [companyHQId, router]);

  // Log CompanyHQ from URL params
  useEffect(() => {
    if (companyHQId) {
      console.log('🏢 CompanyHQ from URL params:', {
        companyHQId,
        timestamp: new Date().toISOString(),
      });
    }
  }, [companyHQId]);

  // ... rest of your component logic
  
  // Update all navigation to include companyHQId:
  // router.push(companyHQId ? `/next-page?companyHQId=${companyHQId}` : '/next-page');
}

export default function YourPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <YourPageContent />
    </Suspense>
  );
}
```

---

## Navigation Updates Required

After implementing URL scoping, update all navigation links to include `companyHQId`:

### Pattern:
```jsx
// Before:
router.push('/contacts/view');

// After:
router.push(companyHQId ? `/contacts/view?companyHQId=${companyHQId}` : '/contacts/view');
```

### Common Navigation Points:
- Sidebar navigation
- Action buttons
- Breadcrumbs
- Form submissions
- Modal redirects
- Success page redirects

---

## Priority Recommendations

### Phase 1: High-Impact Pages (Week 1)
1. ✅ `/growth-dashboard` - **DONE**
2. `/people` - Entry point for contacts
3. `/people/load` - Contact loading entry point
4. `/outreach/compose` - Core outreach functionality
5. `/contacts/view` - **ALREADY DONE**

### Phase 2: Core Features (Week 2)
6. `/outreach/campaigns/*` - Campaign management
7. `/personas/*` - Persona management
8. `/products/*` - Product management
9. `/templates/*` - Template management

### Phase 3: Content & Events (Week 3)
10. `/content/*` - Blog, presentations
11. `/events/*` - Event planning
12. `/builder/*` - Builder pages

### Phase 4: Remaining Pages (Week 4)
13. All remaining pages
14. Layout files
15. Cleanup and testing

---

## Testing Checklist

For each page implemented:

- [ ] Page loads with `?companyHQId=xxx` in URL
- [ ] Page redirects if `companyHQId` missing (checks localStorage, then `/people`)
- [ ] Console log shows CompanyHQ from URL params
- [ ] All navigation links include `companyHQId`
- [ ] API calls use correct `companyHQId`
- [ ] Browser back/forward buttons work correctly
- [ ] URL can be bookmarked and shared
- [ ] No localStorage dependency for companyHQId

---

## Estimated Total Effort

- **Easy Pages**: 11 pages × ~45 min = **~8-10 hours**
- **Medium Pages**: ~50 pages × ~1.5 hours = **~60-80 hours**
- **Hard Pages**: 2 layouts × ~3 hours = **~4-6 hours**
- **Testing & Cleanup**: **~10-15 hours**

**Total Estimated Time**: **~80-110 hours** (2-3 weeks for 1 developer)

---

## Benefits of Full Implementation

1. ✅ **Explicit Context**: Every page shows which CompanyHQ you're working with
2. ✅ **No State Sync Issues**: URL is single source of truth
3. ✅ **Easy Debugging**: Console logs show CompanyHQ from URL
4. ✅ **Shareable Links**: URLs can be shared with CompanyHQ context
5. ✅ **Browser History**: Back/forward buttons work correctly
6. ✅ **No Cross-Tab Issues**: Each tab has its own URL context
7. ✅ **Better UX**: Users can bookmark specific company contexts

---

## Migration Strategy

### Option 1: Big Bang (Recommended for Small Team)
- Implement all pages in one sprint
- Test thoroughly before release
- **Pros**: Consistent experience, no partial states
- **Cons**: Large PR, higher risk

### Option 2: Phased Rollout (Recommended for Large Codebase)
- Implement by feature area (contacts, outreach, content, etc.)
- Each phase is independently testable
- **Pros**: Lower risk, easier to review
- **Cons**: Temporary inconsistency during migration

### Option 3: Page-by-Page (Not Recommended)
- Implement as pages are touched
- **Pros**: Low risk per change
- **Cons**: Long migration period, inconsistent UX

---

## Notes

- All pages should maintain backward compatibility during migration (check localStorage if URL param missing)
- Consider creating a shared hook `useCompanyHQFromURL()` to reduce duplication
- Update all navigation components to automatically include `companyHQId` when available
- Consider middleware to automatically add `companyHQId` to authenticated routes if missing

---

## Summary

**Total Pages to Convert**: ~65+ pages  
**Implementation Difficulty**: Mostly Easy to Medium  
**Estimated Time**: 2-3 weeks for full implementation  
**Pattern**: Well-established and documented  
**Risk**: Low (backward compatible with localStorage fallback)

The pattern is straightforward and well-documented. The main effort is:
1. Finding all pages (✅ Done - this audit)
2. Applying the pattern (copy-paste + customize)
3. Updating navigation links
4. Testing

Most pages can be converted in 30 minutes to 2 hours each.

