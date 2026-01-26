# Checkout UX Flow - Settings → Billing → Pay

**Date:** 2025-01-28  
**Status:** 🟡 In Progress (Reconciliation not implemented yet)

---

## 🎯 User Flow

### 1. Settings → Billing
**Path:** `/settings/billing`

User navigates to Settings, clicks on "Billing" section.

---

### 2. See "This Month" Bill
**What displays:**
- Current plan name (from `company_hqs.planId` → `plans.name`)
- Amount due (from `plans.amountCents`)
- Billing interval (monthly/yearly from `plans.interval`)
- Current status (`company_hqs.planStatus` - ACTIVE, PAST_DUE, CANCELED)
- "This month" = current billing period

**API Call:**
```typescript
GET /api/company/hydrate?companyHQId={companyHQId}
// OR
GET /api/platform/companies/{companyId}
```

**Response includes:**
```typescript
{
  company: {
    id: string,
    companyName: string,
    planId: string | null,
    planStatus: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | null,
    plans: {
      id: string,
      name: string,
      amountCents: number,
      currency: string,
      interval: 'MONTH' | 'YEAR' | null
    } | null
  }
}
```

**Frontend displays:**
- Plan name: `company.plans?.name || "No plan selected"`
- Amount: `$${(company.plans?.amountCents || 0) / 100}`
- Interval: `company.plans?.interval === 'MONTH' ? 'Monthly' : 'Annual'`
- Status: `company.planStatus || 'No active plan'`

---

### 3. Hydrate Plan by Company Scope
**What happens:**
- Frontend calls API with `companyHQId` (from localStorage or auth context)
- API fetches `company_hqs` with `plans` relation
- Returns company + plan data

**Code:**
```typescript
// Frontend
const companyHQId = localStorage.getItem('companyHQId');
const response = await api.get(`/api/platform/companies/${companyHQId}`);
const { company } = response.data;

// company.plans contains the plan details
// company.planStatus contains current status
```

**Backend (already exists):**
- `GET /api/platform/companies/[id]` - Returns company with plan
- Includes `plans` relation via Prisma include

---

### 4. Pay Button
**When shown:**
- If `company.planStatus !== 'ACTIVE'` OR
- If `company.planStatus === null` (no plan yet) OR
- If `company.planStatus === 'PAST_DUE'`

**Button text:**
- "Pay Now" (if plan exists)
- "Subscribe" (if no plan selected)

**On click:**
- Calls checkout API
- Creates Stripe checkout session
- Redirects to Stripe checkout

---

### 5. Create Checkout Session
**API Endpoint:**
```typescript
POST /api/stripe/checkout
```

**Request:**
```typescript
{
  companyHQId: string,
  planId: string, // From company.plans.id
  successUrl: string // e.g., "/settings/billing?success=true"
}
```

**Backend Flow:**
1. Fetch `company_hqs` by `companyHQId`
2. Fetch `plans` by `planId`
3. Get or create Stripe customer (`getOrCreateStripeCustomer`)
4. Create Stripe checkout session using `createCheckoutSession()`
5. Return session ID and client secret

**Code (lib/stripe/checkout.ts):**
```typescript
export async function createCheckoutSession({
  company,
  plan,
  successUrl,
}: {
  company: CompanyHQ;
  plan: Plan;
  successUrl: string;
}) {
  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer(company);

  // Determine mode: subscription if interval exists, payment if one-time
  const mode: 'subscription' | 'payment' = plan.interval ? 'subscription' : 'payment';

  // Build line items
  const lineItems = [{
    price_data: {
      currency: plan.currency,
      product_data: { name: plan.name },
      unit_amount: plan.amountCents,
      ...(plan.interval && {
        recurring: {
          interval: plan.interval.toLowerCase() as 'month' | 'year',
        },
      }),
    },
    quantity: 1,
  }];

  // Create checkout session
  return stripe.checkout.sessions.create({
    mode,
    ui_mode: 'embedded', // Embedded checkout
    customer: customerId,
    line_items: lineItems,
    return_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    metadata: {
      companyHQId: company.id,
      planId: plan.id,
    },
  });
}
```

**Response:**
```typescript
{
  sessionId: string, // cs_...
  clientSecret: string, // For embedded checkout
  url: string // For redirect checkout
}
```

---

### 6. Fill with Stripe IDs
**What gets stored:**
- `stripeCheckoutSessionId` - Stored on... **WHERE?** (Not on invoice - invoice is deprecated)
- `stripeCustomerId` - Already on `company_hqs.stripeCustomerId`
- `stripeSubscriptionId` - Will be set by webhook after payment

