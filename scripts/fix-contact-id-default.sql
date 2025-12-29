-- Fix: Ensure contacts.id has UUID default
-- Run this if the default is missing

-- Check if default exists
DO $$
BEGIN
    -- Check if the default is already set
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'contacts' 
          AND column_name = 'id'
          AND column_default = 'gen_random_uuid()'
    ) THEN
        -- Set the default
        ALTER TABLE "contacts" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
        RAISE NOTICE 'Set default UUID generation for contacts.id';
    ELSE
        RAISE NOTICE 'Default already set for contacts.id';
    END IF;
END $$;

