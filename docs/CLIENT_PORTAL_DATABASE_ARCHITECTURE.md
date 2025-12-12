# Client Portal Database Architecture

**Date:** 2025-01-28  
**Status:** ✅ Single Source of Truth Established

---

## 🎯 Core Principle

**The client portal is READ/WRITE ONLY on data - it does NOT own the database schema.**

All database models, fields, and relationships are defined in **IgniteBd** (`IgniteBd-Next-combine`). The client portal (`ignitebd-clientportal`) reads from and writes to the same database, but never modifies the schema.

---

## 📊 Database Ownership

### IgniteBd (Admin App)
- ✅ **OWNER** of all database models
- ✅ **ONLY** place where schema changes are made
- ✅ Creates migrations
- ✅ Runs `prisma migrate`

### Client Portal
- ✅ **READ/WRITE** access to data
- ✅ Uses same `DATABASE_URL` as IgniteBd
- ✅ Schema file is **read-only** (copied from IgniteBd)
- ❌ **NEVER** runs migrations
- ❌ **NEVER** modifies schema.prisma

---

## 🔄 Schema Sync Process

### When IgniteBd Schema Changes:

1. **Make changes in IgniteBd:**
   ```bash
   cd IgniteBd-Next-combine
   # Edit prisma/schema.prisma
   npx prisma migrate dev --name add_stripe_fields
   ```

2. **Copy schema to client portal:**
   ```bash
   # Copy entire schema.prisma from IgniteBd to client portal
   cp IgniteBd-Next-combine/prisma/schema.prisma ignitebd-clientportal/prisma/schema.prisma
   ```

3. **Regenerate Prisma Client in client portal:**
   ```bash
   cd ignitebd-clientportal
   npx prisma generate
   ```

4. **Client portal now has updated types:**
   - TypeScript types updated
   - Can read/write new fields
   - No migration needed (database already updated by IgniteBd)

---

## 🗄️ Shared Models

### Billing Models (Stripe Integration)

All billing models are defined in IgniteBd and used by client portal:

#### Invoice Model
```prisma
model Invoice {
  // Core fields
  id                 String
  workPackageId      String
  invoiceName        String
  invoiceDescription String?
  
  // Client portal compatibility
  invoiceNumber      String?  @unique
  amount             Float?
  currency           String   @default("USD")
  
  // Stripe fields (for payment processing)
  stripeCheckoutSessionId String? @unique
  stripePaymentIntentId   String? @unique
  stripeCustomerId        String?
  
  // Payment tracking
  paidAt             DateTime?
  paidByContactId    String?
  status             String   @default("pending")
  
  // Relations
  workPackage        WorkPackage
  milestones         InvoiceMilestone[]
  payments           Payment[]
}
```

#### Payment Model
```prisma
model Payment {
  id                    String
  invoiceId             String
  milestoneId           String?
  amountReceived        Int
  currency              String   @default("USD")
  paidAt                DateTime
  
  // Stripe fields
  stripeSessionId       String?  @unique
  stripePaymentIntentId String? @unique
  paidByContactId       String?
  
  // Relations
  invoice               Invoice
  milestone             InvoiceMilestone?
}
```

---

## 🔐 Access Patterns

### Client Portal Reads/Writes:

1. **Read Invoices:**
   ```javascript
   // Client portal can query invoices
   const invoices = await prisma.invoice.findMany({
     where: { /* filters */ },
     include: { workPackage: true, payments: true }
   });
   ```

2. **Create Payment Records:**
   ```javascript
   // Client portal creates payment records via Stripe webhook
   await prisma.payment.create({
     data: {
       invoiceId: "...",
       amountReceived: 10000,
       stripeSessionId: "cs_...",
       paidAt: new Date(),
     }
   });
   ```

3. **Update Invoice Status:**
   ```javascript
   // Client portal updates invoice after payment
   await prisma.invoice.update({
     where: { id: invoiceId },
     data: {
       status: "paid",
       paidAt: new Date(),
       stripeCheckoutSessionId: session.id,
     }
   });
   ```

### IgniteBd Admin Creates:

1. **Create Invoices:**
   ```javascript
   // Admin app creates invoices
   await prisma.invoice.create({
     data: {
       workPackageId: "...",
       invoiceName: "Q1 2025 Invoice",
       invoiceNumber: "INV-2025-001",
       amount: 1000.00,
       milestones: { create: [...] }
     }
   });
   ```

---

## ⚠️ Critical Rules

### DO ✅

- ✅ Make all schema changes in IgniteBd first
- ✅ Copy schema.prisma to client portal after changes
- ✅ Run `prisma generate` in client portal after schema copy
- ✅ Use same `DATABASE_URL` in both apps
- ✅ Client portal can read/write all data

### DON'T ❌

- ❌ Never modify schema.prisma in client portal
- ❌ Never run `prisma migrate` in client portal
- ❌ Never create new models in client portal
- ❌ Never add fields in client portal schema
- ❌ Never delete models/fields in client portal schema

---

## 📁 File Locations

### IgniteBd (Source of Truth)
- **Schema:** `IgniteBd-Next-combine/prisma/schema.prisma`
- **Migrations:** `IgniteBd-Next-combine/prisma/migrations/`
- **Client:** Generated in `IgniteBd-Next-combine/node_modules/.prisma/`

### Client Portal (Read-Only Copy)
- **Schema:** `ignitebd-clientportal/prisma/schema.prisma` (copied from IgniteBd)
- **Migrations:** ❌ None (uses IgniteBd's migrations)
- **Client:** Generated in `ignitebd-clientportal/node_modules/.prisma/`

---

## 🔄 Migration Workflow

### Example: Adding Stripe Fields

1. **Edit IgniteBd Schema:**
   ```prisma
   // IgniteBd-Next-combine/prisma/schema.prisma
   model Invoice {
     stripeCheckoutSessionId String? @unique  // ADD THIS
     // ...
   }
   ```

2. **Create Migration in IgniteBd:**
   ```bash
   cd IgniteBd-Next-combine
   npx prisma migrate dev --name add_stripe_checkout_session_id
   ```

3. **Copy Schema to Client Portal:**
   ```bash
   cp IgniteBd-Next-combine/prisma/schema.prisma \
      ignitebd-clientportal/prisma/schema.prisma
   ```

4. **Regenerate Client Portal Types:**
   ```bash
   cd ignitebd-clientportal
   npx prisma generate
   ```

5. **Done!** Client portal can now use `invoice.stripeCheckoutSessionId`

---

## 🧪 Testing

### Verify Schema Sync:

```bash
# In IgniteBd
cd IgniteBd-Next-combine
npx prisma migrate status

# In Client Portal
cd ignitebd-clientportal
npx prisma migrate status  # Should show same migrations
```

### Verify Field Access:

```typescript
// Client portal should have TypeScript types for new fields
const invoice = await prisma.invoice.findUnique({ where: { id: "..." } });
invoice.stripeCheckoutSessionId  // ✅ Should be typed
```

---

## 📚 Related Documentation

- **`STRIPE_FIELDS_MIGRATION.md`** - Details on Stripe field additions
- **`PRISMA_RULES.md`** (in client portal) - Schema modification rules
- **`CLIENT_PORTAL_ARCHITECTURE.md`** (in client portal) - Overall architecture

---

**Last Updated:** 2025-01-28  
**Status:** ✅ Single source of truth established

