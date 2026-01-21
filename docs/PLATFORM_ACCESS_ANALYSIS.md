# PlatformAccess vs planId Analysis

**Question:** Does PlatformAccess give us anything more than just `planId` on `company_hqs`?

---

## Current PlatformAccess Fields

```prisma
model platform_accesses {
  id                   String
  companyId            String  // FK → CompanyHQ
  planId               String  // FK → Plan
  status               PlatformAccessStatus  // ACTIVE, PAST_DUE, CANCELED
  stripeSubscriptionId String?  // Stripe subscription link
  startedAt            DateTime
  endedAt              DateTime?
  name                 String?
}
```

---

## What PlatformAccess Provides

### 1. Status Tracking
- `ACTIVE` - Company has active access
- `PAST_DUE` - Payment failed, access suspended
- `CANCELED` - Subscription canceled

**Used by:** Stripe webhook to update access based on payment status

### 2. Stripe Subscription Link
- `stripeSubscriptionId` - Links to Stripe subscription
- Used by webhook to find which company to update

### 3. Access Period
- `startedAt`, `endedAt` - When access started/ends
- For recurring plans, tracks subscription period

### 4. History (Potentially)
- Multiple PlatformAccess records = history of plan changes
- But unique constraint `@@unique([companyId, planId])` prevents multiple of same plan

---

## Alternative: Just planId on company_hqs

**What we'd need on company_hqs:**
```prisma
model company_hqs {
  // ... existing fields
  planId               String?  // FK → Plan (optional - "bolt on")
  planStatus           PlatformAccessStatus?  // ACTIVE, PAST_DUE, CANCELED
  stripeSubscriptionId String?  // Stripe subscription
  planStartedAt       DateTime?
  planEndedAt           DateTime?
}
```

**Pros:**
- ✅ Simpler - one less table
- ✅ Direct relationship
- ✅ Company can only have one plan anyway (based on unique constraint)
- ✅ "Bolt on" capability - planId is optional

**Cons:**
- ❌ No history of plan changes
- ❌ Can't track multiple access periods
- ❌ Less flexible if we need multiple plans later

---

## Recommendation

**For MVP1 (bolt-on capability):**

**Option A: Simplify to company_hqs fields**
- Add `planId`, `planStatus`, `stripeSubscriptionId`, `planStartedAt`, `planEndedAt` to `company_hqs`
- Remove PlatformAccess table
- Simpler, direct relationship

**Option B: Keep PlatformAccess but make planId optional**
- Make `planId` optional on PlatformAccess
- Company can have access without a plan (free tier)
- Can bolt on plan later
- More flexible for future

**My vote: Option B** - Keep PlatformAccess but make planId optional. Gives us:
- Status tracking (needed for webhooks)
- Stripe subscription link (needed for webhooks)
- Flexibility for free tier (no plan) vs paid tier (with plan)
- Can still simplify later if needed

---

## What Do You Think?

The key question: **Do companies need access history, or just current plan?**

If just current plan → Simplify to company_hqs fields
If history needed → Keep PlatformAccess

