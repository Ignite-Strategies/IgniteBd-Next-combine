-- Step 2: Migrate existing data to use new enum values
-- This runs after the enum values have been committed

-- Update existing data: map old values to new values
-- READ_BUT_NO_MONEY -> READY_NO_MONEY
UPDATE "contacts" 
SET "buyingReadiness" = 'READY_NO_MONEY'::"BuyingReadiness"
WHERE "buyingReadiness" = 'READ_BUT_NO_MONEY';

-- MONEY_AND_READY -> READY_WITH_MONEY
UPDATE "contacts" 
SET "buyingReadiness" = 'READY_WITH_MONEY'::"BuyingReadiness"
WHERE "buyingReadiness" = 'MONEY_AND_READY';

-- Note: Old enum values (READ_BUT_NO_MONEY, MONEY_AND_READY) remain in the enum type
-- but are no longer used. PostgreSQL doesn't support removing enum values easily.

