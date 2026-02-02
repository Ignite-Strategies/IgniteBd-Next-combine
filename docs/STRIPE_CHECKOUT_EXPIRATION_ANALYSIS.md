# Stripe Checkout Session Expiration Analysis

## 🔍 Current State Analysis

### Where We Set Expiration

**✅ Bill Checkout Sessions** (`lib/stripe/billCheckout.ts`):
- **Line 38-40**: Explicitly sets `expires_at` to 7 days
- **Line 60**: Passes `expires_at: expiresAt` to Stripe API
- **Comment says**: "maximum allowed by Stripe" and "Stripe requires expiration"

**❌ Plan Checkout Sessions** (`lib/stripe/checkout.ts`):
- **NO `expires_at` parameter** - Not set at all
- Uses default Stripe behavior

### Key Finding: Inconsistency!

We have **TWO different checkout session creation functions**:

1. **`createBillCheckoutSession()`** - Sets `expires_at: 7 days`
2. **`createCheckoutSession()`** - Does NOT set `expires_at`

This suggests:
- Either expiration is NOT required (since plans work without it)
- OR we should be setting it for plans too
- OR bills have different requirements than plans

## 🤔 Is `expires_at` Required?

### Evidence Against It Being Required:

1. **Plan checkout sessions work without it** - `lib/stripe/checkout.ts` doesn't set it
2. **Web search results** - Don't show `expires_at` as a standard parameter
3. **Stripe docs** - Mention expiration but don't show `expires_at` as a create parameter

### Evidence For It Being Optional:

1. **We're explicitly setting it** - Suggests we want control
2. **Comment says "maximum allowed"** - Implies there's a limit we're hitting
3. **7 days is mentioned** - Could be Stripe's default OR maximum

## 📊 What Stripe Actually Does

### Default Behavior (if `expires_at` not set):
- Stripe checkout sessions **DO expire by default**
- Default expiration is typically **24 hours** (not documented but common)
- Stripe automatically expires sessions after inactivity

### If `expires_at` IS Set:
- We're explicitly controlling expiration
- Setting to 7 days = maximum allowed
- This extends beyond default 24 hours

## 🎯 The Real Question

**Is `expires_at` a valid Stripe API parameter?**

### Testing Needed:
1. Check Stripe TypeScript types for `SessionCreateParams`
2. Test creating a session WITHOUT `expires_at` 
3. See if Stripe accepts/rejects the parameter
4. Check what happens if we remove it

### Current Code Behavior:
- **Bills**: Explicitly expire after 7 days
- **Plans**: Use Stripe default (likely 24 hours)

## 💡 Recommendation

### Option 1: Remove `expires_at` (Let Stripe Handle It)
- Stripe has default expiration (24 hours)
- Our auto-regeneration handles expired sessions anyway
- Simpler code
- **Risk**: Might expire faster than we want

### Option 2: Keep `expires_at` but Verify It Works
- Test if parameter is actually accepted
- If it works, keep 7 days (maximum)
- If it doesn't work, Stripe ignores it and uses default

### Option 3: Make It Consistent
- Add `expires_at` to plan checkout sessions too
- OR remove it from bill checkout sessions
- Consistency is key

## 🔬 Next Steps to Verify

1. **Check Stripe SDK Types**:
   ```typescript
   // Look for expires_at in Stripe.Checkout.SessionCreateParams
   ```

2. **Test API Call**:
   - Create session WITH `expires_at` → Check if it's accepted
   - Create session WITHOUT `expires_at` → Check default behavior
   - Compare expiration times

3. **Check Stripe Dashboard**:
   - Look at actual session expiration times
   - See if 7 days is actually being set

4. **Review Stripe API Docs**:
   - Official docs for `checkout.sessions.create`
   - See if `expires_at` is listed as parameter

## 📝 Current Implementation Summary

| Function | Sets `expires_at`? | Expiration Time | Notes |
|----------|-------------------|-----------------|-------|
| `createBillCheckoutSession()` | ✅ YES | 7 days | Explicitly set |
| `createCheckoutSession()` | ❌ NO | Default (24h?) | Uses Stripe default |

## 🎬 Conclusion

**We ARE setting expiration** - but it's unclear if:
1. Stripe actually accepts/uses the `expires_at` parameter
2. It's required or optional
3. We should set it for plans too

**The auto-regeneration solution handles this regardless** - but we should verify if `expires_at` is actually doing anything or if Stripe is just using its default.

## ✅ Final Answer

**Is expiration a Stripe thing or IgniteBD thing?**

### It's BOTH:

1. **Stripe's Default**: Stripe checkout sessions expire by default (typically 24 hours)
2. **We're Overriding**: We're explicitly setting `expires_at: 7 days` to extend beyond default
3. **The Problem**: Even 7 days isn't enough if someone waits 3+ days to pay
4. **Our Solution**: Auto-regenerate expired sessions when someone visits the bill page

### Key Insight:

- **Stripe REQUIRES sessions to expire** (security/abandoned cart reasons)
- **We CAN set expiration** (up to 7 days max, if `expires_at` parameter works)
- **We CAN'T prevent expiration** (it's a Stripe limitation)
- **We CAN work around it** (auto-regenerate expired sessions)

### The Real Fix:

The auto-regeneration we implemented is the right solution because:
- Stripe sessions WILL expire (it's mandatory)
- We can't prevent it
- But we CAN make it transparent by auto-creating new sessions
- From user's perspective: payment link never expires ✅
