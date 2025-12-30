-- Add new fields to bd_event_ops for EventPickerModel
ALTER TABLE "bd_event_ops" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "bd_event_ops" ADD COLUMN IF NOT EXISTS "timeFrame" TEXT;
ALTER TABLE "bd_event_ops" ADD COLUMN IF NOT EXISTS "sponsor" TEXT;
ALTER TABLE "bd_event_ops" ADD COLUMN IF NOT EXISTS "costEstimate" TEXT;

