-- CreateTable (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'super_admins'
    ) THEN
        CREATE TABLE "super_admins" (
            "id" TEXT NOT NULL,
            "ownerId" TEXT NOT NULL,
            "active" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "super_admins_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "super_admins_ownerId_key" ON "super_admins"("ownerId");

-- AddForeignKey (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'super_admins_ownerId_fkey'
    ) THEN
        ALTER TABLE "super_admins" ADD CONSTRAINT "super_admins_ownerId_fkey" 
        FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

