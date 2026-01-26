# planId vs Invoice: Frontend Display vs Stripe Payment

**Date:** 2025-01-28  
**Purpose:** Clarify the distinction between `planId` (pricing display) and `invoices` (actual Stripe payment)

---

## 🎯 Key Distinction

### 1. **planId** = Billing Source of Truth (What You Pay)
- **Purpose:** Defines what the company pays - the actual billing
- **Who writes:** Platform Manager (SuperAdmin) sets the plan
- **Where:** `company_hqs.planId` → `plans.id`
- **What it contains:** All billing data (amountCents, interval, currency, stripePriceId)
- **This IS the billing** - Not just display, this is what gets charged

### 2. **Invoice Model** = DEPRECATED ❌
- **Status:** Invoice model is deprecated and should be dropped
- **Why:** planId + plans table has all the billing data needed
- **Replacement:** Use planId for billing, Stripe handles payment tracking

---

## 📊 Model Breakdown

### Plans (Pricing Definition)
```prisma
model plans {
  id              String        @id
  name            String        // "Gold Tier – Annual"
  amountCents     Int           // 50000 (for $500)
  interval        PlanInterval? // "month" | "year"
  currency        String        @default("usd")
  stripeProductId String?      // prod_... (Stripe product)
  stripePriceId   String?       @unique // price_... (Stripe price)
  company_hqs     company_hqs[] // Companies using this plan
}
```

**What Platform Manager Does:**
- Creates Plan (billing definition)
- Sets `amountCents`, `interval`, `name`
- Links to Stripe product/price (`stripePriceId`)
- **This IS the billing - this is what gets charged**

---

### Company_HQs (Bolt-On Plan Reference)
```prisma
model company_hqs {
  id                    String    @id
  companyName           String
  planId                String?   // FK → Plan.id (optional - "bolt on")
  planStatus            PlatformAccessStatus? // ACTIVE, PAST_DUE, CANCELED
  stripeSubscriptionId  String?   @unique // sub_... (from Stripe)
  planStartedAt         DateTime?
  planEndedAt           DateTime?
  plans                 plans?    @relation(...)
  invoices              invoices[] // Actual payments
}
```

**What `planId` Does:**
- ✅ **Billing source of truth** - This IS what gets charged
- ✅ **Contains all billing data** - amountCents, interval, currency, stripePriceId
- ✅ **Used for checkout** - Stripe checkout uses plan data
- ✅ **Foreign key** - Clean relationship (allows FK constraint)
- ✅ **The payable** - This is what you pay for

**Why Platform Manager Writes to planId:**
- Cleaner for foreign key constraint
- Direct relationship: `company_hqs.planId` → `plans.id`
- Allows querying: "Show me all companies on Gold Tier plan"

---

### Invoices Model = DEPRECATED ❌
**Status:** Invoice model is deprecated - should be dropped to avoid confusion

**Why planId is sufficient:**
- ✅ Plan has all billing data (`amountCents`, `interval`, `currency`)
- ✅ Plan has Stripe IDs (`stripePriceId`, `stripeProductId`)
- ✅ Stripe handles payment tracking (via webhooks)
- ✅ `company_hqs` tracks payment status (`planStatus`, `stripeSubscriptionId`)
- ❌ Invoice model adds unnecessary complexity

---

## 🔄 Complete Flow

### Step 1: Platform Manager Sets Pricing
```
Platform Manager (SuperAdmin)
  → Creates Plan
  → Writes to `plans` table
  → Plan has: name, amountCents, interval
  → This is just pricing definition
```

### Step 2: Company Gets planId (Display Reference)
```
System or Owner
  → Sets `company_hqs.planId` = plan.id
  → This is for frontend display
  → Shows: "You're on Gold Tier - $500/month"
  → NOT a payment yet
```

### Step 3: Payment Initiated → Checkout from Plan
```
Owner clicks "Pay Now"
  → System reads company_hqs.planId
  → Fetches plans data (amountCents, interval, stripePriceId)
  → Creates Stripe checkout session using plan data
  → Uses plans.stripePriceId (if exists) or creates price_data from plan
  → User redirected to Stripe checkout
```

### Step 4: Stripe Webhook Updates Company Status
```
Stripe processes payment
  → Stripe sends webhook: checkout.session.completed
  → Webhook handler: /api/stripe/webhook
  → Extracts companyHQId from session.metadata
  → Updates company_hqs:
     - planStatus = 'ACTIVE'
     - stripeSubscriptionId = session.subscription (if subscription)
     - planStartedAt = now()
  → No invoice needed - planId is the billing source
```

---

## 🎯 Why This Architecture?

### planId = Billing Source of Truth

**planId IS the billing:**
- ✅ Contains all billing data (amountCents, interval, currency)
- ✅ Has Stripe IDs (stripePriceId, stripeProductId)
- ✅ Used directly for Stripe checkout
- ✅ Foreign key constraint (clean relationship)
- ✅ Querying - "Show all companies on Gold Tier"
- ✅ **This is what gets charged** - Not just display

