# Invoice Model Shape & Plan Architecture

**Date:** 2025-01-28  
**Status:** Current Architecture

---

## 🎯 Overview

Invoices have been **freed from work packages** and are now **platform-managed**. The architecture follows a "bolt-on" pattern where **Plans are top-level** and companies can optionally attach to them.

---

## 📊 Model Hierarchy

### 1. **Plans** (Top-Level)
Plans define pricing packages that can be shared across multiple companies.

```prisma
model plans {
  id              String        @id
  name            String        // "Gold Tier – Annual"
  description     String?
  interval        PlanInterval? // "month" | "year" | null
  amountCents     Int           // Price in cents
  currency        String        @default("usd")
  stripeProductId String?
  stripePriceId   String?       @unique
  company_hqs     company_hqs[] // Many companies can use same plan
}
```

**Key Points:**
- ✅ **Top-level** - Plans exist independently
- ✅ **Shared** - One plan can be used by many companies
- ✅ **Pricing definition** - Defines amount, interval, Stripe IDs

---

### 2. **Company_HQs** (Bolt-On Pattern)
Companies can optionally "bolt on" a plan. The plan fields are **optional**, allowing companies to exist without a plan.

```prisma
model company_hqs {
  id                    String    @id
  companyName           String
  // ... other company fields ...
  
  // Plan & Access (BOLT-ON - all optional)
  planId                String?   // FK → Plan.id (optional!)
  planStatus            PlatformAccessStatus? // ACTIVE, PAST_DUE, CANCELED
  stripeSubscriptionId  String?   @unique
  planStartedAt         DateTime?
  planEndedAt           DateTime?
  
  plans                 plans?    @relation(fields: [planId], ...)
  invoices              invoices[] // Company-scoped invoices
}
```

**Key Points:**
- ✅ **Bolt-on capability** - `planId` is **optional**
- ✅ **Consolidated** - Plan access fields live directly on company (no separate `platform_accesses` table)
- ✅ **One plan at a time** - Company can have one active plan
- ✅ **Can exist without plan** - Company doesn't require a plan to exist

---

### 3. **Invoices** (Platform-Managed, Free from Work Packages)
Invoices are now **company-scoped** and **free from work packages**.

```prisma
model invoices {
  id                      String        @id
  companyHQId             String        // ✅ Required - company-scoped
  invoiceType             InvoiceType   // PLATFORM_FEE | MONTHLY_RECURRING | CUSTOM | WORK_PACKAGE
  invoiceName             String
  invoiceDescription      String?
  totalExpected           Int
  totalReceived           Int
  status                  InvoiceStatus // NOT_PAID | PAID | PARTIAL
  
  // Work Package (OPTIONAL - legacy support)
  workPackageId           String?       // ✅ Optional - was required before
  
  // Recurring fields
  isRecurring             Boolean?
  recurringFrequency      String?
  nextBillingDate         DateTime?
  lastBilledDate          DateTime?
  
  // Relations
  company_hqs             company_hqs   @relation(fields: [companyHQId], ...)
  work_packages           work_packages? @relation(fields: [workPackageId], ...)
}
```

**Key Points:**
- ✅ **Company-scoped** - `companyHQId` is required
- ✅ **Free from work packages** - `workPackageId` is **optional** (was required before)
- ✅ **Invoice types** - Can be Platform Fee, Monthly Recurring, Custom, or legacy Work Package
- ✅ **No direct planId** - Plan accessed via `company_hqs.planId`

---

## 🔗 Relationship Chain

### How to Get Plan from Invoice

```
invoices 
  → companyHQId (required)
    → company_hqs 
      → planId (optional - "bolt on")
        → plans (top-level)
```

**Example Query:**
```typescript
const invoice = await prisma.invoices.findUnique({
  where: { id: invoiceId },
  include: {
    company_hqs: {
      include: {
        plans: true // Get the plan if company has one
      }
    }
  }
});

// Access plan: invoice.company_hqs?.plans
```

---

## 📈 Evolution: Before → After

### Before (Work Package-Coupled)

```
work_packages (required)
  ↓
invoices (required workPackageId)
  ❌ No company scope
  ❌ No invoice types
  ❌ Cascade delete if work package deleted
```

**Problems:**
- ❌ Invoices couldn't exist without work packages
- ❌ No way to create platform-level invoices
- ❌ Tight coupling - deleting work package deleted invoice

---

### After (Platform-Managed, Bolt-On)

```
plans (top-level, shared)
  ↑
company_hqs (planId optional - "bolt on")
  ↓
invoices (company-scoped, workPackageId optional)
  ✅ Company-scoped
  ✅ Invoice types
  ✅ Can exist without work package
```

**Benefits:**
- ✅ Invoices can exist independently
- ✅ Platform-level invoices (PLATFORM_FEE, MONTHLY_RECURRING)
- ✅ Work package invoices still supported (legacy)
- ✅ Plans are reusable across companies
- ✅ Companies can exist without plans (free tier)

---

## 🎯 Invoice Types & Plan Relationship

### PLATFORM_FEE
- One-time onboarding/access fee
- Not tied to a plan (can be set via `invoice_settings.platformFeeAmount`)
- Company-scoped

