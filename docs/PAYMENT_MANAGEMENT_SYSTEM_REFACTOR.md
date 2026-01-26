# Payment Management System - Ignite BD
## Full System Architecture & Refactor Plan

**Status**: 🚧 **DEPRECATED INVOICE MODEL → SAAS MODEL MIGRATION**

---

## 🎯 System Overview

The payment management system has evolved from a traditional "invoice-based" model to a modern SaaS subscription model. This document outlines the complete architecture, current state, and migration path.

---

## 📊 System Flow

```
1. PLATFORM SETS PLANS
   ↓
2. PLANS → COMPANIES (Select or Seeded)
   ↓
3. BILLS GENERATED (Stripe Integration)
   ↓
4. PAYMENT STATUS DASHBOARD (Platform View)
```

---

## 1️⃣ PLATFORM SETS PLANS

### Current State
- **Location**: Platform Manager (`/platform/pricing`)
- **What it does**: SuperAdmin sets pricing per company (Platform Fee, Monthly Recurring)
- **Model**: `invoice_settings` (per company)

### What We Need: Plan Management UX
**The invoices page was supposed to be this!**

#### Plan Creation Flow
1. **SuperAdmin creates plans** in Platform Manager
   - Plan name, description
   - Amount (cents), currency
   - Billing interval (MONTH, YEAR, or one-time)
   - Stripe product/price IDs (optional - can be created on first use)

2. **Plans are top-level** (not company-scoped)
   - Plans exist independently
   - Companies "bolt on" to plans via `company_hqs.planId`

#### Current Plan Model
```prisma
model plans {
  id              String        @id @default(cuid())
  name            String
  description     String?
  amountCents     Int
  currency        String        @default("USD")
  interval        String?        // MONTH, YEAR, or null (one-time)
  stripeProductId String?
  stripePriceId   String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  company_hqs     company_hqs[] // Many companies can use same plan
}
```

#### Plan Management UX Requirements
- **List Plans** (`/platform/plans`)
  - Show all plans
  - Filter by interval, status
  - Edit/Delete plans
  - See which companies are using each plan

- **Create/Edit Plan** (`/platform/plans/new`, `/platform/plans/[id]/edit`)
  - Form: name, description, amount, currency, interval
  - Optional: Stripe product/price IDs
  - Preview: What companies will see

- **Plan Details** (`/platform/plans/[id]`)
  - Plan info
  - List of companies using this plan
  - Usage stats

---

## 2️⃣ PLANS → COMPANIES (Select or Seeded)

### Current State
- Companies have `planId` on `company_hqs` model
- Plans are "bolted on" - optional relationship
- `planStatus`: ACTIVE, PAST_DUE, CANCELED

### How Plans Get to Companies

#### Option A: Company Selects Plan
1. Company owner goes to `/settings/billing`
2. Sees available plans
3. Selects a plan
4. `company_hqs.planId` is set
5. Stripe checkout session created

#### Option B: Plan is Seeded/Assigned
1. SuperAdmin assigns plan to company
2. `company_hqs.planId` is set directly
3. Company sees their plan in billing settings
4. Payment flow initiated when they click "Pay"

### Investigation Needed
- **Where do companies see/select plans?**
  - Currently: `/settings/billing` shows their current plan
  - Missing: Plan selection UI (browse available plans)
  
- **How are plans seeded?**
  - SuperAdmin can set `planId` on company?
  - API endpoint for assigning plans?
  - Bulk assignment?

### Company Plan Assignment Flow
```
SuperAdmin → Platform Manager → Assign Plan to Company
  ↓
company_hqs.planId = planId
  ↓
Company sees plan in /settings/billing
  ↓
Company clicks "Pay" → Stripe checkout
```

---

## 3️⃣ BILLS GENERATED (Stripe Integration)

### Current State
- **Deprecated**: Old `invoice` model (work-package-scoped)
- **New Model**: `invoices` model (company-scoped, but also deprecated for SaaS model)
- **Current Flow**: Plans → Stripe Checkout → Webhook updates `company_hqs.planStatus`

### The Problem
The old invoice model was for:
- Work package invoices
- One-time payments
- Custom billing

But we're moving to SaaS model:
- **Recurring subscriptions** (monthly/yearly)
- **Platform fees** (handled by Stripe subscriptions)
- **No separate invoice records needed** - Stripe handles it

### New SaaS Billing Flow

