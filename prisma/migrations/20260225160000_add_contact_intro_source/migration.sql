-- AlterTable: add optional FK from Contact to Contact (intro source / connector who introduced this person)
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "introSourceContactId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contacts_introSourceContactId_idx" ON "contacts"("introSourceContactId");

-- AddForeignKey (after column exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_introSourceContactId_fkey'
  ) THEN
    ALTER TABLE "contacts" ADD CONSTRAINT "contacts_introSourceContactId_fkey"
      FOREIGN KEY ("introSourceContactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
