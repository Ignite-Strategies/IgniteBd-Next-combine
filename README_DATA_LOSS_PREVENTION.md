# 🛡️ Data Loss Prevention System

## ⚠️ CRITICAL: Never Accept Data Loss

**Rule**: If Prisma warns about data loss, **DO NOT** use `--accept-data-loss` without running safety checks first.

## Quick Start

### Before ANY Prisma Migration:

```bash
# 1. Always run safety check first
npm run db:safety-check

# 2. If checks pass, use safe push wrapper
npm run db:push
```

### If Safety Check Fails:

1. Fix the issues (run migration scripts)
2. Re-run safety check
3. Only then proceed with schema changes

## Available Commands

- `npm run db:safety-check` - Check for potential data loss
- `npm run db:push` - Safe wrapper for `prisma db push` (runs safety checks first)
- `npm run db:push:unsafe` - Direct prisma push (NOT RECOMMENDED - bypasses safety)

## How It Works

1. **Safety Check Script** (`scripts/check-data-loss-safety.js`):
   - Scans database for data that would be lost
   - Checks enum value mismatches
   - Verifies required fields
   - Blocks migration if issues found

2. **Safe Push Wrapper** (`scripts/safe-prisma-push.sh`):
   - Automatically runs safety checks
   - Blocks migration if unsafe
   - Requires confirmation for `--accept-data-loss`

3. **Pre-Push Hook** (`.git/hooks/pre-push`):
   - Automatically runs safety checks before pushing schema changes
   - Prevents pushing unsafe migrations

## Examples

### ✅ Safe Workflow

```bash
# 1. Check safety
npm run db:safety-check

# 2. If safe, push
npm run db:push
```

### ❌ Unsafe Workflow (DON'T DO THIS)

```bash
# DON'T: Direct push without checks
npx prisma db push --accept-data-loss
```

## Adding New Safety Checks

When adding new enums or required fields:

1. Create migration script: `scripts/migrate-{feature}-safe.js`
2. Add check to `scripts/check-data-loss-safety.js`
3. Test the safety check
4. Document in `scripts/DATA_LOSS_PREVENTION.md`

## Emergency Bypass

If you absolutely must bypass (NOT RECOMMENDED):

```bash
# This will show a warning but allow push
npm run db:push:unsafe --accept-data-loss
```

**Only use in emergencies after manual verification!**
