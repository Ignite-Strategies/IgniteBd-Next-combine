# Template System Refactor Migration

## ⚠️ IMPORTANT: Review Before Applying

This migration refactors the template system to a simplified architecture.

## What This Migration Does

### Creates
- `template_relationship_helpers` table (new model for AI prompt input)

### Modifies
- `templates` table:
  - Removes: name, type, published, publishedAt, description, presenter, updatedAt, companyHQId
  - Adds: title, ownerId
  - Makes: subject and body required (not nullable)
  - Changes: companyHQId → ownerId

### Drops (Commented Out - Run After Data Migration)
- `template_variables` table
- `outreach_templates` table
- `template_bases` table
- `TemplateVariableType` enum

## Pre-Migration Checklist

- [ ] Backup database
- [ ] Review data migration script
- [ ] Test in staging environment
- [ ] Verify all template data is accessible
- [ ] Check for any code references to old models

## Data Migration Required

Before dropping old tables, you MUST:

1. **Migrate template_bases → template_relationship_helpers**
   - Copy relationship/form data to new table
   - Only for relationship helper templates

2. **Migrate outreach_templates → templates**
   - Extract `content` → `body`
   - Extract `template_bases.title` → `title`
   - Generate `subject` from content or use default
   - Map `templateBaseId` → find ownerId from template_bases

3. **Handle template_variables**
   - Variables are now just strings extracted from body
   - No metadata needed - drop this table

## Running the Migration

### Step 1: Review and Edit
```bash
# Edit migration.sql to uncomment drop statements when ready
nano prisma/migrations/20241226210000_refactor_template_system/migration.sql
```

### Step 2: Run Data Migration Script First
```bash
# Create and run data migration script
node scripts/migrate-template-data.js
```

### Step 3: Apply Schema Migration
```bash
npx prisma migrate deploy
# OR for dev:
npx prisma migrate dev
```

### Step 4: Verify
```bash
# Check tables exist
npx prisma studio
# Verify data integrity
```

## Rollback Plan

If issues occur:
1. Keep old tables during transition (they're commented out)
2. Can rollback by restoring from backup
3. Old code can still work if tables exist

## Safety Notes

- Migration is **non-destructive** (old tables kept until explicitly dropped)
- Data migration script should be tested separately
- Foreign keys are updated carefully
- Indexes are recreated for performance

