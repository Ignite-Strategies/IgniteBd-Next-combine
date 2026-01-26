# Cursor Database Connection Issue After Update

## Problem Summary

After updating Cursor, database connections from within Cursor's terminal/sandbox environment are failing with DNS resolution errors. The same connection works fine from the system terminal outside of Cursor.

## What We're Trying To Do

Run Prisma migrations to create a new `MicrosoftAccount` table in a Neon PostgreSQL database.

## Error Messages

### Prisma Migration Error
```
Error: P1001: Can't reach database server at `ep-summer-firefly-ad0yaaju.c-2.us-east-1.aws.neon.tech:5432`

Please make sure your database server is running at `ep-summer-firefly-ad0yaaju.c-2.us-east-1.aws.neon.tech:5432`.
```

### DNS Resolution Test
```bash
curl -v https://ep-summer-firefly-ad0yaaju.c-2.us-east-1.aws.neon.tech
# Result: Could not resolve host: ep-summer-firefly-ad0yaaju.c-2.us-east-1.aws.neon.tech
```

## Environment Details

- **OS**: macOS (darwin 24.6.0)
- **Shell**: zsh
- **Node.js**: v20.19.6
- **Prisma**: v6.19.0
- **Database**: Neon PostgreSQL (AWS)
- **Cursor**: Recently updated (exact version unknown)

## Connection Strings

From `.env.local`:
```bash
DATABASE_URL="postgresql://neondb_owner:npg_EG2wV8XQWmek@ep-summer-firefly-ad0yaaju-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
DIRECT_DATABASE_URL="postgresql://neondb_owner:npg_EG2wV8XQWmek@ep-summer-firefly-ad0yaaju.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

## What Works

✅ **System Terminal** (outside Cursor):
- Database connections work fine
- Can run migrations successfully
- DNS resolution works

✅ **Environment Variables**:
- `.env.local` file exists and has correct values
- Migration script successfully loads variables from `.env.local`
- Variables are properly set in process.env

✅ **Migration Files**:
- Prisma schema is valid
- Migration SQL file is correctly formatted
- Scripts are properly configured

## What Doesn't Work

❌ **Cursor Terminal/Sandbox**:
- Cannot resolve DNS for database hostname
- Prisma cannot connect to database
- Network connectivity appears blocked

## What We've Tried

1. ✅ Verified `.env.local` has correct connection strings
2. ✅ Updated migration script to load `.env.local` automatically
3. ✅ Confirmed environment variables are loaded correctly
4. ✅ Tested DNS resolution (fails in Cursor, works in system terminal)
5. ✅ Verified Prisma schema is valid
6. ✅ Checked that migration files are correct

## Our Hypothesis

**Cursor's sandbox environment** (after the update) appears to have:
- Restricted network access
- DNS resolution blocked or limited
- Possible firewall/network isolation

This is preventing connections to external databases (Neon PostgreSQL on AWS).

## Questions for Community

1. **Has anyone experienced similar network/DNS issues in Cursor after an update?**
   - Did it work before the update?
   - What changed?

2. **Are there Cursor settings** that control:
   - Network access permissions?
   - DNS resolution?
   - Sandbox network isolation?

3. **Is there a way to grant network permissions** to Cursor's terminal/sandbox?
   - Permission prompts we might have missed?
   - Settings we need to enable?

4. **Workarounds** that have worked:
   - Running commands from system terminal instead?
   - Using a different connection method?
   - Configuring Cursor differently?

5. **Is this a known issue** with recent Cursor updates?
   - Any GitHub issues or forum discussions?
   - Expected behavior or bug?

## Additional Context

- The database connection **was working before the Cursor update**
- Same connection strings work fine from system terminal
- This appears to be a Cursor-specific network/DNS issue
- No error messages about permissions being denied
- Just DNS resolution failure

## Commands That Fail in Cursor

```bash
# Prisma migration
npx prisma migrate deploy
# Error: Can't reach database server

# DNS test
curl https://ep-summer-firefly-ad0yaaju.c-2.us-east-1.aws.neon.tech
# Error: Could not resolve host

# Direct connection test
nc -zv ep-summer-firefly-ad0yaaju.c-2.us-east-1.aws.neon.tech 5432
# Connection refused / timeout
```

## Commands That Work in System Terminal

```bash
# All of the above commands work fine
# Database is accessible
# DNS resolution works
# Migrations run successfully
```

## Current Workaround

Running migrations from system terminal (outside Cursor) works fine. But we'd like to understand:
- Why Cursor's environment is blocked
- If there's a way to fix it
- If this is expected behavior or a bug

## Files Involved

- `scripts/migrate-deploy.js` - Migration script (loads .env.local)
- `.env.local` - Environment variables with connection strings
- `prisma/schema.prisma` - Prisma schema (valid)
- `prisma/migrations/20260126180532_add_microsoft_account_model/migration.sql` - Migration SQL

## System Information

```bash
OS: darwin 24.6.0
Shell: zsh
Node: v20.19.6
Prisma: 6.19.0
Cursor: Recently updated (version unknown)
```

---

**TL;DR**: Cursor's terminal can't resolve DNS/connect to external databases after update. Works fine from system terminal. Is this a permission/settings issue or a bug?