#### Subscription-Based (Recurring Plans)
1. Company selects plan with `interval: MONTH` or `YEAR`
2. Stripe checkout session created (subscription mode)
3. User pays → Stripe webhook fires
4. Webhook updates:
   - `company_hqs.planStatus = 'ACTIVE'`
   - `company_hqs.stripeSubscriptionId = subscription.id`
   - `company_hqs.planStartedAt = now()`

#### One-Time Payment (No Interval)
1. Company selects plan with `interval: null`
2. Stripe checkout session created (payment mode)
3. User pays → Stripe webhook fires
4. Webhook updates:
   - `company_hqs.planStatus = 'ACTIVE'`
   - `company_hqs.planStartedAt = now()`
   - No subscription ID (one-time)

### Stripe Integration Points

#### Checkout Session Creation
**Endpoint**: `POST /api/stripe/checkout`
- Uses `planId` to get plan details
- Creates Stripe checkout session
- Returns session URL for redirect

#### Webhook Handlers
**Endpoint**: `POST /api/stripe/webhook`
- `checkout.session.completed` → Set planStatus = ACTIVE
- `invoice.paid` → Keep planStatus = ACTIVE
- `invoice.payment_failed` → Set planStatus = PAST_DUE
- `customer.subscription.updated` → Update planStatus
- `customer.subscription.deleted` → Set planStatus = CANCELED

### What About "Bills"?
In SaaS model, **Stripe IS the bill**:
- Stripe generates invoices automatically for subscriptions
- Stripe sends webhooks when payments succeed/fail
- We don't need separate `invoices` records for recurring subscriptions

**Exception**: Custom one-time bills might still need `invoices` records, but that's edge case.

---

## 4️⃣ PAYMENT STATUS DASHBOARD (Platform View)

### Current State
- **Location**: `/platform/invoices` (misnamed - should be `/platform/payments`)
- **What it shows**: List of invoices (deprecated model)
- **Problem**: Using old invoice model, not SaaS payment status

### What It Should Be: Payment Status Dashboard

#### Dashboard View (`/platform/payments`)
Shows payment status for all companies in the platform:

**Columns:**
- Company Name
- Plan Name
- Plan Status (ACTIVE, PAST_DUE, CANCELED)
- Amount (from plan)
- Billing Interval
- Last Payment Date
- Next Billing Date (for recurring)
- Stripe Subscription ID
- Actions (View Details, Cancel, etc.)

**Filters:**
- Plan Status
- Plan Name
- Company Name
- Date Range

**Data Source:**
```sql
SELECT 
  company_hqs.id,
  company_hqs.companyName,
  company_hqs.planStatus,
  company_hqs.planStartedAt,
  company_hqs.planEndedAt,
  company_hqs.stripeSubscriptionId,
  plans.name AS planName,
  plans.amountCents,
  plans.currency,
  plans.interval
FROM company_hqs
LEFT JOIN plans ON company_hqs.planId = plans.id
WHERE company_hqs.platformId = ?
ORDER BY company_hqs.companyName
```

#### Company Payment Details (`/platform/payments/[companyId]`)
- Company info
- Current plan details
- Payment history (from Stripe webhooks - might need to store)
- Subscription status
- Actions: Change plan, Cancel subscription, etc.

### Why Not "Invoices"?
**Old Model (Deprecated):**
- Invoice = Bill = Payment record
- One invoice per work package
- Manual invoice creation
- Invoice status tracking

**New SaaS Model:**
- Plan = Subscription = Recurring billing
- Stripe handles invoices automatically
- Payment status = Subscription status
- No manual invoice creation needed

**Exception**: Custom one-time bills might still use `invoices` model, but that's not the primary flow.

---

## 🔄 Migration Path

### Phase 1: Plan Management UX 🚧 (Needs Investigation)
**Current State:**
- ✅ `/platform/pricing` exists (but uses `invoice_settings` - per company)
- ✅ `/platform/payments` exists (payment status dashboard)
- ✅ `/api/platform/plans` proxy route exists
- ❓ Need to check if `/platform/plans` page exists
- ❓ Need to check if plan CRUD endpoints exist in IgniteBd-Next-combine

**What We Need:**
- [ ] Create `/platform/plans` page (list all plans)
- [ ] Create `/platform/plans/new` page (create plan)
- [ ] Create `/platform/plans/[id]` detail page (view/edit plan)
- [ ] Create `/platform/plans/[id]/edit` page
- [ ] List all plans with usage stats
- [ ] Edit/Delete plans
- [ ] See which companies use each plan
- [ ] **This is what the invoices page was supposed to be!**

