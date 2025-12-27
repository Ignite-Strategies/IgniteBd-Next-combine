# Template System Refactor Audit

## Overview
This document audits all template-related code in `IgniteBd-Next-combine` that needs to be refactored to use the new simplified models:
- `Template` (id, ownerId, title, subject, body, createdAt)
- `TemplateRelationshipHelper` (id, ownerId, relationshipType, familiarityLevel, whyReachingOut, desiredOutcome, timeHorizon, contextNotes, createdAt)

## Files Requiring Refactoring

### API Routes (Priority: HIGH)

#### 1. `/app/api/template/generate-quick/route.js`
**Current State:**
- Generates template from freeform idea
- Returns template content with inferred relationship data
- Does NOT persist anything

**Refactor Required:**
- ✅ Keep AI generation logic (no changes)
- ✅ Return template content + inferred data (no changes)
- ❌ **NEW**: When user saves, create `Template` directly (no feeder/helper)
- ❌ **REMOVE**: Any references to template_bases, outreach_templates

**Flow:** IDEA → AI generates → User saves → Create `Template` only

---

#### 2. `/app/api/template/generate-relationship-aware/route.js`
**Current State:**
- Takes structured relationship form data
- Generates template with relationship-aware logic
- Does NOT persist anything

**Refactor Required:**
- ✅ Keep AI generation logic (no changes)
- ❌ **NEW**: When user saves, create `TemplateRelationshipHelper` first, then `Template`
- ❌ **REMOVE**: Any references to template_bases, outreach_templates

**Flow:** FORM → Create `TemplateRelationshipHelper` → AI generates → Create `Template`

---

#### 3. `/app/api/artifacts/templates/route.js`
**Current State:**
- Uses old schema: `companyHQId`, `name`, `type`, `published`, `publishedAt`
- Creates/reads templates

**Refactor Required:**
- ❌ Change `companyHQId` → `ownerId`
- ❌ Change `name` → `title`
- ❌ Remove `type`, `published`, `publishedAt`
- ❌ Make `subject` and `body` required (not optional)
- ✅ Keep `createdAt` (no changes)

**New Schema:**
```javascript
{
  ownerId: string,    // was companyHQId
  title: string,      // was name
  subject: string,    // was optional, now required
  body: string,       // was optional, now required
  createdAt: DateTime // unchanged
}
```

---

#### 4. `/app/api/artifacts/templates/[id]/route.js`
**Current State:**
- GET: Reads template by ID
- PATCH: Updates template (name, subject, body, type, published)
- DELETE: Deletes template

**Refactor Required:**
- ❌ Update GET to use new schema fields
- ❌ Update PATCH to use new schema (remove type, published)
- ✅ DELETE can stay the same

---

#### 5. `/app/api/template/save/route.js`
**Current State:**
- Uses `template_bases` and `outreach_templates`
- Creates both `templates` and `outreach_templates` records

**Refactor Required:**
- ❌ **DELETE** this route entirely (functionality moved to `/api/artifacts/templates`)
- OR refactor to use new models only

**Decision:** DELETE - functionality is redundant with `/api/artifacts/templates`

---

#### 6. `/app/api/template/saved/route.js`
**Current State:**
- Uses `outreach_templates` with joins to `template_bases` and `template_variables`
- Returns complex nested structure

**Refactor Required:**
- ❌ **DELETE** this route entirely
- OR refactor to return simple `Template` list

**Decision:** DELETE - use `/api/artifacts/templates` instead

---

#### 7. `/app/api/template/hydrate-with-contact/route.js`
**Current State:**
- Uses `outreach_templates` with joins
- Hydrates template with contact data

**Refactor Required:**
- ❌ Change to read from `templates` table
- ✅ Keep hydration logic (but move to service/resolver)
- ❌ Remove references to template_bases, template_variables

**Note:** Hydration should live in services/resolvers, not API routes

---

#### 8. `/app/api/template/hydrate/route.js`
**Current State:**
- Similar to hydrate-with-contact

**Refactor Required:**
- Same as #7

---

#### 9. `/app/api/template/build/route.js`
**Current State:**
- Unknown - needs review

**Refactor Required:**
- Review and refactor as needed

---

#### 10. `/app/api/template/parse/route.js`
**Current State:**
- Parses freeform idea into structured fields

**Refactor Required:**
- ✅ Keep parsing logic (no changes)
- ❌ Return format should match `TemplateRelationshipHelper` fields

---

### UI Pages (Priority: HIGH)

