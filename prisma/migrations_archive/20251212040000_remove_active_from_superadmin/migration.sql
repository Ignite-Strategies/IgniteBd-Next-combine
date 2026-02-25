-- Remove active column from super_admins table
-- SuperAdmin records are inherently active if they exist (delete to deactivate)

-- Drop column (idempotent)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'super_admins' AND column_name = 'active'
    ) THEN
        ALTER TABLE "super_admins" DROP COLUMN "active";
    END IF;
END $$;
