-- Add presenter field to presentations
ALTER TABLE "presentations" ADD COLUMN IF NOT EXISTS "presenter" TEXT;

-- Add presenter and description fields to blogs
ALTER TABLE "blogs" ADD COLUMN IF NOT EXISTS "presenter" TEXT;
ALTER TABLE "blogs" ADD COLUMN IF NOT EXISTS "description" TEXT;

-- Add presenter and description fields to templates
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "presenter" TEXT;
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "description" TEXT;

-- Add presenter field to landing_pages (description already exists)
ALTER TABLE "landing_pages" ADD COLUMN IF NOT EXISTS "presenter" TEXT;

-- Add presenter field to event_plans (description already exists)
ALTER TABLE "event_plans" ADD COLUMN IF NOT EXISTS "presenter" TEXT;
