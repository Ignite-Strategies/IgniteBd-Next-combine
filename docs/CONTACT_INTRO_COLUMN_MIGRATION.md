# Contact introducedByContactId – Production migration

## Error

```
The column `contacts.introducedByContactId` does not exist in the current database.
code: 'P2022'
```

This means the **production database** has not had the migration applied that adds `introducedByContactId` (and drops the old `introSourceContactId`).

## Relevant migrations

- **20260225160000_add_contact_intro_source** – adds `introSourceContactId` (old column).
- **20260225170000_simplify_intro_source_to_string** – drops `introSourceContactId`, adds `introducedByContactId`.

Production must have run through **20260225170000** so that `contacts.introducedByContactId` exists.

## Fix: run migrations on production

1. **One-off (recommended first time)**  
   Point at the production DB and run deploy:

   ```bash
   # Use production DATABASE_URL (or DIRECT_DATABASE_URL for Neon)
   export DATABASE_URL="postgresql://..."   # your production URL
   npm run migrate
   ```

   Or directly:

   ```bash
   npx prisma migrate deploy
   ```

   (Ensure `DATABASE_URL` in the environment is production.)

2. **Ongoing**  
   In your deploy pipeline (e.g. Vercel), either:
   - Run `npm run migrate` (or `npx prisma migrate deploy`) **before** `npm run build` in the same environment that has production `DATABASE_URL`, or  
   - Use the full build script so migrations run on every deploy:

   ```bash
   npm run build:full
   ```

   (`build:full` = `prisma generate && npm run migrate && npm run build`.)

## After migrations

Once `20260225170000_simplify_intro_source_to_string` has been applied on production, the `contacts` table will have `introducedByContactId` and the contacts API will stop returning P2022.