#### 1. `/app/(authenticated)/builder/template/[templateId]/page.jsx`
**Current State:**
- Uses old schema fields: `name`, `type`, `published`
- Loads from `/api/artifacts/templates/${templateId}`
- Saves to `/api/artifacts/templates`

**Refactor Required:**
- ❌ Change `name` → `title`
- ❌ Remove `type` field
- ❌ Remove `published` checkbox
- ✅ Keep `subject` and `body` fields
- ✅ Update API calls to use new field names

---

#### 2. `/app/(authenticated)/template/build/ai/quick-idea/page.jsx`
**Current State:**
- Unknown - needs review

**Refactor Required:**
- Review and ensure it uses new models

---

#### 3. `/app/(authenticated)/template/build/ai/relationship-helper/page.jsx`
**Current State:**
- Unknown - needs review

**Refactor Required:**
- Review and ensure it creates `TemplateRelationshipHelper` then `Template`

---

#### 4. `/app/(authenticated)/template/build/manual/page.jsx`
**Current State:**
- Unknown - needs review

**Refactor Required:**
- Review and ensure it creates `Template` directly

---

### Services/Utilities (Priority: MEDIUM)

#### 1. `/lib/templateVariables.js`
**Current State:**
- `extractVariables()` - extracts variable names from content ✅ KEEP
- `hydrateTemplate()` - replaces variables with contact data ❌ MOVE TO RESOLVERS
- `generateTemplateWithVariables()` - generates template from templateBase ❌ DELETE
- `calculateTimeSince()` - calculates time duration ✅ KEEP (move to resolvers)
- `validateHydration()` - checks for unfilled variables ✅ KEEP
- `getDefaultVariableValues()` - default values for preview ❌ MOVE TO RESOLVERS

**Refactor Required:**
- ✅ Keep `extractVariables()` (rename to `extractVariableNames()` - return string[])
- ❌ Remove `hydrateTemplate()` (move to resolvers)
- ❌ Remove `generateTemplateWithVariables()` (AI generates templates now)
- ✅ Keep `calculateTimeSince()` (move to resolvers)
- ✅ Keep `validateHydration()` (useful utility)
- ❌ Remove `getDefaultVariableValues()` (move to resolvers)

---

### Database Queries (Priority: HIGH)

**Files with Prisma queries using old models:**
1. `app/api/template/save/route.js` - Uses `template_bases`, `outreach_templates`
2. `app/api/template/saved/route.js` - Uses `outreach_templates`, `template_bases`, `template_variables`
3. `app/api/template/hydrate-with-contact/route.js` - Uses `outreach_templates`, `template_bases`, `template_variables`
4. `app/api/template/hydrate/route.js` - Likely uses old models
5. `app/api/artifacts/templates/route.js` - Uses `templates` but with old schema fields
6. `app/api/artifacts/templates/[id]/route.js` - Uses `templates` but with old schema fields

---

## Refactoring Plan

### Phase 1: Core API Routes
1. ✅ Refactor `/api/artifacts/templates/route.js` (POST, GET)
2. ✅ Refactor `/api/artifacts/templates/[id]/route.js` (GET, PATCH, DELETE)
3. ✅ Update `/api/template/generate-quick/route.js` (return format only, no DB changes)
4. ✅ Update `/api/template/generate-relationship-aware/route.js` (add helper creation)

### Phase 2: Remove Legacy Routes
1. ❌ Delete `/api/template/save/route.js`
2. ❌ Delete `/api/template/saved/route.js`
3. ❌ Delete or refactor `/api/template/hydrate-with-contact/route.js`
4. ❌ Delete or refactor `/api/template/hydrate/route.js`

### Phase 3: UI Updates
1. ✅ Refactor `/app/(authenticated)/builder/template/[templateId]/page.jsx`
2. ✅ Review and update other template builder pages

### Phase 4: Services/Utilities
1. ✅ Refactor `/lib/templateVariables.js`
2. ✅ Create variable resolvers (new file)

### Phase 5: Copy to Sandbox
1. ✅ Copy all refactored files to sandbox
2. ✅ Test in sandbox environment

---

## Key Principles

1. **Templates are dumb** - No variables, enums, booleans, states in the model
2. **Services are smart** - All intelligence in services/resolvers
3. **IDEA flow is ephemeral** - No feeder/helper persisted
4. **RELATIONSHIP HELPER flow is durable** - Helper persisted, then template
5. **MANUAL flow is simple** - Template only

---

## Migration Notes

- Old `templates` table has been refactored (columns changed)
- `template_bases`, `outreach_templates`, `template_variables` tables are DELETED
- All code must be updated to use new `templates` schema
- New `template_relationship_helpers` table for relationship-aware flows

