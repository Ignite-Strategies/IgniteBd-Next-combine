-- SendGrid sends 'email' field (not 'raw') - fix schema to match actual payload
-- Rename 'raw' to 'email' if it exists, otherwise add 'email' column
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='InboundEmail' AND column_name='raw') THEN
    ALTER TABLE "InboundEmail" RENAME COLUMN "raw" TO "email";
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='InboundEmail' AND column_name='email') THEN
    ALTER TABLE "InboundEmail" ADD COLUMN "email" TEXT;
  END IF;
END $$;
