-- CreateEnum
CREATE TYPE "BillSendStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED');

-- CreateTable
CREATE TABLE "bills" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_sends" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "checkoutUrl" TEXT,
    "status" "BillSendStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bill_sends_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bill_sends_stripeCheckoutSessionId_key" ON "bill_sends"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "bill_sends_billId_idx" ON "bill_sends"("billId");

-- CreateIndex
CREATE INDEX "bill_sends_companyId_idx" ON "bill_sends"("companyId");

-- CreateIndex
CREATE INDEX "bill_sends_status_idx" ON "bill_sends"("status");

-- AddForeignKey
ALTER TABLE "bill_sends" ADD CONSTRAINT "bill_sends_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_sends" ADD CONSTRAINT "bill_sends_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