**Current State:**
- ✅ `company_hqs.stripeCustomerId` - Set by `getOrCreateStripeCustomer()`
- ✅ `company_hqs.planId` - Already set (reference to plan)
- ⚠️ `stripeCheckoutSessionId` - **NEEDS TO BE STORED SOMEWHERE** (not on invoice)
- ⚠️ `stripeSubscriptionId` - Set by webhook after payment

**Question:** Where do we store `stripeCheckoutSessionId`?
- Option 1: Add to `company_hqs` (temporary, cleared after payment)
- Option 2: Create a `checkout_sessions` table (track all checkout attempts)
- Option 3: Don't store it (webhook uses metadata to find company)

**Recommendation:** Option 3 - Use metadata in checkout session. Webhook can find company by `companyHQId` in metadata.

---

### 7. User Pays
**Stripe Checkout:**
- User enters payment info
- Stripe processes payment
- On success: Stripe sends webhook

**Webhook Event:**
- `checkout.session.completed` - Payment completed
- `invoice.paid` - Subscription invoice paid (if subscription)

---

### 8. Reconciliation (NOT IMPLEMENTED YET)
**What needs to happen:**
1. Webhook receives `checkout.session.completed`
2. Extract `companyHQId` and `planId` from session metadata
3. Update `company_hqs`:
   - `planStatus = 'ACTIVE'`
   - `stripeSubscriptionId = session.subscription` (if subscription)
   - `planStartedAt = now()`
4. **Track payment** - But where? (Invoice is deprecated)

**Current Webhook (app/api/stripe/webhook/route.ts):**
- Handles `checkout.session.completed`
- But references `platform_accesses` (deprecated - was consolidated)
- Needs update to use `company_hqs` directly

**What's Missing:**
- ❌ Payment tracking (invoice deprecated)
- ❌ Webhook updates `company_hqs` directly (currently uses platform_accesses)
- ❌ "This month" bill calculation (needs to know what was paid this month)

---

## 📋 Implementation Checklist

### Frontend (Settings → Billing Page)
- [ ] Create `/settings/billing` page
- [ ] Fetch company + plan data (`GET /api/platform/companies/{id}`)
- [ ] Display "This month" bill:
  - Plan name
  - Amount due
  - Billing interval
  - Current status
- [ ] Show "Pay" button if not ACTIVE
- [ ] On Pay click: Call `POST /api/stripe/checkout`
- [ ] Handle Stripe embedded checkout or redirect

### Backend (Checkout API)
- [ ] Create `POST /api/stripe/checkout` endpoint
- [ ] Fetch company by `companyHQId`
- [ ] Fetch plan by `planId`
- [ ] Get/create Stripe customer
- [ ] Create checkout session using `createCheckoutSession()`
- [ ] Return session ID and client secret

### Backend (Webhook - Reconciliation)
- [ ] Update webhook to use `company_hqs` (not platform_accesses)
- [ ] On `checkout.session.completed`:
  - Extract `companyHQId` from metadata
  - Update `company_hqs.planStatus = 'ACTIVE'`
  - Update `company_hqs.stripeSubscriptionId` (if subscription)
  - Update `company_hqs.planStartedAt = now()`
- [ ] On `invoice.paid`:
  - Find company by `stripeSubscriptionId`
  - Update `company_hqs.planStatus = 'ACTIVE'`
- [ ] **Payment tracking** - Decide where to store payment history (invoice deprecated)

---

## 🔍 Key Questions

1. **Where to store `stripeCheckoutSessionId`?**
   - Answer: Don't need to - webhook uses metadata

2. **Where to track payment history?**
   - Invoice model is deprecated
   - Options:
     - Create `payments` table (simple, just payment records)
     - Use Stripe API to query payment history
     - Add payment tracking to `company_hqs` (limited history)

3. **How to calculate "This month" bill?**
   - If monthly: `plans.amountCents`
   - If yearly: `plans.amountCents / 12` (pro-rated?)
   - Need to know: What was paid this month? (Requires payment tracking)

4. **What happens if user changes plan mid-cycle?**
   - Stripe handles proration
   - Webhook updates `company_hqs.planId`?
   - Need to track plan changes

---

## 🚀 Next Steps

1. **Create billing page** (`/settings/billing`)
2. **Create checkout API** (`POST /api/stripe/checkout`)
3. **Update webhook** to use `company_hqs` directly
4. **Decide on payment tracking** (new table or Stripe API)
5. **Implement "This month" calculation** (requires payment history)

---

## 📝 Related Files

- `lib/stripe/checkout.ts` - Checkout session creation
- `lib/stripe/customer.ts` - Customer creation
- `app/api/stripe/webhook/route.ts` - Webhook handler (needs update)
- `app/api/platform/companies/[id]/route.ts` - Company + plan fetch
- `prisma/schema.prisma` - `company_hqs` model with plan fields


