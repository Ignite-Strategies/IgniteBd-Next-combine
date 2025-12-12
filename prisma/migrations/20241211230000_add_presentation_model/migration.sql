-- CreateTable (idempotent - only creates if table doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'presentations'
    ) THEN
        CREATE TABLE "presentations" (
            "id" TEXT NOT NULL,
            "companyHQId" TEXT NOT NULL,
            "title" TEXT NOT NULL,
            "slides" JSONB,
            "presenter" TEXT,
            "description" TEXT,
            "feedback" JSONB,
            "published" BOOLEAN NOT NULL DEFAULT false,
            "publishedAt" TIMESTAMP(3),
            
            -- Gamma deck generation fields
            "gammaStatus" TEXT,
            "gammaDeckUrl" TEXT,
            "gammaPptxUrl" TEXT,
            "gammaBlob" TEXT,
            "gammaError" TEXT,
            
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "presentations_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "presentations_companyHQId_idx" ON "presentations"("companyHQId");
CREATE INDEX IF NOT EXISTS "presentations_published_idx" ON "presentations"("published");
CREATE INDEX IF NOT EXISTS "presentations_gammaStatus_idx" ON "presentations"("gammaStatus");

-- Add missing columns if they don't exist (for existing tables)
DO $$
BEGIN
    -- Add Gamma fields if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presentations' AND column_name = 'presenter') THEN
        ALTER TABLE "presentations" ADD COLUMN "presenter" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presentations' AND column_name = 'feedback') THEN
        ALTER TABLE "presentations" ADD COLUMN "feedback" JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presentations' AND column_name = 'gammaStatus') THEN
        ALTER TABLE "presentations" ADD COLUMN "gammaStatus" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presentations' AND column_name = 'gammaDeckUrl') THEN
        ALTER TABLE "presentations" ADD COLUMN "gammaDeckUrl" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presentations' AND column_name = 'gammaPptxUrl') THEN
        ALTER TABLE "presentations" ADD COLUMN "gammaPptxUrl" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presentations' AND column_name = 'gammaBlob') THEN
        ALTER TABLE "presentations" ADD COLUMN "gammaBlob" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presentations' AND column_name = 'gammaError') THEN
        ALTER TABLE "presentations" ADD COLUMN "gammaError" TEXT;
    END IF;
END $$;

-- AddForeignKey (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'presentations_companyHQId_fkey'
    ) THEN
        ALTER TABLE "presentations" ADD CONSTRAINT "presentations_companyHQId_fkey" 
        FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
