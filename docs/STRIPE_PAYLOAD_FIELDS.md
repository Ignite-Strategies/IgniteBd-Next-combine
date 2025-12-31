# Stripe Payload Fields - IgniteBd vs Stripe Requirements

**Date:** 2025-01-28  
**Purpose:** Separate IgniteBd fields from required Stripe fields for refactor compatibility

---

## 🎯 Overview

This document maps what Stripe expects vs what IgniteBd provides, ensuring Stripe payload compatibility during refactor.

---

## 📊 Stripe Checkout Session Creation - Required Fields

### Stripe API Call: `stripe.checkout.sessions.create()`

```javascript
const session = await stripe.checkout.sessions.create({
  // ✅ REQUIRED BY STRIPE
  ui_mode: 'embedded',                    // Stripe requirement
  payment_method_types: ['card'],        // Stripe requirement
  customer: stripeCustomerId,             // Stripe requirement (or create new)
  line_items: [...],                     // Stripe requirement
  mode: 'payment',                       // Stripe requirement
  return_url: '...',                     // Stripe requirement
  
  // ✅ OPTIONAL BUT USED
  metadata: {...},                       // Stripe optional (we use for tracking)
  allow_promotion_codes: true,          // Stripe optional
});
```

---

## 🔴 Stripe Line Items - Required Structure

### What Stripe Expects:

```javascript
line_items: [
  {
    price_data: {
      currency: 'usd',                    // ✅ REQUIRED - lowercase currency code
      product_data: {
        name: 'Invoice INV-2025-001',     // ✅ REQUIRED - product name
        description: 'Payment for...',    // ✅ OPTIONAL - product description
      },
      unit_amount: 50000,                 // ✅ REQUIRED - amount in CENTS (integer)
    },
    quantity: 1,                          // ✅ REQUIRED - integer
  },
]
```

### Stripe Requirements:
- ✅ `currency` - Must be lowercase (e.g., 'usd', 'eur')
- ✅ `unit_amount` - Must be in **cents** (integer), not dollars
- ✅ `name` - Product name (string)
- ✅ `quantity` - Integer (usually 1 for invoices)

---

## 📋 Field Mapping: IgniteBd Schema → Stripe Payload

### Current Mapping (Client Portal):

| Stripe Field | Source | IgniteBd Field | Type | Required |
|-------------|--------|----------------|------|----------|
| `currency` | `invoice.currency` | `currency` (String) | String | ✅ Yes |
| `unit_amount` | `invoice.amount * 100` | `amount` (Float) | Integer (cents) | ✅ Yes |
| `product_data.name` | `Invoice ${invoice.invoiceNumber}` | `invoiceNumber` (String?) | String | ✅ Yes |
| `product_data.description` | `invoice.description` | `invoiceDescription` (String?) | String | ⚠️ Optional |
| `customer` | `invoice.stripeCustomerId` | `stripeCustomerId` (String?) | String | ✅ Yes |
| `metadata.invoiceId` | `invoice.id` | `id` (String) | String | ✅ Yes |
| `metadata.invoiceNumber` | `invoice.invoiceNumber` | `invoiceNumber` (String?) | String | ⚠️ Optional |
| `metadata.contactId` | `contact.id` | N/A (from auth) | String | ✅ Yes |
| `return_url` | Env var + params | N/A (constructed) | String | ✅ Yes |

---

## 🔴 Stripe-Required Fields (Must Keep)

### Fields Stripe API Requires:

1. **`currency`** (String)
   - **Source:** `invoice.currency`
   - **Format:** Lowercase (e.g., 'usd', 'eur')
   - **Default:** 'USD'
   - **Required:** ✅ Yes

2. **`unit_amount`** (Integer - cents)
   - **Source:** `invoice.totalExpected` OR `invoice.amount * 100`
   - **Format:** Integer in cents (e.g., $500.00 = 50000)
   - **Required:** ✅ Yes
   - **Note:** Must convert from dollars to cents

3. **`product_data.name`** (String)
   - **Source:** `invoice.invoiceNumber` OR `invoice.invoiceName`
   - **Format:** String (e.g., "Invoice INV-2025-001")
   - **Required:** ✅ Yes

4. **`customer`** (String)
   - **Source:** `invoice.stripeCustomerId` OR create new customer
   - **Format:** Stripe customer ID (e.g., "cus_xxx")
   - **Required:** ✅ Yes

5. **`return_url`** (String)
   - **Source:** Constructed from env var + params
   - **Format:** Full URL (e.g., "https://domain.com/dashboard?session_id={CHECKOUT_SESSION_ID}")
   - **Required:** ✅ Yes

---

## 🟢 IgniteBd-Specific Fields (Not Required by Stripe)

### Fields Used for Business Logic (Not Stripe):