### Phase 2: Payment Status Dashboard ✅ (Exists, Needs Refactor)
**Current State:**
- ✅ `/platform/payments` page exists
- ✅ `/platform/invoices` page exists (deprecated - should redirect or be removed)
- ❓ Need to check if it uses `company_hqs` + `plans` or deprecated `invoices` model

**What We Need:**
- [ ] Audit `/platform/payments` - does it use correct models?
- [ ] Update to show `company_hqs` + `plans` data (not invoices)
- [ ] Remove dependency on deprecated `invoices` model
- [ ] Add filters: Plan Status, Plan Name, Company Name
- [ ] Add company payment detail view (`/platform/payments/[companyId]`)
- [ ] Show Stripe subscription status
- [ ] Show next billing date for recurring plans

### Phase 3: Company Plan Selection 🔜 (Needs Investigation)
**Current State:**
- ✅ `/settings/billing` page exists (shows current plan)
- ✅ Plan display works (shows plan from `company_hqs.planId`)
- ❓ Can companies browse/select plans?
- ❓ How are plans assigned to companies?

**What We Need:**
- [ ] Investigate: How do companies get plans assigned?
  - SuperAdmin assigns via platform?
  - Company selects from list?
  - Seeded on company creation?
- [ ] Create plan browsing UI in `/settings/billing`
- [ ] Allow companies to select/change plans
- [ ] Handle plan changes (prorate, cancel old subscription, etc.)
- [ ] API endpoint for assigning plans to companies

### Phase 4: Cleanup 🗑️
- [ ] Mark `invoices` model as deprecated
- [ ] Document when to use `invoices` vs. plans
- [ ] Migrate any remaining invoice-based flows

---

## 📋 Data Model Summary

### Active Models (SaaS)
```prisma
// Top-level plans
model plans {
  id              String
  name            String
  amountCents     Int
  currency        String
  interval        String? // MONTH, YEAR, null
  stripeProductId String?
  stripePriceId   String?
  company_hqs     company_hqs[]
}

// Company plan assignment
model company_hqs {
  id                  String
  planId              String? // FK → plans.id
  planStatus          PlatformAccessStatus? // ACTIVE, PAST_DUE, CANCELED
  stripeSubscriptionId String?
  planStartedAt       DateTime?
  planEndedAt         DateTime?
  plans               plans?
}
```

### Deprecated Models (Legacy)
```prisma
// ❌ DEPRECATED: Old invoice model (work-package-scoped)
model invoice {
  workPackageId String
  // ... old fields
}

// ⚠️ PARTIALLY DEPRECATED: New invoices model (company-scoped)
// Still used for custom one-time bills, but not for SaaS subscriptions
model invoices {
  companyHQId String
  invoiceType InvoiceType
  // ... fields
}
```

---

## 🎯 Key Decisions

1. **Plans are top-level** - Not company-scoped
2. **Companies bolt on to plans** - `company_hqs.planId` is optional
3. **Stripe is the source of truth** - For recurring subscriptions
4. **Payment status = Subscription status** - No separate invoice tracking needed
5. **Old invoice model is deprecated** - Only use for custom one-time bills

---

## 📝 Next Steps (Priority Order)

### 1. **Investigate Current State** 🔍
   - [ ] Check if `/platform/plans` page exists
   - [ ] Check if plan CRUD API endpoints exist (`/api/plans`)
   - [ ] Audit `/platform/payments` - what models does it use?
   - [ ] Audit `/platform/pricing` - is this the right approach?
   - [ ] Check how plans are currently assigned to companies

### 2. **Create Plan Management UX** (`/platform/plans`) 🎯
   - **This is what the invoices page was supposed to be!**
   - List all plans with usage stats
   - Create new plans
   - Edit/Delete plans
   - See which companies use each plan
   - Plan detail view

### 3. **Refactor Payment Dashboard** (`/platform/payments`) 🔄
   - Update to show `company_hqs` + `plans` data (not invoices)
   - Remove dependency on deprecated `invoices` model
   - Add filters: Plan Status, Plan Name, Company
   - Add company payment detail view
   - Show Stripe subscription status

### 4. **Investigate Plan Assignment** 🔍
   - How do companies select plans?
   - How are plans seeded/assigned?
   - Create UI for plan selection in `/settings/billing`
   - API endpoint for assigning plans to companies

### 5. **Document Edge Cases** 📚
   - When to use `invoices` model (custom one-time bills)
   - When to use plans (SaaS subscriptions)
   - Migration strategy for existing invoices
   - Handle legacy invoice data

