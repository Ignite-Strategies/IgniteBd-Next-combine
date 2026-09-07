-- Ghost leftover after companyId → crmId rename.
-- Tenant is crmId; employer FK is contactCompanyId.
-- IF EXISTS: live Neon already dropped this column; other DBs may still have it.
DROP INDEX IF EXISTS "contacts_companyId_idx";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "companyId";
