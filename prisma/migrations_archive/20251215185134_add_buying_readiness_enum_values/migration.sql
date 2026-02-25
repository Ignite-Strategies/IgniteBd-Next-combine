-- Step 1: Add new BuyingReadiness enum values
-- Note: These must be added before they can be used in UPDATE statements

-- Add new enum values (checking if they exist first to avoid errors)
DO $$ 
BEGIN
  -- Add NOT_READY
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'NOT_READY' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BuyingReadiness')
  ) THEN
    ALTER TYPE "BuyingReadiness" ADD VALUE 'NOT_READY';
  END IF;
  
  -- Add READY_NO_MONEY
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'READY_NO_MONEY' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BuyingReadiness')
  ) THEN
    ALTER TYPE "BuyingReadiness" ADD VALUE 'READY_NO_MONEY';
  END IF;
  
  -- Add READY_WITH_MONEY
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'READY_WITH_MONEY' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BuyingReadiness')
  ) THEN
    ALTER TYPE "BuyingReadiness" ADD VALUE 'READY_WITH_MONEY';
  END IF;
END $$;

