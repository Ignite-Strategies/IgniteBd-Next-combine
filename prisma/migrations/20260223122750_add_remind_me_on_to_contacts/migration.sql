-- AlterTable
ALTER TABLE "contacts" ADD COLUMN "remindMeOn" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "contacts_remindMeOn_idx" ON "contacts"("remindMeOn");
