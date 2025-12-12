-- AlterTable (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'company_hqs' AND column_name = 'ultraTenantId'
    ) THEN
        ALTER TABLE "company_hqs" ADD COLUMN "ultraTenantId" TEXT;
    END IF;
END $$;

-- AddForeignKey (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'company_hqs_ultraTenantId_fkey'
    ) THEN
        ALTER TABLE "company_hqs" ADD CONSTRAINT "company_hqs_ultraTenantId_fkey" 
        FOREIGN KEY ("ultraTenantId") REFERENCES "company_hqs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

