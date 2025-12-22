# Safe Migration Handler

This directory contains tools to safely create and manage Prisma migrations, preventing malformed migration names and ensuring consistency.

## 🚨 Problem

Malformed migration names occur when shell variables aren't expanded properly:
- ❌ `$(date +%Y%m%d%H%M%S)_migration_name` (literal string, not expanded)
- ✅ `20251222120000_migration_name` (proper timestamp)

## 🛠️ Tools

### 1. `create-migration.js` - Safe Migration Creator

**Always use this instead of `prisma migrate dev` directly!**

```bash
# Create a new migration
node scripts/create-migration.js "add_user_table"
node scripts/create-migration.js "update_contacts_schema"
```

**Features:**
- ✅ Generates proper timestamps (no shell variable expansion issues)
- ✅ Validates migration names (no special characters, shell variables)
- ✅ Prevents duplicate migrations
- ✅ Creates migration in `--create-only` mode (you edit SQL before applying)

**What it does:**
1. Validates the migration name
2. Generates a proper timestamp (YYYYMMDDHHMMSS)
3. Creates the migration directory with correct naming
4. Opens the migration.sql file for you to edit

### 2. `validate-migrations.js` - Migration Validator

**Run this before deploying migrations!**

```bash
node scripts/validate-migrations.js
```

**Checks for:**
- ❌ Malformed names (shell variables not expanded)
- ❌ Missing migration.sql files
- ❌ Duplicate migrations
- ❌ Invalid naming format

### 3. `resolve-migrations.js` - Migration Conflict Resolver

**Use when database has migrations that don't match local files.**

```bash
node scripts/resolve-migrations.js
```

**What it does:**
- Marks duplicate/malformed migrations in database as applied
- Resolves conflicts between database and local migrations
- Prepares database for new migrations

## 📋 Workflow

### Creating a New Migration

```bash
# 1. Create the migration (safe way)
node scripts/create-migration.js "add_new_feature"

# 2. Edit the migration SQL file
# File location: prisma/migrations/YYYYMMDDHHMMSS_add_new_feature/migration.sql

# 3. Validate before applying
node scripts/validate-migrations.js

# 4. Apply the migration
npx prisma migrate deploy
```

### Validating Existing Migrations

```bash
# Check all migrations for issues
node scripts/validate-migrations.js
```

### Resolving Migration Conflicts

If you see errors like:
```
The migrations from the database are not found locally in prisma/migrations:
$(date +%Y%m%d%H%M%S)_migration_name
```

```bash
# 1. Resolve conflicts
node scripts/resolve-migrations.js

# 2. Validate again
node scripts/validate-migrations.js

# 3. Apply pending migrations
npx prisma migrate deploy
```

## ⚠️ Common Issues

### Issue: Malformed Migration Names

**Symptom:**
```
Migration `$(date +%Y%m%d%H%M%S)_migration_name` failed
```

**Cause:**
- Shell variable `$(date...)` wasn't expanded
- Migration was created manually with unexpanded variables

**Fix:**
1. Delete the malformed migration directory locally
2. Mark it as resolved in database:
   ```bash
   npx prisma migrate resolve --applied "$(date +%Y%m%d%H%M%S)_migration_name"
   ```
3. Use `create-migration.js` for future migrations

### Issue: Duplicate Migrations

**Symptom:**
```
Duplicate migration: add_user_table
```

**Fix:**
- Keep the one with the correct timestamp
- Delete the duplicate
- If already in database, mark as resolved

### Issue: Missing migration.sql

**Symptom:**
```
Missing migration.sql file: 20251220094821_migration_name
```

**Fix:**
- If migration was already applied, create empty migration.sql
- Or delete the directory if migration was never applied

## 🎯 Best Practices

1. **Always use `create-migration.js`** - Never create migrations manually
2. **Validate before deploying** - Run `validate-migrations.js` first
3. **Review migration SQL** - Always check the generated SQL before applying
4. **Test locally first** - Apply migrations to local DB before production
5. **Keep migrations atomic** - One logical change per migration

## 📝 Example: Complete Workflow

```bash
# 1. Create migration
node scripts/create-migration.js "add_has_growth_access"

# 2. Edit the SQL file
# prisma/migrations/20251222120000_add_has_growth_access/migration.sql

# 3. Validate
node scripts/validate-migrations.js

# 4. Test locally
npx prisma migrate dev

# 5. Deploy to production
npx prisma migrate deploy
```

## 🔧 Troubleshooting

### Database Connection Issues

If you see connection errors:
```bash
# Check DATABASE_URL
echo $DATABASE_URL

# Or load from .env.local
export $(cat .env.local | xargs)
npx prisma migrate deploy
```

### Migration Already Applied

If migration shows as applied but you need to change it:
```bash
# Mark as rolled back
npx prisma migrate resolve --rolled-back migration_name

# Then apply again
npx prisma migrate deploy
```

---

**Remember:** Always use `create-migration.js` to prevent malformed migration names! 🛡️