### MONTHLY_RECURRING
- Monthly subscription charge
- Can be based on plan (`company_hqs.plans.amountCents`)
- Or custom amount (via `invoice_settings.monthlyRecurringAmount`)
- Company-scoped

### CUSTOM
- One-off custom invoices
- Not tied to plan or work package
- Company-scoped

### WORK_PACKAGE (Legacy)
- Migrated from old system
- `workPackageId` preserved for reference
- Company-scoped (via `companyHQId`)

---

## 💡 "Bolt-On" Pattern Explained

The **bolt-on pattern** means:

1. **Plans are independent** - They exist at the top level, not tied to companies
2. **Companies can attach** - `planId` on `company_hqs` is **optional**
3. **Flexible** - Company can exist without a plan (free tier, trial, etc.)
4. **Simple** - No separate `platform_accesses` table needed (was consolidated)
5. **One at a time** - Company has one active plan (or none)

**Why "Bolt-On"?**
- Plan is like a "package" that can be attached to any company
- Company doesn't require a plan to function
- Plan can be added/removed without affecting company core data

### Architecture Consolidation

**Before (More Complex):**
```
plans (pricing definition)
  ↓
platform_accesses (join table)
  - companyId → company_hqs
  - planId → plans
  - status, subscription, dates
  ↓
company_hqs
```

**After (Cleaner - Current):**
```
plans (pricing definition)
  ↑
company_hqs (planId optional - "bolt on")
  - planId → plans (direct FK)
  - planStatus, stripeSubscriptionId, dates (all on company_hqs)
```

**Why This is Cleaner:**
- ✅ **One less table** - No intermediate `platform_accesses` join table
- ✅ **Direct relationship** - `company_hqs.planId` → `plans.id`
- ✅ **All Stripe fields in one place** - Subscription, status, dates on company
- ✅ **Simpler queries** - No joins needed to get plan from company
- ✅ **"Bolt on" capability** - `planId` is optional, companies can exist without plans

**Note:** `stripePriceId` lives on the `plans` model (it's a Stripe concept for the price object), but the relationship is direct: `company_hqs.planId` → `plans.id`.

---

## 🔍 Key Schema Decisions

### Why No `planId` on Invoices?

**Current Design:**
- Invoice → Company → Plan (via relation)

**Alternative (Not Chosen):**
- Invoice → Plan (direct)

**Reason:**
- Invoice is tied to **company**, not directly to plan
- Company can change plans, but invoice should reference the company
- Historical invoices should reference company, not a specific plan snapshot
- Simpler - one less field to manage

**If you need plan from invoice:**
```typescript
const plan = invoice.company_hqs?.plans;
```

---

## 📝 Related Models

### `invoice_settings`
Company-level invoice configuration:
- `platformFeeAmount` (cents)
- `monthlyRecurringAmount` (cents)
- Invoice number generation
- Billing address, tax ID

**Relationship:**
```
company_hqs → invoice_settings (1:1)
```

### `invoice_templates`
Company-scoped invoice templates:
```
company_hqs → invoice_templates (1:many)
```

---

## 🚀 Usage Examples

### Create Platform Fee Invoice
```typescript
// Get company's invoice settings
const settings = await prisma.invoice_settings.findUnique({
  where: { companyHQId }
});

// Create invoice
const invoice = await prisma.invoices.create({
  data: {
    companyHQId,
    invoiceType: 'PLATFORM_FEE',
    totalExpected: settings.platformFeeAmount,
    // No workPackageId needed!
  }
});
```

### Create Monthly Recurring Invoice (Based on Plan)
```typescript
// Get company with plan
const company = await prisma.company_hqs.findUnique({
  where: { id: companyHQId },
  include: { plans: true }
});

// Create invoice based on plan
const invoice = await prisma.invoices.create({
  data: {
    companyHQId,
    invoiceType: 'MONTHLY_RECURRING',
    totalExpected: company.plans?.amountCents || 0,
    isRecurring: true,
    recurringFrequency: 'monthly',
    nextBillingDate: addMonths(new Date(), 1),
  }
});
```

### Check if Company Has Plan
```typescript
const company = await prisma.company_hqs.findUnique({
  where: { id: companyHQId },
  include: { plans: true }
});

if (company.planId && company.plans) {
  // Company has a plan "bolted on"
  console.log(`Company on plan: ${company.plans.name}`);
} else {
  // Company exists without plan (free tier, trial, etc.)
  console.log('Company has no plan');
}
```

---

## 📚 Related Documentation

- `docs/INVOICE_SYSTEM_REFACTOR.md` - Full refactor details
- `docs/INVOICE_REFACTOR_SUMMARY.md` - Migration summary
- `docs/PLATFORM_ACCESS_ANALYSIS.md` - Why platform_accesses was consolidated
- `docs/PLAN_CONSOLIDATION_PROPOSAL.md` - Bolt-on pattern rationale

---

## ✅ Summary

1. **Plans are top-level** - Shared pricing definitions
2. **Companies bolt on plans** - `planId` is optional on `company_hqs`
3. **Invoices are company-scoped** - `companyHQId` required
4. **Invoices are free from work packages** - `workPackageId` is optional
5. **No direct invoice → plan link** - Access plan via `invoice.company_hqs.plans`

