# Data Loss Prevention System

## Overview

This system prevents accidental data loss when running Prisma migrations. **NEVER** use `--accept-data-loss` without running safety checks first.

## Safety Scripts

### 1. `check-data-loss-safety.js`

**Purpose**: Checks for potential data loss before any migration

**Usage**:
```bash
node scripts/check-data-loss-safety.js
```

**What it checks**:
- Enum value mismatches (e.g., old enum values that would be lost)
- Required fields that are missing (e.g., template_bases without titles)
- Any other data integrity issues

**Exit codes**:
- `0` = Safe to proceed
- `1` = UNSAFE - Do not proceed

### 2. `safe-prisma-push.sh`

**Purpose**: Wrapper script that runs safety checks before `prisma db push`

**Usage**:
```bash
./scripts/safe-prisma-push.sh
# or with flags:
./scripts/safe-prisma-push.sh --accept-data-loss
```

**What it does**:
1. Runs `check-data-loss-safety.js`
2. Blocks migration if safety checks fail
3. Only proceeds if all checks pass
4. Requires explicit confirmation if `--accept-data-loss` is used

### 3. `prevent-data-loss.sh`

**Purpose**: Standalone safety check (can be used in CI/CD or pre-commit hooks)

**Usage**:
```bash
./scripts/prevent-data-loss.sh
```

## Workflow

### Before ANY Prisma Migration:

1. **Always run safety check first**:
   ```bash
   node scripts/check-data-loss-safety.js
   ```

2. **If checks pass**, you can proceed:
   ```bash
   npx prisma db push
   ```

3. **If checks fail**, fix the issues first:
   - Run appropriate migration scripts (e.g., `migrate-buying-readiness-safe.js`)
   - Re-run safety check
   - Only then proceed with schema changes

### Recommended: Use the Safe Wrapper

Instead of running `npx prisma db push` directly, use:
```bash
./scripts/safe-prisma-push.sh
```

This automatically runs safety checks and blocks unsafe migrations.

## Adding New Safety Checks

When adding new enum values or required fields:

1. **Create a migration script** (e.g., `migrate-{feature}-safe.js`) that:
   - Checks for data that would be lost
   - Migrates existing data to new values
   - Verifies migration success

2. **Add check to `check-data-loss-safety.js`**:
   ```javascript
   // Check for your new enum/field
   const check = await prisma.$queryRaw`...`;
   if (check.length > 0) {
     issues.push({
       type: 'Your Feature',
       description: 'Data that would be lost',
       action: 'Run: node scripts/migrate-your-feature-safe.js',
       severity: 'CRITICAL',
     });
   }
   ```

## Never Accept Data Loss

**Rule**: If Prisma warns about data loss, DO NOT use `--accept-data-loss` without:
1. Running safety checks
2. Creating and running a migration script
3. Verifying all data is safely migrated
4. Re-running safety checks

## Examples

### Example: Enum Value Change

**Before**:
```prisma
enum Status {
  OLD_VALUE
  NEW_VALUE
}
```

**After**:
```prisma
enum Status {
  NEW_VALUE
  OTHER_VALUE
}
```

**Process**:
1. Create `scripts/migrate-status-enum-safe.js` to migrate `OLD_VALUE → NEW_VALUE`
2. Run migration script
3. Update `check-data-loss-safety.js` to check for `OLD_VALUE`
4. Run safety check
5. Update schema
6. Run `prisma db push`

## CI/CD Integration

Add to your CI/CD pipeline:
```yaml
- name: Check data loss safety
  run: node scripts/check-data-loss-safety.js
```

This will fail the build if unsafe migrations are detected.
