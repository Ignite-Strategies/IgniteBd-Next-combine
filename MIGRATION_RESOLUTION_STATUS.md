# Migration Resolution Status

## ✅ Completed

1. **Schema Updated**: Updated `prisma/schema.prisma` to use `directUrl` for Neon pooler compatibility
2. **Migration Drift Resolved**: Fixed migration names in database that had placeholder names:
   - `20251215185134_update_buying_readiness_enum` → `20251215185134_add_buying_readiness_enum_values`
   - `$(date +%Y%m%d%H%M%S)_standardize_contact_model_to_singular` → `20251215192749_standardize_contact_model_to_singular`
   - `$(date +%Y%m%d%H%M%S)_add_uuid_default_to_contact_id` → `20251215205429_add_uuid_default_to_contact_id`
   - `$(date +%Y%m%d%H%M%S)_work_package_company_first_refactor` → `20251216153114_work_package_company_first_refactor`
   - `20251219082237_add_email_campaigns_tracking` → `20250130000000_add_email_campaigns_tracking`
3. **Duplicate Migration Removed**: Removed `20241226210000_refactor_template_system` (kept `20251226210000_refactor_template_system`)

## ⚠️ Pending

**Template Refactor Migration**: `20251226210000_refactor_template_system` is ready but cannot be applied due to:
- Advisory lock timeout (P1002 error)
- This suggests another connection may be holding a lock, or the database is under load

## 🔧 Next Steps

### Option 1: Retry Migration (Recommended)
Wait a few minutes and retry:
```bash
export DIRECT_DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
npx prisma migrate deploy
```

### Option 2: Manual SQL Application
If advisory locks continue to fail, you can apply the migration SQL directly:
```bash
# Read the migration SQL
cat prisma/migrations/20251226210000_refactor_template_system/migration.sql

# Apply via psql (if you have direct access)
psql $DIRECT_DATABASE_URL -f prisma/migrations/20251226210000_refactor_template_system/migration.sql

# Then mark as applied
npx prisma migrate resolve --applied 20251226210000_refactor_template_system
```

### Option 3: Check for Active Connections
Check if there are active connections holding locks:
```sql
SELECT * FROM pg_locks WHERE locktype = 'advisory';
SELECT * FROM pg_stat_activity WHERE state = 'active';
```

## 📝 Migration Details

The `20251226210000_refactor_template_system` migration:
- Creates `template_relationship_helpers` table
- Refactors `templates` table (removes old columns, adds new structure)
- Drops old tables (commented out for safety - uncomment after data migration)
- Updates foreign keys

**Important**: The migration includes commented-out DROP statements for old tables. Review and uncomment these only after confirming data migration is complete.

## 🔗 Related Files

- `prisma/schema.prisma` - Updated schema with `directUrl` support
- `scripts/resolve-migration-drift.js` - Script used to fix migration drift
- `prisma/migrations/20251226210000_refactor_template_system/migration.sql` - Migration SQL

