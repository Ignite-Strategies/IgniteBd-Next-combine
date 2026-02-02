# Bill Payment Flow - Full Analysis

## 🔄 Complete Flow Diagram

```
1. Bill Assignment (POST /api/bills/assign)
   ├─> Sets bill.companyId
   ├─> Generates slug via generateBillSlug()
   ├─> Sets bill.publicBillUrl = "https://bills.ignitegrowth.biz/{companySlug}/{part}"
   └─> Does NOT create Stripe session (sessions are ephemeral)

2. User Visits Bill Page (GET /[companySlug]/[part])
   ├─> Server Component loads bill by slug
   ├─> Includes company_hqs relationship
   ├─> Checks: bill.status === 'PENDING'
   ├─> Creates NEW Stripe checkout session (always fresh)
   │   ├─> Calls createBillCheckoutSession()
   │   ├─> Uses bill.amountCents, bill.currency
   │   ├─> Uses company.stripeCustomerId (creates if missing)
   │   └─> Returns session.url
   └─> Passes checkoutUrl to InvoiceBill component

3. InvoiceBill Component (Client Component)
   ├─> Receives checkoutUrl prop
   ├─> If checkoutUrl exists: Shows "Pay Here" button
   └─> If checkoutUrl is null: Shows "Payment link is not available"
```

## 🔍 Current Implementation Analysis

### URL Generation (Durable)
- **Location**: `lib/billSlug.ts`
- **Function**: `generateBillSlug(companyName, billName, billId)`
- **Output**: `{ slug, companySlug, part }`
- **Example**: `businesspoint-law/advisory-and-onboarding-kzjotdgn`
- **Stored**: `bill.slug` and `bill.publicBillUrl`
- **Never Changes**: Once set, URL is permanent

### Bill Page Load (Server Component)
- **Location**: `app/(public)/[companySlug]/[part]/page.jsx`
- **What it does**:
  1. Fetches bill by `slug` from database
  2. Includes `company_hqs` relationship
  3. Checks bill status
  4. **Creates fresh Stripe session** (if bill has companyId)
  5. Passes `checkoutUrl` to InvoiceBill component

### Stripe Session Creation (Ephemeral)
- **Location**: `lib/stripe/billCheckout.ts`
- **Function**: `createBillCheckoutSession()`
- **When**: Every page load
- **Never Stored**: Session ID not saved to database
- **Returns**: `session.url` (Stripe checkout URL)

### Component Rendering (Client)
- **Location**: `components/bill/InvoiceBill.jsx`
- **Props**: `{ bill, checkoutUrl, companyName, companyAddress }`
- **Behavior**: 
  - If `checkoutUrl` → Shows payment button
  - If `checkoutUrl === null` → Shows error message

## 🐛 Potential Failure Points

### 1. Bill Missing companyId
**Symptom**: `checkoutUrl` is null, warning logged
**Check**: `bill.companyId` must be set (happens during assignment)
**Fix**: Ensure bill is assigned before sharing URL

### 2. Company Relationship Not Loaded
**Symptom**: `bill.company_hqs` is null
**Check**: Query includes `company_hqs` relationship
**Fix**: Already included in query ✅

### 3. Stripe Customer Creation Fails
**Symptom**: Error in `getOrCreateStripeCustomer()`
**Check**: Stripe API key, network, permissions
**Fix**: Error logged, needs investigation

### 4. Stripe Session Creation Fails
**Symptom**: Exception thrown, caught, `checkoutUrl` remains null
**Check**: 
- Stripe API key valid?
- Amount > 0?
- Currency valid?
- Customer ID valid?
**Fix**: Error logged with details

### 5. Session Created But URL is Null
**Symptom**: Session created but `session.url` is null
**Check**: Stripe API response
**Fix**: Shouldn't happen, but logged if it does

## 📊 Data Flow Checklist

### Bill Assignment ✅
- [x] Sets `bill.companyId`
- [x] Generates `bill.slug`
- [x] Sets `bill.publicBillUrl`
- [x] Does NOT create Stripe session
- [x] Clears old `stripeCheckoutSessionId` and `checkoutUrl`

### Bill Page Load ✅
- [x] Fetches bill by slug
- [x] Includes company_hqs relationship
- [x] Checks status === 'PENDING'
- [x] Creates fresh Stripe session
- [x] Handles errors gracefully
- [x] Passes checkoutUrl to component

### Stripe Session Creation ✅
- [x] Gets/creates Stripe customer
- [x] Creates session with bill details
- [x] Sets metadata.billId
- [x] Returns session.url

### Component Rendering ✅
- [x] Receives checkoutUrl prop
- [x] Shows payment button if URL exists
- [x] Shows error if URL is null

## 🔧 Debugging Steps

### Check Server Logs For:
1. **"Cannot create checkout session - missing company_hqs or companyId"**
   - → Bill not assigned properly
   - → Fix: Re-assign bill to company

2. **"Error creating checkout session"** with details
   - → Stripe API error
   - → Check: API key, network, Stripe dashboard

3. **"Stripe session created but URL is null"**
   - → Stripe API returned session without URL
   - → Check: Stripe dashboard for session status

### Verify Bill State:
```sql
SELECT id, name, "companyId", slug, "publicBillUrl", status 
FROM bills 
WHERE slug = 'businesspoint-law/advisory-and-onboarding-kzjotdgn';
```

### Verify Company Relationship:
```sql
SELECT b.id, b."companyId", c.id as company_hqs_id, c."companyName", c."stripeCustomerId"
FROM bills b
LEFT JOIN company_hqs c ON b."companyId" = c.id
WHERE b.slug = 'businesspoint-law/advisory-and-onboarding-kzjotdgn';
```

## 🎯 Expected Behavior

1. **Bill assigned** → `companyId` set, `slug` set, `publicBillUrl` set
2. **User visits URL** → Page loads, fetches bill, creates Stripe session
3. **Session created** → `checkoutUrl` passed to component
4. **Component renders** → Shows "Pay Here" button
5. **User clicks** → Redirects to Stripe Checkout
6. **Payment completes** → Webhook finds bill by `metadata.billId`, marks as PAID

## ⚠️ Current Issue

**Symptom**: "Payment link is not available. Please contact support."

**Possible Causes**:
1. Bill doesn't have `companyId` set (not assigned)
2. `company_hqs` relationship not loading
3. Stripe session creation failing silently
4. Stripe API key missing/invalid in production
5. `getOrCreateStripeCustomer()` failing

**Next Steps**:
1. Check server logs for specific error
2. Verify bill has `companyId` set
3. Verify `company_hqs` relationship loads
4. Check Stripe API key in production environment
5. Test Stripe session creation manually
