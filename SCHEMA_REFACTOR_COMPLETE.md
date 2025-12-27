# Template System Schema Refactor - COMPLETE

## Changes Made

### ✅ Removed Models
- `template_bases` - DELETED
- `outreach_templates` - DELETED  
- `template_variables` - DELETED
- `TemplateVariableType` enum - DELETED

### ✅ Refactored Models

#### `templates` (Simplified)
**Before:**
- Had: name, subject?, body?, type?, published, publishedAt, description, presenter, updatedAt
- Complex with many optional fields and booleans

**After:**
```prisma
model templates {
  id        String   @id @default(uuid())
  ownerId   String
  title     String
  subject   String
  body      String
  createdAt DateTime @default(now())
  company_hqs company_hqs @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  campaigns campaigns[]

  @@index([ownerId])
}
```

**Rules Applied:**
- ✅ NO variables
- ✅ NO enums
- ✅ NO booleans
- ✅ NO states
- ✅ NO inferred data
- ✅ NO source tracking
- ✅ NO signOff field (included in body)
- ✅ subject is required (not optional)
- ✅ body is required (not optional)

### ✅ New Model

#### `template_relationship_helpers` (New)
```prisma
model template_relationship_helpers {
  id               String      @id @default(uuid())
  ownerId          String
  relationshipType String   // e.g. "FORMER_COWORKER", "FRIEND", "PROSPECT"
  familiarityLevel String   // e.g. "COLD", "WARM", "ESTABLISHED"
  whyReachingOut   String
  desiredOutcome   String?
  timeHorizon      String?
  contextNotes     String?
  createdAt        DateTime    @default(now())
  company_hqs      company_hqs @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  @@index([ownerId])
  @@index([createdAt])
}
```

**Rules Applied:**
- ✅ Stored durably (DB)
- ✅ NEVER contains generated text
- ✅ NEVER linked directly to contacts
- ✅ NEVER sent to end recipients
- ✅ Used ONLY as structured AI prompt input

### ✅ Updated Relations

1. **campaigns** model:
   - Changed: `outreach_template` → `template`
   - Changed: `outreach_templates?` → `templates?`

2. **company_hqs** model:
   - Removed: `template_bases` relation
   - Added: `template_relationship_helpers` relation
   - Kept: `templates` relation (updated)

### ✅ Schema Validation

- ✅ Schema formatted successfully
- ✅ Schema validated successfully  
- ✅ Prisma Client generated successfully

## Next Steps

### 1. Create Migration (SAFELY)

```bash
cd IgniteBd-Next-combine
npx prisma migrate dev --name refactor_template_system --create-only
```

**Review the migration SQL before applying!**

### 2. Data Migration Script

Create a script to migrate existing data:
- `template_bases` → `template_relationship_helpers` (for relationship helper data)
- `outreach_templates.content` → `templates.body`
- Extract `title` from `template_bases.title` or generate from content
- Extract `subject` from campaigns or generate default

### 3. Update Code

- Update all API routes
- Update services
- Remove references to old models
- Update TypeScript types

### 4. Test

- Test template creation (all 3 flows)
- Test template retrieval
- Test campaigns with templates
- Verify data integrity

## Safety Notes

⚠️ **DO NOT RUN MIGRATE YET** - Review migration SQL first
⚠️ **Backup database** before applying migration
⚠️ **Test in staging** before production
⚠️ **Old models will be dropped** - ensure data migration is complete

## Enums Status

The following enums are still in schema but may not be used:
- `RelationshipEnum` - May be used elsewhere, check before removing
- `TypeOfPersonEnum` - May be used elsewhere, check before removing

These can be removed if not used elsewhere in the codebase.

