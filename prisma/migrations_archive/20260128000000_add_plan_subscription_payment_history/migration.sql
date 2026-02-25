-- Add PLAN_SUBSCRIPTION to InvoiceType enum
ALTER TYPE "InvoiceType" ADD VALUE 'PLAN_SUBSCRIPTION';

-- Add Stripe invoice and subscription tracking fields
ALTER TABLE "invoices" ADD COLUMN "stripeInvoiceId" TEXT;
ALTER TABLE "invoices" ADD COLUMN "stripeSubscriptionId" TEXT;

-- Create unique index for stripeInvoiceId (nullable unique)
CREATE UNIQUE INDEX "invoices_stripeInvoiceId_key" ON "invoices"("stripeInvoiceId") WHERE "stripeInvoiceId" IS NOT NULL;

-- Create indexes for lookups
CREATE INDEX "invoices_stripeInvoiceId_idx" ON "invoices"("stripeInvoiceId");
CREATE INDEX "invoices_stripeSubscriptionId_idx" ON "invoices"("stripeSubscriptionId");
