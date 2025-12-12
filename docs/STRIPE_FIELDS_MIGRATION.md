# Stripe Fields Migration - Client Portal Integration

**Date:** 2025-01-28  
**Status:** ⚠️ CRITICAL - Required for Client Portal Payment Processing

---

## 🎯 Problem

The **client portal** needs Stripe payment fields on the Invoice model, but IgniteBd's schema is missing them. The client portal is **read/write only** - it doesn't own the database schema. All models must exist in **IgniteBd** first.

---

## 📊 Current State

### IgniteBd Invoice Model (Current)
```prisma
model Invoice {
  id                 String             @id @default(cuid())
  workPackageId      String
  invoiceName        String
  invoiceDescription String?
  totalExpected      Int                @default(0)
  totalReceived      Int                @default(0)
  status             String             @default("pending")
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt
  milestones         InvoiceMilestone[]
  payments           Payment[]
}
```

### Client Portal Expects (From checkout route)
```javascript
// Fields accessed in checkout route:
invoice.stripeCheckoutSessionId  // ❌ MISSING
invoice.stripeCustomerId          // ❌ MISSING
invoice.invoiceNumber              // ❌ MISSING (has invoiceName instead)
invoice.amount                     // ❌ MISSING (has totalExpected instead)
invoice.currency                   // ❌ MISSING
invoice.description                // ✅ EXISTS (invoiceDescription)
invoice.proposalId                 // ❌ MISSING (has workPackageId instead)
invoice.paidByContactId            // ❌ MISSING
invoice.paidAt                     // ❌ MISSING
```

---

## ✅ Required Schema Changes

### 1. Add Stripe Fields to Invoice Model

```prisma
model Invoice {
  id                 String             @id @default(cuid())
  workPackageId      String
  invoiceName        String
  invoiceDescription String?
  
  // Invoice identification
  invoiceNumber      String?            @unique  // Human-readable (e.g., "INV-2025-001")
  
  // Amount fields (for client portal compatibility)
  amount             Float?             // Total invoice amount (for Stripe line items)
  currency           String             @default("USD")
  
  // Existing totals (keep for backward compatibility)
  totalExpected      Int                @default(0)
  totalReceived      Int                @default(0)
  
  // Payment status
  status             String             @default("pending") // "pending" | "partial" | "paid" | "failed" | "refunded"
  paidAt             DateTime?         // When invoice was paid
  paidByContactId    String?           // Which contact paid (from Stripe session metadata)
  
  // Stripe integration fields (CRITICAL for payment processing)
  stripeCheckoutSessionId String?      @unique  // Links to Stripe checkout session
  stripePaymentIntentId   String?      @unique  // Links to Stripe payment intent
  stripeCustomerId        String?               // Stripe customer ID (reused across invoices)
  
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt
  milestones         InvoiceMilestone[]
  payments           Payment[]
  
  @@index([workPackageId])
  @@index([status])
  @@index([stripeCheckoutSessionId])
  @@index([stripePaymentIntentId])
  @@index([stripeCustomerId])
  @@map("invoices")
}
```

### 2. Payment Model Already Has Stripe Fields ✅

```prisma
model Payment {
  id                    String            @id @default(cuid())
  invoiceId             String
  invoice               Invoice           @relation(...)
  milestoneId           String?
  milestone             InvoiceMilestone? @relation(...)
  amountReceived        Int
  currency              String            @default("USD")
  paidAt                DateTime
  stripeSessionId       String?           @unique  // ✅ EXISTS
  stripePaymentIntentId String?           @unique  // ✅ EXISTS
  paidByContactId       String?                     // ✅ EXISTS
  createdAt             DateTime          @default(now())
  
  @@index([stripeSessionId])
  @@index([stripePaymentIntentId])
  @@map("payments")
}
```

**Note:** Payment model already has the Stripe fields! ✅

---

## 🔄 Migration Strategy

### Option 1: Add All Fields at Once (Recommended)

**Migration SQL:**
```sql
-- Add invoiceNumber (nullable, unique)
ALTER TABLE invoices ADD COLUMN "invoiceNumber" TEXT;
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON invoices("invoiceNumber") WHERE "invoiceNumber" IS NOT NULL;

-- Add amount and currency
ALTER TABLE invoices ADD COLUMN "amount" DOUBLE PRECISION;
ALTER TABLE invoices ADD COLUMN "currency" TEXT DEFAULT 'USD';

-- Add payment tracking fields
ALTER TABLE invoices ADD COLUMN "paidAt" TIMESTAMP;
ALTER TABLE invoices ADD COLUMN "paidByContactId" TEXT;

-- Add Stripe fields
ALTER TABLE invoices ADD COLUMN "stripeCheckoutSessionId" TEXT;
ALTER TABLE invoices ADD COLUMN "stripePaymentIntentId" TEXT;
ALTER TABLE invoices ADD COLUMN "stripeCustomerId" TEXT;

-- Create unique indexes for Stripe fields
CREATE UNIQUE INDEX "invoices_stripeCheckoutSessionId_key" ON invoices("stripeCheckoutSessionId") WHERE "stripeCheckoutSessionId" IS NOT NULL;
CREATE UNIQUE INDEX "invoices_stripePaymentIntentId_key" ON invoices("stripePaymentIntentId") WHERE "stripePaymentIntentId" IS NOT NULL;

-- Create indexes for lookups
CREATE INDEX "invoices_stripeCheckoutSessionId_idx" ON invoices("stripeCheckoutSessionId");
CREATE INDEX "invoices_stripePaymentIntentId_idx" ON invoices("stripePaymentIntentId");
CREATE INDEX "invoices_stripeCustomerId_idx" ON invoices("stripeCustomerId");
```

