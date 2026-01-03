# Blogs Wiring Status

**Date:** 2025-01-27  
**Status:** Wiring exists but needs rewiring in builder page

---

## ✅ What's Wired Correctly

### 1. Database Model
- ✅ `blogs` table exists in schema
- ✅ Fields: `id`, `companyHQId`, `title`, `blogText`, `sections`, `subtitle`, `presenter`, `description`, `googleDocUrl`
- ⚠️ **Data Status:** 0 blogs in database (same as presentations - data was likely lost)

### 2. API Routes
- ✅ `POST /api/content/blog` - Create/upsert blog
- ✅ `GET /api/content/blog` - List blogs (with companyHQId filter)
- ✅ `GET /api/content/blog/[id]` - Get single blog
- ✅ `PATCH /api/content/blog/[id]` - Update blog
- ✅ `DELETE /api/content/blog/[id]` - Delete blog

### 3. Frontend Pages
- ✅ `/content/blog` - Blog listing page (uses localStorage-first approach)
- ✅ `/content/blog/[id]/edit` - Blog editor page
- ✅ `/content/blog/build/write` - Blog build/write page

### 4. Hydration
- ✅ `/api/company/hydrate` includes blogs
- ✅ Blogs are loaded into localStorage on company hydration
- ✅ Blogs are stored in `blogs_${companyHQId}` localStorage key

---

## ❌ What Needs Rewiring

### 1. Builder Page (`/builder/blog/[blogId]`)
**File:** `app/(authenticated)/builder/blog/[blogId]/page.jsx`

**Current State:**
- ❌ Still references old artifacts system (`/api/artifacts/blogs`)
- ❌ Load function is commented out with "Artifacts system removed"
- ❌ Save function is commented out with "Artifacts system removed"
- ❌ Shows alert: "Load functionality temporarily unavailable - artifacts system removed"

**Needs:**
- ✅ Rewire to use `/api/content/blog` routes
- ✅ Load blog from `/api/content/blog/[id]`
- ✅ Save blog to `/api/content/blog` (POST for new, PATCH for existing)
- ✅ Remove artifacts system references

**Reference Implementation:**
- See `/content/blog/[id]/edit/page.tsx` for correct implementation
- See `/builder/presentation/[presentationId]/page.jsx` for builder pattern

---

## 📊 Comparison: Blogs vs Presentations

| Feature | Blogs | Presentations | Status |
|---------|-------|---------------|--------|
| Database Model | ✅ `blogs` | ✅ `presentations` | Both exist |
| API Routes | ✅ `/api/content/blog` | ✅ `/api/content/presentations` | Both wired |
| Content Hub Page | ✅ `/content/blog` | ✅ `/content/presentations` | Both exist |
| Editor Page | ✅ `/content/blog/[id]/edit` | ✅ `/content/presentations/[id]` | Both exist |
| Builder Page | ❌ Needs rewiring | ✅ `/builder/presentation/[id]` | Blogs needs fix |
| Hydration | ✅ Included | ✅ Included | Both wired |
| Data in DB | 0 blogs | 0 presentations | Both empty |

---

## 🔧 Rewiring Tasks

### Priority 1: Fix Builder Page
1. Update `app/(authenticated)/builder/blog/[blogId]/page.jsx`:
   - Replace `/api/artifacts/blogs` with `/api/content/blog`
   - Implement load function using `GET /api/content/blog/[id]`
   - Implement save function using `POST /api/content/blog` or `PATCH /api/content/blog/[id]`
   - Remove artifacts system comments/alerts
   - Match field names to blog model (`blogText`, `sections`, etc.)

### Priority 2: Verify Data Flow
1. Test blog creation from builder
2. Test blog editing from builder
3. Test blog listing in content hub
4. Verify hydration includes blogs

### Priority 3: Check Other Content Types
- Landing pages
- Event plans
- Templates (if applicable)

---

## 💡 Key Differences from Old Artifacts System

### Old System (Removed)
- Routes: `/api/artifacts/blogs`
- Model: Artifact-based
- Storage: Mixed with work packages

### New System (Current)
- Routes: `/api/content/blog`
- Model: Standalone `blogs` table
- Storage: Content Hub only, linked via WorkCollateral when delivered

---

## 🎯 Next Steps

1. **Immediate:** Rewire builder page to use new API routes
2. **Verify:** Test end-to-end blog creation/editing flow
3. **Check:** Review other content types (landing pages, event plans) for similar issues
4. **Data:** Determine if blog data needs to be recovered from backups (like presentations)

---

## 📝 Notes

- Blogs wiring is **95% complete** - only builder page needs rewiring
- Data loss is same as presentations (likely deleted with artifacts system)
- Content Hub pages are fully functional
- API routes are fully functional
- Hydration is working correctly

