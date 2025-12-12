-- Add invoiceNumber (nullable, unique)
ALTER TABLE "invoices" ADD COLUMN "invoiceNumber" TEXT;
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber") WHERE "invoiceNumber" IS NOT NULL;

-- Add amount and currency fields
ALTER TABLE "invoices" ADD COLUMN "amount" DOUBLE PRECISION;
ALTER TABLE "invoices" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';

-- Add payment tracking fields
ALTER TABLE "invoices" ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN "paidByContactId" TEXT;

-- Add Stripe integration fields
ALTER TABLE "invoices" ADD COLUMN "stripeCheckoutSessionId" TEXT;
ALTER TABLE "invoices" ADD COLUMN "stripePaymentIntentId" TEXT;
ALTER TABLE "invoices" ADD COLUMN "stripeCustomerId" TEXT;

-- Create unique indexes for Stripe fields (nullable unique)
CREATE UNIQUE INDEX "invoices_stripeCheckoutSessionId_key" ON "invoices"("stripeCheckoutSessionId") WHERE "stripeCheckoutSessionId" IS NOT NULL;
CREATE UNIQUE INDEX "invoices_stripePaymentIntentId_key" ON "invoices"("stripePaymentIntentId") WHERE "stripePaymentIntentId" IS NOT NULL;

-- Create indexes for lookups
CREATE INDEX "invoices_stripeCheckoutSessionId_idx" ON "invoices"("stripeCheckoutSessionId");
CREATE INDEX "invoices_stripePaymentIntentId_idx" ON "invoices"("stripePaymentIntentId");
CREATE INDEX "invoices_stripeCustomerId_idx" ON "invoices"("stripeCustomerId");

