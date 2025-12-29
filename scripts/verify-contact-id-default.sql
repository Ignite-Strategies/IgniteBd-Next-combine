-- Verify that the contacts.id column has the default UUID generation set
-- Run this to check if the migration was applied

SELECT 
    column_name,
    column_default,
    is_nullable,
    data_type
FROM information_schema.columns
WHERE table_name = 'contacts' 
  AND column_name = 'id';

-- Expected result:
-- column_name: id
-- column_default: gen_random_uuid()
-- is_nullable: NO
-- data_type: text