### Option 2: Backfill Existing Data

After adding fields, backfill `amount` from `totalExpected`:

```sql
-- Backfill amount from totalExpected (convert cents to dollars)
UPDATE invoices 
SET "amount" = "totalExpected" / 100.0 
WHERE "amount" IS NULL AND "totalExpected" > 0;
```

---

## 📝 Field Mapping

### Client Portal → IgniteBd Field Mapping

| Client Portal Uses | IgniteBd Field | Notes |
|-------------------|----------------|-------|
| `invoice.invoiceNumber` | `invoice.invoiceNumber` | New field - needs to be added |
| `invoice.amount` | `invoice.amount` | New field - for Stripe line items |
| `invoice.currency` | `invoice.currency` | New field - defaults to "USD" |
| `invoice.description` | `invoice.invoiceDescription` | ✅ Already exists |
| `invoice.proposalId` | `invoice.workPackageId` | Different model - client portal needs adapter |
| `invoice.stripeCheckoutSessionId` | `invoice.stripeCheckoutSessionId` | New field - critical for webhooks |
| `invoice.stripeCustomerId` | `invoice.stripeCustomerId` | New field - for customer reuse |
| `invoice.stripePaymentIntentId` | `invoice.stripePaymentIntentId` | New field - links to payment |
| `invoice.paidByContactId` | `invoice.paidByContactId` | New field - tracks who paid |
| `invoice.paidAt` | `invoice.paidAt` | New field - payment timestamp |

---

## 🔧 Code Changes Required

### 1. Update IgniteBd Schema

Add all fields to `prisma/schema.prisma` Invoice model (see schema above).

### 2. Create Migration

```bash
cd IgniteBd-Next-combine
npx prisma migrate dev --name add_stripe_fields_to_invoice
```

### 3. Update Client Portal Schema

After migration, copy updated Invoice model to client portal schema:

```bash
# Copy Invoice model from IgniteBd to client portal
# (Client portal schema is read-only, just needs to match)
```

### 4. Update Client Portal Checkout Route

The checkout route already expects these fields, but may need adapter for `proposalId` → `workPackageId`:

```javascript
// Current code expects:
invoice.proposalId  // ❌ Doesn't exist in IgniteBd

// Need to adapt:
// Option A: Add proposalId field (if Proposal exists)
// Option B: Query WorkPackage → Proposal relationship
// Option C: Store proposalId in WorkPackage or Invoice metadata
```

---

## ⚠️ Breaking Changes

### 1. `proposalId` vs `workPackageId`

**Problem:** Client portal expects `invoice.proposalId`, but IgniteBd uses `invoice.workPackageId`.

**Solutions:**

**Option A:** Add `proposalId` to Invoice (if Proposal model exists)
```prisma
model Invoice {
  workPackageId String
  proposalId    String?  // Add if Proposal exists
  // ...
}
```

**Option B:** Query via WorkPackage relation
```javascript
// In checkout route, load WorkPackage first:
const invoice = await prisma.invoice.findUnique({
  where: { id: invoiceId },
  include: {
    workPackage: {
      include: {
        proposal: true  // If WorkPackage → Proposal relation exists
      }
    }
  }
});
```

**Option C:** Store proposalId in WorkPackage
```prisma
model WorkPackage {
  proposalId String?  // Link to Proposal if needed
  // ...
}
```

---

## ✅ Checklist

- [ ] Add `invoiceNumber` field (nullable, unique)
- [ ] Add `amount` field (Float, nullable)
- [ ] Add `currency` field (String, default "USD")
- [ ] Add `paidAt` field (DateTime, nullable)
- [ ] Add `paidByContactId` field (String, nullable)
- [ ] Add `stripeCheckoutSessionId` field (String, nullable, unique)
- [ ] Add `stripePaymentIntentId` field (String, nullable, unique)
- [ ] Add `stripeCustomerId` field (String, nullable)
- [ ] Create indexes for Stripe fields
- [ ] Create migration file
- [ ] Run migration on database
- [ ] Update client portal schema (copy Invoice model)
- [ ] Test client portal checkout flow
- [ ] Test Stripe webhook handler
- [ ] Backfill existing invoice data (if needed)

---

## 🧪 Testing

After migration:

1. **Create Invoice Test:**
   ```javascript
   // Should be able to create invoice with Stripe fields
   const invoice = await prisma.invoice.create({
     data: {
       workPackageId: "...",
       invoiceName: "Test Invoice",
       invoiceNumber: "INV-2025-001",
       amount: 1000.00,
       currency: "USD",
     }
   });
   ```

2. **Checkout Session Test:**
   ```javascript
   // Client portal checkout should work
   POST /api/client/billing/[invoiceId]/checkout
   // Should create Stripe session and store stripeCheckoutSessionId
   ```

3. **Webhook Test:**
   ```javascript
   // Stripe webhook should update invoice
   POST /api/webhook/stripe
   // Should find invoice by stripeCheckoutSessionId
   // Should update status, paidAt, paidByContactId
   ```

---

## 📚 Related Files

- **IgniteBd Schema:** `prisma/schema.prisma`
- **Client Portal Schema:** `ignitebd-clientportal/prisma/schema.prisma`
- **Client Portal Checkout:** `ignitebd-clientportal/app/api/client/billing/[invoiceId]/checkout/route.js`
- **Stripe Webhook:** `ignitebd-clientportal/app/api/webhook/stripe/route.js`

---

**Last Updated:** 2025-01-28  
**Priority:** 🔴 CRITICAL - Blocks client portal payment processing

