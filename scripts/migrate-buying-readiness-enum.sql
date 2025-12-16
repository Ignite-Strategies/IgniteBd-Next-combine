-- Safe Migration Script: BuyingReadiness Enum Update
-- This script safely migrates existing data before changing the enum values
-- 
-- Old values: READ_BUT_NO_MONEY, MONEY_AND_READY
-- New values: NOT_READY, READY_NO_MONEY, READY_WITH_MONEY
--
-- Mapping:
--   READ_BUT_NO_MONEY → READY_NO_MONEY
--   MONEY_AND_READY → READY_WITH_MONEY
--   NULL → NULL (unchanged)

BEGIN;

-- Step 1: Update existing data in contacts table
-- Map old enum values to new ones
UPDATE contacts
SET "buyingReadiness" = CASE
  WHEN "buyingReadiness" = 'READ_BUT_NO_MONEY' THEN 'READY_NO_MONEY'
  WHEN "buyingReadiness" = 'MONEY_AND_READY' THEN 'READY_WITH_MONEY'
  ELSE "buyingReadiness"
END
WHERE "buyingReadiness" IN ('READ_BUT_NO_MONEY', 'MONEY_AND_READY');

-- Step 2: Verify no old values remain
DO $$
DECLARE
  old_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO old_count
  FROM contacts
  WHERE "buyingReadiness" IN ('READ_BUT_NO_MONEY', 'MONEY_AND_READY');
  
  IF old_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % rows still have old enum values', old_count;
  END IF;
  
  RAISE NOTICE 'Migration successful: All old enum values migrated';
END $$;

-- Step 3: The enum will be updated by Prisma migration
-- After this script runs, you can safely run: npx prisma db push

COMMIT;
