# Migration baseline and shadow DB fix

## What we did

- **Problem:** `prisma migrate dev` was failing on the shadow database because the first migration in history (`20241211230000_add_presentation_model`) references `company_hqs`, which was never created by any migration (core schema was likely created with `db push` or since-removed migrations).
- **Fix:** We “mirrored” the current schema into a single baseline migration and archived the old migrations so the shadow DB replays one migration from empty → current schema.

## Current layout

- **Active:** `prisma/migrations/20240101000000_baseline/migration.sql` — full schema from empty (enums + all tables). This is the only migration Prisma uses.
- **Archive:** `prisma/migrations_archive/` — all previous migration folders (kept for reference only; Prisma ignores them).

## One-time steps on the existing database

Your DB already has the correct schema; we only need to align `_prisma_migrations` with the new single-migration history.

**Run these once** (replace with your DB URL if needed):

```bash
cd /path/to/IgniteBd-Next-combine
```

1. **Clear old migration history** (so Prisma doesn’t expect the removed migration files):

   ```bash
   echo 'DELETE FROM "_prisma_migrations";' | npx prisma db execute --stdin
   ```

   Or run the SQL in any client (e.g. psql, Neon SQL editor):

   ```sql
   DELETE FROM "_prisma_migrations";
   ```

2. **Mark the baseline as applied** (without running its SQL, since the DB already matches):

   ```bash
   npx prisma migrate resolve --applied 20240101000000_baseline
   ```

After this, `prisma migrate dev` should succeed: the shadow DB will apply only the baseline migration from empty, and your real DB will show no pending migrations.

## Going forward

- Use **`npx prisma migrate dev`** for new schema changes; it will create new migrations after the baseline.
- Use **`npx prisma migrate deploy`** in CI/production to apply pending migrations.
- Old migration folders remain in `prisma/migrations_archive/` for reference only.
