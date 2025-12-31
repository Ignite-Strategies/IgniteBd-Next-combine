# Invoice Routes & Functions to Review for Refactor

**Date:** 2025-01-28  
**Purpose:** Short list of routes/functions to inspect for naming and functionality

---

## 🔴 Routes to Review

### 1. **Checkout Session Creation**
**File:** `ignitebd-clientportal/app/api/client/billing/[invoiceId]/checkout/route.js`
- **Function:** `POST(request, { params })`
- **What it does:** Creates Stripe checkout session
- **Key logic:**
  - Verifies Firebase token → Get Contact
  - Gets invoice with `proposal` relation (NEEDS UPDATE)
  - Verifies invoice belongs to contact's company
  - Creates Stripe customer
  - Creates checkout session with `return_url`
  - Stores `stripeCheckoutSessionId` on invoice
- **Returns:** `{ clientSecret, sessionId }`

### 2. **Payment Verification (Fallback)**
**File:** `ignitebd-clientportal/app/api/client/billing/[invoiceId]/verify/[sessionId]/route.js`
- **Function:** `GET(request, { params })`
- **What it does:** Verifies payment status without webhook
- **Key logic:**
  - Verifies Firebase token → Get Contact
  - Gets invoice with `proposal` relation (NEEDS UPDATE)
  - Verifies invoice belongs to contact's company
  - Retrieves session from Stripe API
  - Updates invoice if payment completed
- **Returns:** `{ success, contactId, amount, currency }`

### 3. **Webhook Handler**
**File:** `ignitebd-clientportal/app/api/webhook/stripe/route.js`
- **Function:** `POST(request)`
- **What it does:** Handles Stripe webhook events
- **Key logic:**
  - Verifies webhook signature
  - Handles `checkout.session.completed`
  - Handles `checkout.session.async_payment_succeeded`
  - Handles `checkout.session.async_payment_failed`
  - Finds invoice by `stripeCheckoutSessionId`
  - Updates invoice status
- **Returns:** `{ received: true }`

### 4. **List Invoices**
**File:** `ignitebd-clientportal/app/api/client/billing/route.js`
- **Function:** `GET(request)`
- **What it does:** Gets all invoices for authenticated client's company
- **Key logic:**
  - Verifies Firebase token → Get Contact
  - Gets invoices via `proposal.companyId` (NEEDS UPDATE)
  - Returns formatted invoice list
- **Returns:** `{ success, invoices: [...] }`

---

## 🔴 Functions/Components to Review

### 5. **Invoice Payment Modal**
**File:** `ignitebd-clientportal/app/components/InvoicePaymentModal.jsx`
- **Component:** `InvoicePaymentModal({ invoice, onClose, onSuccess })`
- **What it does:** Client-side payment UI
- **Key logic:**
  - Calls checkout route on mount
  - Uses Stripe Embedded Checkout
  - Handles payment flow
- **Uses:** `@stripe/react-stripe-js`, `@stripe/stripe-js`

---

## ⚠️ Issues to Fix

### Schema Mismatches:
- ❌ Uses `invoice.proposal` → Should use `invoice.companyId` or `invoice.companyHQId`
- ❌ Uses `invoice.proposal.companyId` → Should use `invoice.companyId`
- ❌ Uses `invoice.proposal.clientCompany` → Should use `invoice.company.companyName` or `invoice.invoiceName`
- ❌ Uses `invoice.proposalId` → Should use `invoice.workPackageId` (for legacy) or remove

### Field Name Mismatches:
- ❌ Uses `invoice.description` → Should use `invoice.invoiceDescription`
- ❌ Uses `invoice.amount` → Should use `invoice.totalExpected` (in cents) or `invoice.amount` (if exists)

---

## 📋 Quick Checklist

- [ ] Review checkout route - update company verification
- [ ] Review verify route - update company verification  
- [ ] Review webhook route - should be fine (no proposal relation)
- [ ] Review list invoices route - update query and response
- [ ] Review payment modal - update field names
- [ ] Update all `invoice.proposal` references
- [ ] Update all `invoice.description` → `invoice.invoiceDescription`
- [ ] Test with new invoice types (PLATFORM_FEE, MONTHLY_RECURRING, CUSTOM)

---

## 🎯 Priority Order

1. **Webhook** (easiest - no proposal relation) ⚠️ **NEEDS TO BE CREATED**
2. **Checkout** (critical - payment creation)
3. **Verify** (fallback - less critical)
4. **List** (UI - needs update)
5. **Modal** (UI component - client-side)

---

## ⚠️ Webhook Status

**Current State:** ❌ **NO STRIPE WEBHOOK EXISTS IN IgniteBd-Next-combine**

**What exists:**
- ✅ `app/api/webhooks/sendgrid/route.js` - SendGrid webhook only
- ❌ No `app/api/webhooks/stripe/route.js` - **NEEDS TO BE CREATED**

**Action Required:**
- Copy webhook from client portal: `ignitebd-clientportal/app/api/webhook/stripe/route.js`
- Create: `IgniteBd-Next-combine/app/api/webhooks/stripe/route.js`
- Update to use new invoice schema (no `invoice.proposal` relation)