1. **`invoice.id`** - IgniteBd internal ID
2. **`invoice.invoiceType`** - IgniteBd classification (PLATFORM_FEE, MONTHLY_RECURRING, etc.)
3. **`invoice.companyHQId`** - IgniteBd company scope
4. **`invoice.workPackageId`** - IgniteBd legacy link
5. **`invoice.contactId`** - IgniteBd billing contact
6. **`invoice.companyId`** - IgniteBd billing company
7. **`invoice.status`** - IgniteBd status enum
8. **`invoice.invoiceDescription`** - IgniteBd description
9. **`invoice.dueDate`** - IgniteBd due date
10. **`invoice.isRecurring`** - IgniteBd recurring flag
11. **`invoice.totalExpected`** - IgniteBd total (in cents)
12. **`invoice.totalReceived`** - IgniteBd received (in cents)

**Note:** These fields are NOT sent to Stripe, but are used for:
- Database queries
- Authorization checks
- Business logic
- Invoice management

---

## 🔵 Stripe Metadata Fields (Optional but Used)

### Fields Stored in Stripe Session Metadata:

```javascript
metadata: {
  invoiceId: invoice.id,              // ✅ Used to find invoice after payment
  invoiceNumber: invoice.invoiceNumber, // ✅ Used for logging/display
  contactId: contact.id,              // ✅ Used to track who paid
  // proposalId: invoice.proposalId,  // ❌ REMOVE - doesn't exist in new schema
}
```

**Purpose:** These are stored in Stripe session and retrieved in webhook to update invoice.

---

## ⚠️ Refactor Considerations

### Fields That Need Mapping:

| Old (Client Portal) | New (IgniteBd-Next) | Action |
|---------------------|---------------------|--------|
| `invoice.amount` | `invoice.totalExpected` (cents) OR `invoice.amount` (if exists) | ✅ Use `totalExpected` (already in cents) |
| `invoice.description` | `invoice.invoiceDescription` | ✅ Update field name |
| `invoice.proposal.clientCompany` | `invoice.company.companyName` OR `invoice.invoiceName` | ✅ Update source |
| `invoice.proposalId` | `invoice.workPackageId` (legacy) OR remove | ⚠️ Remove from metadata |
| `invoice.proposal.companyId` | `invoice.companyId` OR `invoice.companyHQId` | ✅ Update verification |

### Currency Conversion:

```javascript
// ✅ CORRECT: totalExpected is already in cents
unit_amount: invoice.totalExpected

// ❌ WRONG: Don't multiply if already in cents
unit_amount: invoice.totalExpected * 100  // NO - already cents!

// ✅ CORRECT: If using amount (Float in dollars)
unit_amount: Math.round(invoice.amount * 100)  // Only if amount is in dollars
```

---

## 📝 Stripe Payload Template

### Minimal Required Payload:

```javascript
{
  ui_mode: 'embedded',
  payment_method_types: ['card'],
  customer: stripeCustomerId,                    // ✅ Required
  line_items: [
    {
      price_data: {
        currency: invoice.currency.toLowerCase(), // ✅ Required (lowercase)
        product_data: {
          name: `Invoice ${invoice.invoiceNumber || invoice.invoiceName}`, // ✅ Required
          description: invoice.invoiceDescription || null,                 // ⚠️ Optional
        },
        unit_amount: invoice.totalExpected,        // ✅ Required (cents)
      },
      quantity: 1,                                // ✅ Required
    },
  ],
  mode: 'payment',                                // ✅ Required
  return_url: `${frontendUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}&invoice_id=${invoiceId}`, // ✅ Required
  metadata: {                                     // ⚠️ Optional but recommended
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    contactId: contact.id,
  },
}
```

---

## 🎯 Platform Manager Integration

### Future: Platform Manager Sets Rates

**Current:** Rates seeded in database  
**Future:** Platform manager will set:
- Platform fee amounts
- Monthly recurring amounts
- Custom invoice rates

**Fields to Consider:**
- `invoice_settings.platformFeeAmount` (Int - cents)
- `invoice_settings.monthlyRecurringAmount` (Int - cents)
- Invoice-specific rates (stored per invoice)

**Stripe Impact:** None - Stripe only cares about `unit_amount` in the payload, not where the amount comes from.

---

## ✅ Checklist for Refactor

- [ ] Map `invoice.totalExpected` → Stripe `unit_amount` (already in cents)
- [ ] Map `invoice.currency` → Stripe `currency` (lowercase)
- [ ] Map `invoice.invoiceNumber` OR `invoice.invoiceName` → Stripe `product_data.name`
- [ ] Map `invoice.invoiceDescription` → Stripe `product_data.description`
- [ ] Ensure `invoice.stripeCustomerId` exists or create customer
- [ ] Remove `proposalId` from metadata (doesn't exist in new schema)
- [ ] Keep `invoiceId`, `invoiceNumber`, `contactId` in metadata
- [ ] Update `return_url` construction (no changes needed)
- [ ] Test currency conversion (ensure cents, not dollars)
- [ ] Verify Stripe customer creation flow

---

## 🔗 Related Documents

- `CLIENT_PORTAL_CHECKOUT_ANALYSIS.md` - Full checkout implementation
- `INVOICE_SYSTEM_REFACTOR.md` - New invoice schema
- `INVOICE_ROUTES_TO_REVIEW.md` - Routes to update

