# What Broke - Before vs After Analysis

## 🔴 What Was Working Before

### Old Flow (Before Refactor)
1. Bill assigned → Stripe session created → `checkoutUrl` stored in DB
2. Bill page loads → Reads `checkoutUrl` from DB → Passes to component
3. Component shows payment button → Works ✅

**Key:** `checkoutUrl` was **always in the database** after assignment.

### Old Code Pattern
```typescript
// Bill page
const bill = await prisma.bills.findUnique({ where: { slug } });
// checkoutUrl was already in bill.checkoutUrl from DB

<InvoiceBill checkoutUrl={bill.checkoutUrl} />
// ✅ Always had a value (unless never assigned)
```

## 🟡 What We Changed

### New Flow (After Refactor)
1. Bill assigned → NO session created → `checkoutUrl` set to NULL
2. Bill page loads → Tries to create NEW session → If fails, `checkoutUrl` is null
3. Component shows error → "Payment link is not available" ❌

**Key:** `checkoutUrl` is **created on-demand** and can fail.

### New Code Pattern
```typescript
// Bill page
const bill = await prisma.bills.findUnique({ where: { slug } });
let checkoutUrl = null; // ← Starts as null

if (bill.company_hqs && bill.companyId) {
  try {
    const session = await createBillCheckoutSession(...);
    checkoutUrl = session.url; // ← Only set if creation succeeds
  } catch (error) {
    // Error caught, checkoutUrl stays null ❌
  }
}

<InvoiceBill checkoutUrl={checkoutUrl} />
// ❌ Can be null if session creation fails
```

## 🐛 What's Probably Breaking

### Issue #1: Session Creation Failing Silently

**Symptom:** `checkoutUrl` is null, error caught but not visible

**Possible Causes:**
1. **Stripe API key missing/invalid** in production
2. **Network error** calling Stripe
3. **Stripe customer creation failing** (`getOrCreateStripeCustomer()`)
4. **Invalid bill data** (amount, currency, etc.)

**Check:** Look for `[STRIPE_CHECKOUT]` logs in server output

### Issue #2: company_hqs Relationship Not Loading

**Symptom:** `bill.company_hqs` is null even though `bill.companyId` is set

**Possible Causes:**
1. Company record deleted (cascade would delete bill, so unlikely)
2. Prisma relationship not working correctly
3. Query not including relationship properly

**Check:** Look for `[BILL_PAGE] Bill loaded:` log - check `hasCompanyHqs`

### Issue #3: Condition Check Failing

**Symptom:** `bill.company_hqs && bill.companyId` evaluates to false

**Possible Causes:**
1. `company_hqs` is null (relationship not loaded)
2. `companyId` is null (shouldn't be based on DB data)
3. Both are null

**Check:** Look for warning log: `Cannot create checkout session - missing company_hqs or companyId`

## 🔍 Debugging Checklist

### Step 1: Check Server Logs

Look for these log messages in order:

1. **`[BILL_PAGE] Bill loaded:`**
   - ✅ Should show `hasCompanyHqs: true`
   - ✅ Should show `companyId: "24beffe1-..."`
   - ✅ Should show `stripeCustomerId: "cus_..."` or `null`

2. **`[BILL_PAGE] Creating Stripe checkout session...`**
   - ✅ Should appear if condition passes
   - ❌ If missing → Condition failed (company_hqs or companyId missing)

3. **`[STRIPE_CHECKOUT] Creating session:`**
   - ✅ Should show bill and company data
   - ✅ Should show `hasStripeCustomerId: true` or `false`

4. **`[STRIPE_CHECKOUT] Customer ID:`**
   - ✅ Should show `"cus_..."` (Stripe customer ID)
   - ❌ If missing → Customer creation failed

5. **`[STRIPE_CHECKOUT] Session created:`**
   - ✅ Should show `id`, `url`, `status`
   - ❌ If missing → Session creation failed

### Step 2: Check Database

```sql
-- Verify bill has companyId
SELECT id, "companyId", status 
FROM bills 
WHERE id = 'cmkzxj9km0000lc04kzjotdgn';

-- Verify company exists and has stripeCustomerId
SELECT id, "companyName", "stripeCustomerId"
FROM company_hqs
WHERE id = '24beffe1-6ada-4442-b90b-7e3ad8a2ec7d';
```

### Step 3: Test Stripe API Directly

If logs show session creation is attempted but fails, test Stripe API:

```typescript
// Manual test
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const customer = await stripe.customers.create({
  name: "Test Company",
});
console.log("Customer created:", customer.id);

const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  customer: customer.id,
  line_items: [{
    price_data: {
      currency: 'usd',
      unit_amount: 50000,
      product_data: { name: 'Test Bill' },
    },
    quantity: 1,
  }],
  success_url: 'https://app.ignitegrowth.biz/bill-paid',
  cancel_url: 'https://app.ignitegrowth.biz/bill-canceled',
});
console.log("Session created:", session.url);
```

## 🎯 Most Likely Issue

Based on "it was working before", the most likely problem is:

**Session creation is failing** because:
1. Stripe API key not set in production environment
2. OR Stripe customer creation is failing
3. OR Network/API error

**The fix:** Check server logs to see which step fails, then fix that specific issue.

## 🔧 Quick Fix Options

### Option 1: Fallback to Stored checkoutUrl (Temporary)

If session creation fails, use stored `checkoutUrl` if it exists:

```typescript
let checkoutUrl = bill.checkoutUrl; // Fallback to stored

if (bill.company_hqs && bill.companyId) {
  try {
    const session = await createBillCheckoutSession(...);
    checkoutUrl = session.url; // Override with fresh
  } catch (error) {
    // Use stored checkoutUrl if creation fails
    if (!checkoutUrl) {
      console.error('Session creation failed and no stored URL');
    }
  }
}
```

### Option 2: Fix Root Cause

Based on logs, fix the actual issue:
- If Stripe API key missing → Set it
- If customer creation fails → Fix customer creation
- If relationship not loading → Fix Prisma query

## 📊 Comparison Table

| Aspect | Before (Working) | After (Broken) |
|--------|------------------|----------------|
| **checkoutUrl Source** | Database (stored) | Created on-demand |
| **Failure Mode** | URL always exists (if assigned) | URL can be null |
| **Error Handling** | N/A (always had URL) | Errors caught, URL stays null |
| **Dependency** | None (already stored) | Requires Stripe API call |
| **Failure Point** | Assignment (one-time) | Every page load |

## 🎬 Conclusion

**What broke:** We moved from "stored URL" to "create on-demand", but session creation is failing.

**Why it broke:** Session creation can fail (API key, network, etc.), and we're catching errors but not handling them gracefully.

**How to fix:** 
1. Check server logs to see WHERE it's failing
2. Fix that specific issue (API key, customer creation, etc.)
3. OR add fallback to stored URL temporarily
