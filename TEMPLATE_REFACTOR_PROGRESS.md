# Template Refactor Progress

## ✅ Completed Refactoring

### API Routes
1. **`/app/api/artifacts/templates/route.js`**
   - ✅ Changed `companyHQId` → `ownerId`
   - ✅ Changed `name` → `title`
   - ✅ Removed `type`, `published`, `publishedAt`
   - ✅ Made `subject` and `body` required
   - ✅ Updated Prisma model: `template` → `templates`

2. **`/app/api/artifacts/templates/[id]/route.js`**
   - ✅ Updated GET to use `templates` model
   - ✅ Updated PATCH to use new schema (removed `type`, `published`)
   - ✅ Updated DELETE to use `templates` model

3. **`/app/api/template/generate-quick/route.js`**
   - ✅ Updated to use `extractVariableNames()` (returns string[])
   - ✅ Returns simple `variables` array instead of detailed objects

4. **`/app/api/template/generate-relationship-aware/route.js`**
   - ✅ Updated to use `extractVariableNames()` (returns string[])
   - ✅ Returns simple `variables` array instead of detailed objects

5. **`/app/api/template-relationship-helpers/route.js`** (NEW)
   - ✅ Created new route for TemplateRelationshipHelper CRUD
   - ✅ POST: Create helper
   - ✅ GET: List helpers by ownerId

### UI Pages
1. **`/app/(authenticated)/builder/template/[templateId]/page.jsx`**
   - ✅ Changed `name` → `title`
   - ✅ Removed `type` field
   - ✅ Removed `published` checkbox
   - ✅ Updated API calls to use `ownerId` instead of `companyHQId`
   - ✅ Made `subject` and `body` required

### Utilities
1. **`/lib/templateVariables.js`**
   - ✅ Added `extractVariableNames()` function (returns string[])
   - ✅ Kept `extractVariables()` for backward compatibility (returns detailed objects)

---

## ⏳ Still Needs Refactoring

### API Routes (Legacy - Can be deleted or refactored)
1. **`/app/api/template/save/route.js`**
   - ❌ Uses `template_bases` and `outreach_templates`
   - **Action:** DELETE (functionality moved to `/api/artifacts/templates`)

2. **`/app/api/template/saved/route.js`**
   - ❌ Uses `outreach_templates` with joins
   - **Action:** DELETE (use `/api/artifacts/templates` instead)

3. **`/app/api/template/hydrate-with-contact/route.js`**
   - ❌ Uses `outreach_templates` and `template_bases`
   - **Action:** REFACTOR or DELETE (hydration should be in services/resolvers)

4. **`/app/api/template/hydrate/route.js`**
   - ❌ Uses `template_bases`
   - **Action:** REFACTOR or DELETE

5. **`/app/api/template/build/route.js`**
   - ❌ Uses `template_bases`
   - **Action:** REFACTOR to create `TemplateRelationshipHelper` instead

6. **`/app/api/template/parse/route.js`**
   - ✅ Keep parsing logic
   - ⚠️ Update return format to match `TemplateRelationshipHelper` fields

### UI Pages (Need Review)
1. **`/app/(authenticated)/template/build/ai/quick-idea/page.jsx`**
   - ⚠️ Review and ensure it uses new models

2. **`/app/(authenticated)/template/build/ai/relationship-helper/page.jsx`**
   - ⚠️ Review and ensure it creates `TemplateRelationshipHelper` then `Template`

3. **`/app/(authenticated)/template/build/manual/page.jsx`**
   - ⚠️ Review and ensure it creates `Template` directly

---

## 📋 Next Steps

### Phase 1: Complete Core Refactoring
1. ✅ Refactor `/api/artifacts/templates` routes (DONE)
2. ✅ Refactor `/api/template/generate-*` routes (DONE)
3. ✅ Create `/api/template-relationship-helpers` route (DONE)
4. ⏳ Review and update other template builder UI pages
5. ⏳ Delete or refactor legacy routes (`/api/template/save`, `/api/template/saved`, etc.)

### Phase 2: Copy to Sandbox
1. ⏳ Copy all refactored files to sandbox
2. ⏳ Update sandbox API routes to match
3. ⏳ Test in sandbox environment

### Phase 3: Cleanup
1. ⏳ Remove all references to `template_bases`, `outreach_templates`, `template_variables`
2. ⏳ Update any remaining code that uses old schema
3. ⏳ Update documentation

---

## 🔑 Key Changes Summary

### Schema Changes
- `companyHQId` → `ownerId`
- `name` → `title`
- Removed: `type`, `published`, `publishedAt`
- `subject` and `body` are now required (not optional)
- Model name: `template` → `templates` (plural)

### New Model
- `TemplateRelationshipHelper` for relationship-aware flows
- Fields: `id`, `ownerId`, `relationshipType`, `familiarityLevel`, `whyReachingOut`, `desiredOutcome`, `timeHorizon`, `contextNotes`, `createdAt`

### Variable Extraction
- New: `extractVariableNames()` returns simple `string[]`
- Kept: `extractVariables()` returns detailed objects (for backward compatibility)

---

## 📝 Notes

- All refactored routes maintain backward compatibility where possible
- Legacy routes can be deleted once all UI pages are updated
- Hydration logic should eventually move to services/resolvers (not in API routes)
- Template generation routes don't persist anything - they just return generated content
- Persistence happens when user saves via `/api/artifacts/templates`

