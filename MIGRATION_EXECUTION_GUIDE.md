# Template System Migration - Execution Guide

## ✅ Migration Files Created

1. **Schema Migration**: `prisma/migrations/20251226210000_refactor_template_system/migration.sql`
2. **Data Migration Script**: `scripts/migrate-template-data.js`
3. **Documentation**: `prisma/migrations/20251226210000_refactor_template_system/README.md`

## 🚨 CRITICAL: Execution Order

### Phase 1: Data Migration (Run First)

```bash
cd IgniteBd-Next-combine

# 1. Backup database first!
# (Use your backup tool or pg_dump)

# 2. Run data migration script
node scripts/migrate-template-data.js
```

**What it does:**
- Migrates `template_bases` → `template_relationship_helpers`
- Migrates `outreach_templates.content` → `templates.body`
- Updates existing `templates` to new structure
- Preserves all data

### Phase 2: Schema Migration (Run After Data Migration)

```bash
# 3. Review migration SQL
cat prisma/migrations/20251226210000_refactor_template_system/migration.sql

# 4. Apply migration
npx prisma migrate deploy
# OR for dev environment:
npx prisma migrate dev
```

**What it does:**
- Creates `template_relationship_helpers` table
- Refactors `templates` table structure
- Updates foreign keys
- **Does NOT drop old tables** (commented out for safety)

### Phase 3: Cleanup (After Verification)

Once you've verified everything works:

1. Uncomment drop statements in migration.sql:
   ```sql
   -- Uncomment these lines:
   DROP TABLE IF EXISTS "template_variables";
   DROP TABLE IF EXISTS "outreach_templates";
   DROP TABLE IF EXISTS "template_bases";
   DROP TYPE IF EXISTS "TemplateVariableType";
   ```

2. Run cleanup migration:
   ```bash
   npx prisma migrate dev --name cleanup_old_template_tables
   ```

## 📋 Pre-Migration Checklist

- [ ] Database backup created
- [ ] Staging environment tested
- [ ] Data migration script reviewed
- [ ] Schema migration SQL reviewed
- [ ] All code references to old models identified
- [ ] Rollback plan documented

## 🔍 Verification Steps

After migration:

```bash
# 1. Check tables exist
npx prisma studio
# Verify: templates, template_relationship_helpers exist
# Verify: template_bases, outreach_templates still exist (until cleanup)

# 2. Check data integrity
node scripts/verify-template-migration.js  # (create this if needed)

# 3. Test application
# - Create template via IDEA flow
# - Create template via RELATIONSHIP_HELPER flow
# - Create template via MANUAL flow
# - Verify campaigns can reference templates
```

## ⚠️ Safety Features

1. **Non-destructive**: Old tables kept until explicitly dropped
2. **Reversible**: Can restore from backup if needed
3. **Incremental**: Data migration separate from schema migration
4. **Reviewable**: All SQL is visible before execution

## 🐛 Troubleshooting

### If data migration fails:
- Check Prisma client is up to date: `npx prisma generate`
- Verify database connection
- Check for data type mismatches

### If schema migration fails:
- Check foreign key constraints
- Verify indexes don't conflict
- Ensure all required columns have data

### Rollback:
```bash
# Restore from backup
# OR manually revert schema changes
# OR keep old tables and update code to use both
```

## 📝 Notes

- Migration preserves all existing template data
- Campaigns will continue to work (foreign key updated)
- Old code may break - update all references to new models
- Test thoroughly before production deployment

