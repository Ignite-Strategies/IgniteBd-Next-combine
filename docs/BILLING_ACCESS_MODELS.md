# Billing / Access Models - Implementation Summary

**Date:** 2025-01-28  
**Status:** ✅ Schema Implemented

---

## ✅ Models Created

### 1. CompanyHQ (Updated)
**File:** `prisma/schema.prisma`

```prisma
model company_hqs {
  id                String                @id @default(cuid())
  companyName       String
  // ... existing fields ...
  stripeCustomerId  String?               @unique // Stripe customer ID (cus_...)
  // ... relations ...
  platform_accesses platform_accesses[]
  
  @@index([stripeCustomerId])
}
```

**Key Points:**
- ✅ `stripeCustomerId` added to `company_hqs`
- ✅ Unique constraint on `stripeCustomerId`
- ✅ Index for lookups
- ✅ Billing identity is company-scoped

---

### 2. Plan Model
**File:** `prisma/schema.prisma`

```prisma
model plans {
  id                String                @id @default(cuid())
  name              String                // e.g., "Gold Tier – Annual"
  description       String?
  interval          PlanInterval          // "month" | "year"
  amountCents       Int                   // Price in cents
  currency          String                @default("usd")
  stripeProductId   String?               // prod_...
  stripePriceId     String?               @unique // price_... (1:1 with Plan)
  isActive          Boolean               @default(true)
  createdAt         DateTime              @default(now())
  updatedAt         DateTime              @updatedAt
  platform_accesses platform_accesses[]

  @@index([stripeProductId])
  @@index([stripePriceId])
  @@index([isActive])
}
```

**Key Points:**
- ✅ One row = one Stripe Price
- ✅ `stripePriceId` is unique (1:1 with Plan)
- ✅ Plans are immutable once used (price/interval change = new Plan)
- ✅ Multiple Plans can share same `stripeProductId`
- ✅ `amountCents` stored in cents (integer)

---

### 3. PlatformAccess Model
**File:** `prisma/schema.prisma`

```prisma
model platform_accesses {
  id                    String                @id @default(cuid())
  name                  String?               // Optional, usually mirrors Plan.name
  companyId             String                // FK → CompanyHQ.id
  planId                String                // FK → Plan.id
  status                PlatformAccessStatus  @default(ACTIVE)
  stripeSubscriptionId  String?               @unique // sub_...
  startedAt             DateTime              @default(now())
  endsAt                DateTime?
  createdAt             DateTime              @default(now())
  updatedAt             DateTime              @updatedAt
  company_hqs           company_hqs           @relation(fields: [companyId], references: [id], onDelete: Cascade)
  plans                 plans                 @relation(fields: [planId], references: [id])

  @@index([companyId])
  @@index([planId])
  @@index([status])
  @@index([stripeSubscriptionId])
}
```

**Key Points:**
- ✅ Source of truth for platform access
- ✅ `stripeSubscriptionId` is unique
- ✅ Access logic checks `status === ACTIVE`
- ✅ Cascade delete when company deleted

---

## ✅ Enums Created

### PlanInterval
```prisma
enum PlanInterval {
  MONTH
  YEAR
}
```

### PlatformAccessStatus
```prisma
enum PlatformAccessStatus {
  ACTIVE
  PAUSED
  EXPIRED
}
```

---

## 🔒 Hard Constraints (Enforced)

### Stripe ID Ownership
- ✅ `stripeCustomerId` → CompanyHQ only
- ✅ `stripeProductId` / `stripePriceId` → Plan only
- ✅ `stripeSubscriptionId` → PlatformAccess only

### Foreign Keys
- ✅ `platform_accesses.companyId` → `company_hqs.id` (Cascade delete)
- ✅ `platform_accesses.planId` → `plans.id`

### Uniqueness
- ✅ `company_hqs.stripeCustomerId` → Unique
- ✅ `plans.stripePriceId` → Unique
- ✅ `platform_accesses.stripeSubscriptionId` → Unique

---

## 🧠 Mental Model

```
Plan            = Contract package (price + interval)
CompanyHQ       = Payer identity (owns stripeCustomerId)
PlatformAccess  = Entitlement (source of truth for access)
```

**Flow:**
1. CompanyHQ gets `stripeCustomerId` (created once, reused)
2. Plan represents sellable package (product + price + interval)
3. PlatformAccess links CompanyHQ to Plan (entitlement)
4. Stripe enforces billing time
5. PlatformAccess enforces access

---

## 📋 Usage Examples

### Check if Company Has Active Access
```javascript
const access = await prisma.platform_accesses.findFirst({
  where: {
    companyId: companyHQId,
    status: 'ACTIVE',
    endsAt: {
      gte: new Date(), // Not expired
    },
  },
  include: {
    plans: true,
  },
});

if (access) {
  // Company has active platform access
}
```

### Create Platform Access
```javascript
const access = await prisma.platform_accesses.create({
  data: {
    companyId: companyHQId,
    planId: planId,
    status: 'ACTIVE',
    stripeSubscriptionId: subscriptionId, // From Stripe
    startedAt: new Date(),
    endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
  },
});
```

### Get Company's Stripe Customer ID
```javascript
const company = await prisma.company_hqs.findUnique({
  where: { id: companyHQId },
  select: { stripeCustomerId: true },
});

// Use company.stripeCustomerId for Stripe API calls
```

---

## ✅ Deliverables Checklist

- [x] CompanyHQ model updated with `stripeCustomerId`
- [x] Plan model created
- [x] PlatformAccess model created
- [x] Foreign keys wired correctly
- [x] Enums added (PlanInterval, PlatformAccessStatus)
- [x] Indexes added for performance
- [x] Unique constraints on Stripe IDs
- [x] No extra abstractions (no Price table, no Subscription table)

---

## 🚀 Next Steps

1. **Run Migration:**
   ```bash
   npx prisma migrate dev --name add_billing_access_models
   ```

2. **Seed Plans:**
   - Create initial plans via seed script or admin UI
   - Set `stripeProductId` and `stripePriceId` from Stripe

3. **Platform Manager Integration:**
   - Platform manager will set rates (for now, seed them)
   - Create Plans via platform manager UI

4. **Access Logic:**
   - Update access checks to use `platform_accesses` table
   - Check `status === ACTIVE` and `endsAt > now()`

---

## 📝 Notes

- **Plans are immutable:** Price or interval change = new Plan row
- **Billing identity is company-scoped:** `stripeCustomerId` on CompanyHQ
- **Access is entitlement-scoped:** PlatformAccess is source of truth
- **Stripe enforces billing:** PlatformAccess enforces access
- **No overbuild:** Minimal models, no extra abstractions

---

## 🔗 Related Documents

- `INVOICE_SYSTEM_REFACTOR.md` - Invoice system refactor
- `STRIPE_PAYLOAD_FIELDS.md` - Stripe payload field mapping
- `CLIENT_PORTAL_CHECKOUT_ANALYSIS.md` - Checkout implementation

