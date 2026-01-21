 # Plan Consolidation Proposal

**Question:** Can we consolidate Plan + PlatformAccess into just `planId` on `company_hqs`?

---

## Current Structure

```
Plan (pricing shape)
  - amountCents
  - interval
  - currency
  - stripeProductId
  - stripePriceId

PlatformAccess (access state per company)
  - companyId
  - planId
  - status (ACTIVE, PAST_DUE, CANCELED)
  - stripeSubscriptionId
  - startedAt
  - endedAt
```

---

## Proposed: Single Model on company_hqs

```
company_hqs
  - planId (optional - "bolt on")
  - planStatus (ACTIVE, PAST_DUE, CANCELED)
  - stripeSubscriptionId
  - planStartedAt
  - planEndedAt
```

**Plan stays as-is** (pricing definition, shared across companies)

---

## Why This Works

1. **One company = one plan at a time** (based on unique constraint)
2. **Plan is shared** (pricing definition)
3. **Access state is per-company** (status, subscription, dates)
4. **"Bolt on" capability** - planId is optional

---

## Migration

1. Add fields to `company_hqs`:
   - `planId` (optional FK to Plan)
   - `planStatus` (PlatformAccessStatus, optional)
   - `stripeSubscriptionId` (already exists? check)
   - `planStartedAt` (DateTime?)
   - `planEndedAt` (DateTime?)

2. Migrate existing PlatformAccess data to company_hqs

3. Remove PlatformAccess table

4. Update webhooks to update company_hqs directly

---

## Benefits

- ✅ Simpler - one less table
- ✅ Direct relationship
- ✅ "Bolt on" - planId optional
- ✅ All Stripe fields in one place

---

## Trade-offs

- ❌ No history of plan changes (but do we need it?)
- ❌ Can't track multiple access periods (but one plan at a time anyway)

