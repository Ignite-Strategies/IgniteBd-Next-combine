# Stripe Checkout Expiration Fix - The Real Problem

## TL;DR
**The Problem:** Stripe checkout sessions were failing to create because `expires_at` was set to 7 days, but Stripe's maximum is 24 hours.

**The Fix:** Changed expiration from 7 days to 24 hours.

**Why We Missed It:** The error was happening silently - Stripe API call was failing, causing `checkoutUrl` to be `null`, but we didn't see the actual Stripe error until we checked production logs.

## The Full Story

### What We Thought Was Wrong
After refactoring Stripe checkout to use ephemeral sessions (create new session on each page load), the payment link stopped working. We saw `checkoutUrl` was `null` and assumed:

1. ❌ Company relationship (`company_hqs`) wasn't loading
2. ❌ Customer ID was invalid or missing
3. ❌ Stripe API configuration issue
4. ❌ Prisma query issue

### What Was Actually Wrong
**The Stripe API call was failing** with this error:
```
The `expires_at` timestamp must be less than 24 hours from Checkout Session creation.
```

We had set `expires_at` to **7 days** (thinking that was Stripe's maximum), but Stripe's actual maximum is **24 hours**.

### Why We Missed It

1. **Error was silent in development** - We didn't see the Stripe error until checking production logs
2. **We focused on the symptom** (`checkoutUrl` is null) instead of the root cause (Stripe API call failing)
3. **We assumed the expiration was fine** - We had "fixed" expiration earlier by setting it to 7 days, not realizing Stripe's limit was 24 hours
4. **No error handling** - The error was caught but only logged, not surfaced to help debugging

### The Code That Was Wrong

```typescript
// WRONG - Stripe only allows 24 hours max
const expiresAt = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days
```

```typescript
// CORRECT - Stripe's maximum is 24 hours
const expiresAt = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours
```

## The Fix

**File:** `lib/stripe/billCheckout.ts`

**FIRST ATTEMPT:** Changed expiration from 7 days to 24 hours:
```typescript
// Set expiration to 24 hours (Stripe's maximum)
const expiresAt = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours in seconds
```

**BETTER FIX:** **Removed `expires_at` entirely** - Stripe defaults to 24 hours, we don't need to set it:
```typescript
// MINIMAL: Only pass what Stripe actually needs
// Stripe defaults to 24 hours expiration - we don't need to set it
// Since we create new sessions on each page load, expiration doesn't matter anyway
const sessionParams = {
  mode: 'payment' as const,
  customer: customerId,
  line_items: [...],
  success_url: ...,
  cancel_url: ...,
  // expires_at: REMOVED - Stripe defaults to 24 hours, we don't need to set it
  metadata: {...},
};
```

## Why Expiration Doesn't Matter (For Our Use Case)

Since we create a **new Stripe checkout session on every page load**, the expiration time doesn't affect functionality:

- User visits bill page → New session created (expires in 24 hours)
- User waits 3 days → Visits bill page again → New session created (expires in 24 hours)
- User waits 30 days → Visits bill page again → New session created (expires in 24 hours)

The expiration only matters if someone tries to use an old session URL, but we never reuse sessions anyway.

## Lessons Learned

1. **Always check API limits** - Don't assume what the maximum is, check the docs
2. **Log Stripe errors prominently** - Make API errors visible, not just logged
3. **Test API calls directly** - We should have tested the Stripe API call independently
4. **Read error messages carefully** - The error message was clear, we just didn't see it until production logs
5. **Don't pass parameters you don't need** - We asked "what's minimal?" but then added `expires_at` anyway. Stripe defaults to 24 hours - we don't need to set it!
6. **Log what you're actually passing** - We weren't logging `expires_at` in debug output, so when asked "what are we passing?" we couldn't see it

## Stripe Documentation

From Stripe's API docs:
- `expires_at` must be less than 24 hours from session creation
- Default is 24 hours if not specified
- Can be set to any value up to 24 hours

## Related Files

- `lib/stripe/billCheckout.ts` - Where the fix was applied
- `docs/STRIPE_CHECKOUT_EXPIRATION_ANALYSIS.md` - Initial analysis (incorrectly assumed 7 days was OK)
- `docs/WHY_CHECKOUT_URL_IS_NULL.md` - Debugging analysis (focused on wrong things)
- `docs/STRIPE_MINIMAL_REQUIREMENTS.md` - What Stripe actually needs

## Status

✅ **FIXED** - Removed `expires_at` entirely. Stripe defaults to 24 hours, checkout sessions now create successfully.

## The Real Lesson

**We asked "what's minimal?" but then added unnecessary parameters anyway.**

When we determined Stripe's minimal requirements:
- ✅ `line_items` - Required
- ✅ `success_url` - Required  
- ✅ `cancel_url` - Required

We should have stopped there. But we added:
- ❌ `expires_at` - **NOT NEEDED** - Stripe defaults to 24 hours
- ❌ This caused errors when we set it wrong (7 days > 24 hour limit)
- ❌ We weren't even logging it, so we couldn't see what we were passing

**Moral:** Stick to minimal requirements. Don't add parameters "just in case" - especially if the API has sensible defaults.