**Why No Invoice Model?**
- ❌ Invoice model is deprecated - adds unnecessary complexity
- ✅ Stripe handles payment tracking (via webhooks)
- ✅ `company_hqs` tracks payment status (planStatus, stripeSubscriptionId)
- ✅ Plan has all the data needed for billing
- ✅ Simpler architecture - one source of truth (planId)

---

## 📋 Stripe Webhook Flow

### Webhook Handler: `/api/stripe/webhook`

**Events Handled:**
1. `checkout.session.completed` - Payment completed
2. `invoice.paid` - Subscription invoice paid
3. `invoice.payment_failed` - Payment failed
4. `customer.subscription.updated` - Subscription changed
5. `customer.subscription.deleted` - Subscription canceled

**How It Works:**
```typescript
// Stripe sends webhook
POST /api/stripe/webhook
  → Verifies Stripe signature
  → Switches on event.type
  → Finds invoice by stripeCheckoutSessionId
  → Updates invoice.status = PAID
  → Updates invoice.totalReceived
  → Updates invoice.paidAt
```

**Key Point:** Webhook is **authoritative** - Stripe tells us payment status, we update invoice.

---

## 🔍 Example Scenario

### Company on Gold Tier Plan

**1. Platform Manager Creates Plan:**
```typescript
Plan {
  id: "plan-gold-001",
  name: "Gold Tier – Monthly",
  amountCents: 50000, // $500
  interval: "month"
}
```

**2. Company Gets planId:**
```typescript
company_hqs {
  id: "company-123",
  planId: "plan-gold-001", // ← Billing source (what they pay)
  planStatus: null // Not active yet
}
```

**Frontend shows:** "You're on Gold Tier - $500/month" (from plan data)

**3. Owner Clicks "Pay Now":**
```typescript
// System reads planId and fetches plan
const plan = await prisma.plans.findUnique({
  where: { id: company.planId }
});

// Creates Stripe checkout using plan data
const session = await createCheckoutSession({
  company: company,
  plan: {
    id: plan.id,
    amountCents: plan.amountCents, // 50000
    interval: plan.interval, // "month"
    currency: plan.currency,
    stripePriceId: plan.stripePriceId, // Used if exists
  },
  successUrl: "..."
});
// Returns: { sessionId: "cs_abc123", clientSecret: "..." }
```

**4. Stripe Processes Payment:**
```typescript
// Stripe webhook fires
checkout.session.completed {
  sessionId: "cs_abc123",
  subscription: "sub_123", // If subscription
  metadata: {
    companyHQId: "company-123",
    planId: "plan-gold-001"
  }
}

// Webhook updates company_hqs directly (no invoice)
await prisma.company_hqs.update({
  where: { id: "company-123" },
  data: {
    planStatus: "ACTIVE", // ← Updated by webhook
    stripeSubscriptionId: "sub_123",
    planStartedAt: new Date(),
  }
});
```

**5. Company Status Updated:**
```typescript
company_hqs {
  id: "company-123",
  planId: "plan-gold-001", // Still shows Gold Tier (billing source)
  planStatus: "ACTIVE", // ← Updated by webhook
  stripeSubscriptionId: "sub_123" // From Stripe
}
```

---

## ✅ Summary

| Aspect | planId (Billing Source) | Invoice Model |
|--------|------------------------|---------------|
| **Purpose** | **Billing definition** - What you pay | ❌ **DEPRECATED** |
| **Who writes** | Platform Manager | N/A |
| **What it contains** | amountCents, interval, currency, stripePriceId | N/A |
| **Stripe integration** | ✅ Required (`stripePriceId`) | N/A |
| **Used for checkout** | ✅ Yes - direct billing | ❌ No |
| **Payment tracking** | Via `company_hqs.planStatus` | ❌ Deprecated |
| **Foreign key** | Yes (`company_hqs.planId` → `plans.id`) | N/A |
| **Status** | ✅ **Active - This IS the billing** | ❌ **Deprecated - Drop it** |

**Key Takeaway:**
- **planId** = Billing source of truth (has all data needed - amountCents, interval, stripePriceId)
- **planId IS the billing** - Not just display, this is what gets charged
- **Invoice model** = Deprecated (should be dropped to avoid confusion)
- **Stripe** = Handles payment processing (webhooks update company_hqs)
- **company_hqs** = Tracks payment status (planStatus, stripeSubscriptionId)

---

## 🔗 Related Documentation

- `docs/INVOICE_MODEL_SHAPE.md` - Full invoice model architecture
- `docs/STRIPE_WEBHOOK_IMPLEMENTATION.md` - Webhook handler details
- `app/api/stripe/webhook/route.ts` - Webhook implementation

