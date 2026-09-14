# Contact identity: `crmId` vs `contactCompanyId` (and the dropped `companyId`)

This documents what git history shows about the People Hub P2022 (`contacts.companyId does not exist`). It was **not** a revert of recent inbound-parse work and **not** Neon randomly dropping a column.

## Canonical identity (current)

| Concept | Field | Notes |
|--------|--------|--------|
| Tenant (CompanyHQ) | `crmId` | Required. One contact row per `(email, crmId)`. |
| Employer (prospect/client company) | `contactCompanyId` | FK → `companies.id` |
| Enrichment strings | `companyName`, `companyDomain` | Convenience copies from Apollo/Lusha |

**Do not** reintroduce `contacts.companyId`. Query-param `companyId` on retrieve routes maps to `contactCompanyId`, not tenant.

Fix: migration `20260907160000_drop_contacts_companyId`, schema commit `35ab9e39`.

## Timeline (git)

- **2025-11-09** (`de2ed063`): App-router port — `crmId` (tenant) plus optional `companyId` (“link to Company”) already coexist in schema.
- **2025-11-12** (`87fe085a`): Docs recommend `prisma db push --accept-data-loss` for prod schema sync ([`prisma-vercel-workflow.md`](../setup/prisma-vercel-workflow.md)).
- **2025-11-06 SQL**, committed **2026-02-25** to archive only: [`prisma/migrations_archive/20251106194819_rename_companyId_to_crmId/migration.sql`](../../prisma/migrations_archive/20251106194819_rename_companyId_to_crmId/migration.sql) renames tenant column `companyId` → `crmId`. **Not** in active `prisma/migrations/` deploy chain.
- **2025-12-16** (`80c5c7d7`): Retrieve route stops filtering on `companyId`; comments call it “enrichment only, not FK.”
- **2025-12-28** (`4c288e4b`): CompanyHQ-scoped contacts canon — still three ids in schema: `crmId`, `contactCompanyId`, ghost `companyId`.
- **2025-12-29** (`dc551c06`): Large schema rewrite (`Contact` → `contacts`) consistent with `prisma db pull`; pull still saw a `companyId` column on the introspected DB.
- **2026-02-25** (`c7cb69fb`): Migration baseline squash. [`20240101000000_baseline`](../../prisma/migrations/20240101000000_baseline/migration.sql) still `CREATE`s `contacts.companyId`. Existing Neon DBs marked baseline applied **without running SQL** ([`MIGRATION_BASELINE_AND_SHADOW_DB_FIX.md`](../MIGRATION_BASELINE_AND_SHADOW_DB_FIX.md)).
- **2026-05-13** (`eb7018de`): Build runs `prisma migrate deploy` after a **different** P2022 (`InboundEmail.processingError`). Same drift class; no migration dropped `contacts.companyId` until Sept 2026.
- **2026-09-07** (`35ab9e39`): Remove ghost field from Prisma; `20260907160000_drop_contacts_companyId` (`DROP COLUMN IF EXISTS`). Live Neon already lacked the column.

## What happened

1. Original tenant column was **renamed** to `crmId` (archive migration). Postgres no longer had a tenant named `companyId`.
2. Prisma schema kept a **second** optional `companyId` (enrichment / legacy). Retrieve already avoided using it as FK.
3. Production Neon was shaped by **`db push` / pull / baseline-resolve**, not a full replay of every migration. Schema and DB diverged silently.
4. People Hub `GET /api/contacts` → `prisma.contact.findMany()` with no `select` SELECTs every schema field → P2022 when ghost `companyId` was in Prisma but absent in Neon.

Recurring pattern in this repo: career fields (`97a5172a`), `engagementSummary` (`27f73708`), inbound `processingError` (`eb7018de`).

## Going forward

- Schema changes: **`prisma migrate dev`** + **`migrate deploy`** on build (see [`package.json`](../../package.json)). Avoid ad-hoc `db push` on prod unless explicitly approved.
- After Contact model edits, smoke **`GET /api/contacts/retrieve?companyHQId=…`** (People Hub).
- API filter param `companyId` → `where.contactCompanyId`. Tenant filter → `crmId` / `companyHQId` query param.
