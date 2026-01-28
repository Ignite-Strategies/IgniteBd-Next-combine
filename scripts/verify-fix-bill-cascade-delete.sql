-- Verify and Fix Bill Cascade Delete Constraint
-- Run this script to check if the cascade delete constraint exists and fix it if needed

-- Step 1: Check current constraint
SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table,
  CASE confdeltype
    WHEN 'c' THEN 'CASCADE'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'n' THEN 'NO ACTION'
    WHEN 's' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
  END AS on_delete_action,
  CASE confupdtype
    WHEN 'c' THEN 'CASCADE'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'n' THEN 'NO ACTION'
    WHEN 's' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
  END AS on_update_action
FROM pg_constraint
WHERE conrelid = 'bills'::regclass
  AND confrelid = 'company_hqs'::regclass
  AND contype = 'f';

-- Step 2: If constraint doesn't exist or is not CASCADE, fix it
-- Drop existing constraint if it exists (with wrong delete action)
DO $$
BEGIN
  -- Drop constraint if it exists
  ALTER TABLE "bills" DROP CONSTRAINT IF EXISTS "bills_companyId_fkey";
  
  -- Add correct constraint with CASCADE
  ALTER TABLE "bills" 
    ADD CONSTRAINT "bills_companyId_fkey" 
    FOREIGN KEY ("companyId") 
    REFERENCES "company_hqs"("id") 
    ON DELETE CASCADE 
    ON UPDATE CASCADE;
    
  RAISE NOTICE 'Constraint fixed: bills.companyId -> company_hqs.id (CASCADE)';
END $$;

-- Step 3: Verify the fix
SELECT 
  conname AS constraint_name,
  CASE confdeltype
    WHEN 'c' THEN 'CASCADE ✅'
    ELSE 'NOT CASCADE ❌'
  END AS on_delete_action
FROM pg_constraint
WHERE conrelid = 'bills'::regclass
  AND confrelid = 'company_hqs'::regclass
  AND contype = 'f';