## 🔍 Investigation Checklist

### Plan Management
- [x] Does `/api/plans` endpoint exist in IgniteBd-Next-combine? ✅ **YES** - `app/api/plans/route.ts`
- [ ] Does `/platform/plans` page exist in platform-manager?
- [ ] Can SuperAdmin create/edit/delete plans?
- [ ] Can SuperAdmin see which companies use each plan?

**Current State:**
- ✅ `/api/platform/plans` proxy route exists (platform-manager)
- ✅ `/api/plans` endpoint exists (IgniteBd-Next-combine)
- ❓ `/platform/plans` page - **NEEDS CHECK**

### Plan Assignment
- [ ] How are plans assigned to companies?
- [ ] Is there an API endpoint for assigning plans?
- [ ] Can companies select their own plans?
- [ ] Are plans seeded on company creation?

### Payment Dashboard
- [x] What data does `/platform/payments` show? ✅ **Shows companies with plan status**
- [x] Does it use `company_hqs` + `plans` or `invoices`? ✅ **Uses `company_hqs` data (correct!)**
- [x] Is it platform-scoped? ✅ **Yes - uses `/api/platform/companies`**
- [x] Does it show Stripe subscription status? ✅ **Shows planStatus, stripeSubscriptionId**

**Current State:**
- ✅ `/platform/payments` exists and uses correct models
- ✅ Shows: Company, Plan Name, Plan Status, Stripe Subscription ID
- ✅ Platform-scoped (only shows companies in SuperAdmin's platform)
- ⚠️ **BUT**: Still has `/platform/invoices` page (deprecated - should be removed/redirected)

### Current Pricing Page
- [ ] What does `/platform/pricing` do?
- [ ] Does it use `invoice_settings` (per company)?
- [ ] Should this be replaced with plan management?

---

## 🔗 Related Documents

- `PLANID_VS_INVOICE_ANALYSIS.md` - Plan vs Invoice model comparison
- `CHECKOUT_UX_FLOW.md` - Checkout flow documentation
- `INVOICE_MODEL_SHAPE.md` - Invoice model architecture
- `INVOICES_PAGE_AUDIT.md` - Current invoices page audit

---

---

## 📊 Current State Summary

### ✅ What Exists
1. **Plans API** (`/api/plans`)
   - ✅ GET: List all plans
   - ✅ POST: Create plan
   - ✅ Proxy route in platform-manager (`/api/platform/plans`)

2. **Payment Dashboard** (`/platform/payments`)
   - ✅ Shows companies with plan status
   - ✅ Uses `company_hqs` + `plans` (correct models!)
   - ✅ Platform-scoped
   - ✅ Shows Stripe subscription status

3. **Company Billing** (`/settings/billing`)
   - ✅ Shows current plan
   - ✅ Pay button → Stripe checkout
   - ✅ Uses `planId` for billing

4. **Stripe Integration**
   - ✅ Checkout session creation
   - ✅ Webhook handlers
   - ✅ Updates `company_hqs.planStatus`

### ❌ What's Missing
1. **Plan Management UX** (`/platform/plans`)
   - ❌ **THIS IS WHAT THE INVOICES PAGE WAS SUPPOSED TO BE!**
   - ❌ No UI to list/create/edit/delete plans
   - ❌ No way to see which companies use each plan

2. **Plan Assignment**
   - ❌ No UI for SuperAdmin to assign plans to companies
   - ❌ No UI for companies to browse/select plans
   - ❌ Unclear how plans get assigned (seeded? manual?)

3. **Deprecated Pages**
   - ⚠️ `/platform/invoices` still exists (should redirect to `/platform/payments`)
   - ⚠️ `/platform/pricing` uses `invoice_settings` (should use plans instead?)

---

## 🎯 Immediate Action Items

### Priority 1: Create Plan Management UX
**This is the missing piece!**

Create `/platform/plans` page with:
- List all plans
- Create new plan
- Edit plan
- Delete plan
- See which companies use each plan
- Plan usage stats

**This replaces the need for the invoices page for plan management.**

### Priority 2: Investigate Plan Assignment
- How are plans currently assigned?
- Create UI for SuperAdmin to assign plans
- Create UI for companies to select plans

### Priority 3: Clean Up Deprecated
- Remove or redirect `/platform/invoices`
- Update `/platform/pricing` to use plans (if needed)
- Document when to use `invoices` vs `plans`

---

**Last Updated**: 2025-01-28
**Status**: 🚧 Active Refactor - Plan Management UX Missing

