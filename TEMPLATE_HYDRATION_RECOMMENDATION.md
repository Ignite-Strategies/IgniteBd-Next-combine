# Template Hydration Recommendation - Use ownerId Pattern

## Current Situation

### ✅ What We Have:
- Templates are stored with `ownerId` (required field)
- Templates are NOT stored with `companyHQId` (optional field)
- Basic save/create works correctly

### ❌ Current Hydration Issue:
- `/api/company/hydrate` fetches templates by `companyHQId` (line 214-217)
- This won't work correctly because templates are associated with `ownerId`, not `companyHQId`
- Blogs/presentations use `companyHQId` because they're company-scoped
- Templates should use `ownerId` because they're owner-scoped

## Recommendation: Use localStorage Pattern with ownerId

Follow the same localStorage-first pattern as blogs, but hydrate by **ownerId** instead of companyHQId.

### Pattern from Blogs (for reference):

**Blogs use `companyHQId`:**
```javascript
// localStorage keys:
- `blogs_${companyHQId}`
- `companyHydration_${companyHQId}` (contains all company data)

// Load pattern:
1. Try `blogs_${companyHQId}` 
2. Try `companyHydration_${companyHQId}.data.blogs`
3. Fallback to API

// Hydration endpoint:
GET /api/company/hydrate?companyHQId=${companyHQId}
// Returns all company data including blogs
```

### Templates Should Use `ownerId`:

**Templates use `ownerId`:**
```javascript
// localStorage keys:
- `templates_${ownerId}` (direct key for templates)
- `ownerHydration_${ownerId}` (contains all owner data - if we create this)

// Load pattern:
1. Try `templates_${ownerId}` 
2. Try `ownerHydration_${ownerId}.data.templates` (if owner hydration exists)
3. Fallback to API

// Hydration endpoint:
GET /api/templates?ownerId=${ownerId} (already exists!)
// Or create: GET /api/owner/hydrate?ownerId=${ownerId}
```

## Implementation Options

### Option 1: Simple - Use Existing API with localStorage Cache

**Update `/app/(authenticated)/templates/library-email/page.jsx`:**

1. **Load from localStorage on mount:**
   ```javascript
   useEffect(() => {
     if (!ownerId) return;
     
     // Try localStorage first
     const cached = localStorage.getItem(`templates_${ownerId}`);
     if (cached) {
       const templates = JSON.parse(cached);
       setTemplates(templates);
       return;
     }
     
     // Fallback to API
     loadTemplatesFromAPI();
   }, [ownerId]);
   ```

2. **Save to localStorage after API fetch:**
   ```javascript
   const loadTemplates = async () => {
     const response = await api.get(`/api/templates?ownerId=${ownerId}`);
     if (response.data?.success) {
       const templates = response.data.templates || [];
       setTemplates(templates);
       // Cache in localStorage
       localStorage.setItem(`templates_${ownerId}`, JSON.stringify(templates));
     }
   };
   ```

3. **Update localStorage on create/update/delete:**
   - After creating template: add to array, save to localStorage
   - After updating template: update in array, save to localStorage
   - After deleting template: remove from array, save to localStorage

### Option 2: Create Owner Hydration Endpoint (Like Company Hydration)

**Create `/api/owner/hydrate/route.js`:**

Similar to `/api/company/hydrate`, but fetches owner-scoped data:
- Templates (by ownerId)
- Other owner-scoped data (if any)

Then templates would be stored in:
- `templates_${ownerId}` (direct key)
- `ownerHydration_${ownerId}` (comprehensive owner data)

## Recommendation: Start with Option 1

**Why Option 1 is better:**
- ✅ Simple - just use existing `/api/templates?ownerId=${ownerId}`
- ✅ No new endpoint needed
- ✅ Templates are the only owner-scoped content right now
- ✅ Can add owner hydration later if needed

**Implementation Steps:**

1. Update `templates/library-email/page.jsx` to load from localStorage
2. Cache templates in localStorage after API fetch
3. Update localStorage cache on create/update/delete operations
4. Create a hook `useTemplates` (like `useTemplates` for phase/deliverable templates) if needed

**localStorage Keys:**
- `templates_${ownerId}` - Direct cache of templates for this owner

## What to Remove from Company Hydration

**Remove from `/api/company/hydrate/route.js`:**
- Line 214-217: Template fetching by companyHQId (won't work correctly)
- Templates should NOT be in company hydration since they're owner-scoped

## Benefits

- ✅ No API calls on every page load
- ✅ Fast initial render from localStorage
- ✅ Templates correctly scoped to ownerId
- ✅ Consistent with blogs pattern, but adapted for ownerId
- ✅ Can still sync/refresh when needed

## Next Steps

1. Update template library page to use localStorage pattern
2. Remove templates from company hydration endpoint
3. Optionally create `useTemplates` hook for email templates (similar to phase/deliverable templates hook)

