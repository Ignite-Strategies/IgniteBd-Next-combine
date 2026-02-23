# Snippet Refactor: Independent Building Blocks

## Summary

Snippets are now **independent building blocks** - they no longer have a relationship context FK. Instead, relationship context drives **how snippets are assembled** via a new assembly service.

## Changes

### 1. Schema Changes
- **Removed:** `relationshipContextId` FK from `content_snips`
- **Added:** `bestForPersonaType PersonaType?` (optional hint)
- **Kept:** `relationship_contexts` table (used by assembly service, not stored on snippets)

### 2. Architecture

**Before:**
- Snippets had a FK to relationship contexts
- Each snippet was tied to a specific relationship context
- Hard to reuse snippets across contexts

**After:**
- Snippets are independent building blocks
- Optional `bestForPersonaType` hint (DECISION_MAKER, INFLUENCER, etc.)
- Assembly service uses relationship context to select/order snippets
- Maximum reusability

### 3. Assembly Service

New service: `lib/services/snippetAssemblyService.js`

**Purpose:** Relationship-aware snippet selection and ordering

**Input:**
- Relationship context (contextOfRelationship, relationshipRecency, companyAwareness)
- Persona type (optional)
- Available snippets

**Output:**
- Ordered list of snippets for template
- Reasoning for selection

**Logic:**
- Filters snippets by type (subject, opening, cta, etc.)
- Considers `bestForPersonaType` if provided
- Uses relationship context to select best matches
- Orders logically (opening → context → value → ask → close)

### 4. Updated Files

**Schema:**
- `prisma/schema.prisma` - Removed FK, added persona type
- `prisma/migrations/20260223150000_remove_relationship_context_from_snippets/migration.sql`

**API:**
- `app/api/outreach/content-snips/route.js` - Uses `bestForPersonaType`
- `app/api/outreach/content-snips/[id]/route.js` - Uses `bestForPersonaType`
- `app/api/outreach/content-snips/csv/route.js` - CSV column changed
- `app/api/outreach/content-snips/hydrate/route.js` - Returns persona type
- `app/api/template/generate-with-snippets/route.js` - Updated field references

**UI:**
- `app/(authenticated)/content-snips/page.jsx` - Persona type dropdown instead of relationship context

**New:**
- `lib/services/snippetAssemblyService.js` - Assembly service
- `docs/SNIPPET_ASSEMBLY_ARCHITECTURE.md` - Architecture docs

## Migration Notes

1. **Data Migration:** Existing `relationshipContextId` values are dropped (snippets become general-purpose)
2. **CSV Format:** Column changed from `relationship_context_id` to `best_for_persona_type`
3. **API Changes:** All endpoints now use `bestForPersonaType` instead of `relationshipContextId`

## Next Steps

1. **Use Assembly Service:** Update template builders to use `assembleSnippetsForTemplate()` when relationship context is known
2. **Persona Hints:** Optionally set `bestForPersonaType` on snippets to help assembly service
3. **AI Builder:** Can continue using snippets independently (no relationship context needed)

## Benefits

✅ **Maximum Reusability:** Snippets work for any relationship context  
✅ **Flexible Assembly:** Relationship context drives selection, not storage  
✅ **Simple Model:** Snippets are just building blocks  
✅ **Persona Hints:** Optional guidance without hard coupling  
