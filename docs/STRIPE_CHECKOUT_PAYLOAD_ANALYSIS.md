# Stripe Checkout Session Payload - Complete Analysis

## 🎯 The Core Question

**What does Stripe actually need to create a checkout session?**

## 📋 Stripe API Requirements

### Required Parameters (from Stripe API docs)

```typescript
stripe.checkout.sessions.create({
  mode: 'payment' | 'subscription' | 'setup',  // REQUIRED
  line_items: [...],                            // REQUIRED (or payment_intent_data)
  success_url: string,                          // REQUIRED
  cancel_url: string,                           // REQUIRED (or payment_intent_data)
  
  // Optional but commonly used:
  customer?: string,                            // Stripe Customer ID (cus_...)
  expires_at?: number,                         // Unix timestamp
  metadata?: Record<string, string>,            // Custom data
})
```

### What Stripe DOESN'T Care About

- ❌ `companyId` - This is OUR internal ID, Stripe doesn't know about it
- ❌ `billId` - This is OUR internal ID, Stripe doesn't know about it
- ❌ Any of our database IDs - Stripe only knows about Stripe IDs

### What Stripe DOES Need

- ✅ **`customer`** - Stripe Customer ID (`cus_...`) - THIS IS THE KEY
- ✅ **`line_items`** - What they're paying for (amount, currency, description)
- ✅ **`mode`** - Payment type (`payment` for one-time)
- ✅ **`success_url`** - Where to redirect after payment
- ✅ **`cancel_url`** - Where to redirect if cancelled

## 🔄 Our Data Flow

### 1. Our Internal Data (IgniteBD)

```
Bill (bills table)
├─ id: "cmkzxj9km0000lc04kzjotdgn" (OUR ID)
├─ companyId: "24beffe1-6ada-4442-b90b-7e3ad8a2ec7d" (OUR ID)
├─ amountCents: 50000
├─ currency: "usd"
└─ name: "Advisory and Onboarding"
```

### 2. Company Relationship (company_hqs table)

```
CompanyHQ (company_hqs table)
├─ id: "24beffe1-6ada-4442-b90b-7e3ad8a2ec7d" (OUR ID)
├─ companyName: "BusinessPoint Law"
└─ stripeCustomerId: "cus_abc123..." (STRIPE ID) ← THIS IS WHAT STRIPE NEEDS
```

### 3. Stripe Customer (External - Stripe's System)

```
Stripe Customer (in Stripe's database)
├─ id: "cus_abc123..." (STRIPE ID)
├─ name: "BusinessPoint Law"
└─ metadata: { companyHQId: "24beffe1-..." } (OUR ID stored in Stripe)
```

## 🔗 The Bridge: stripeCustomerId

**The ONLY thing Stripe needs from us is the `stripeCustomerId`.**

- **Our `companyId`** → Links bill to company (internal)
- **Company's `stripeCustomerId`** → Links company to Stripe customer (external)
- **Stripe Customer** → What Stripe uses for billing

## 📦 Exact Payload We Send to Stripe

### Current Implementation (`lib/stripe/billCheckout.ts`)

```typescript
const session = await stripe.checkout.sessions.create({
  mode: 'payment',                              // ✅ Stripe needs this
  customer: customerId,                         // ✅ Stripe Customer ID (cus_...)
  line_items: [
    {
      price_data: {
        currency: bill.currency.toLowerCase(),  // ✅ Stripe needs: "usd"
        product_data: {
          name: bill.name,                       // ✅ Stripe needs: "Advisory and Onboarding"
          description: bill.description,         // ✅ Stripe needs: description
        },
        unit_amount: bill.amountCents,           // ✅ Stripe needs: 50000 (cents)
      },
      quantity: 1,                               // ✅ Stripe needs this
    },
  ],
  success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,  // ✅ Stripe needs
  cancel_url: cancelUrl,                        // ✅ Stripe needs
  expires_at: expiresAt,                        // Optional but we set it
  metadata: {                                    // Optional - OUR data for webhook
    billId: bill.id,                            // OUR ID (Stripe doesn't use, we do)
    companyId: company.id,                      // OUR ID (Stripe doesn't use, we do)
    type: 'one_off_bill',                       // OUR classification
  },
});
```

## 🔍 What Each Field Does

### Stripe Uses (Required for Payment)

| Field | Value | Purpose | Source |
|-------|-------|---------|--------|
| `mode` | `'payment'` | One-time payment (not subscription) | Hardcoded |
| `customer` | `"cus_abc123..."` | **Stripe Customer ID** - Links to billing identity | `company.stripeCustomerId` |
| `line_items[0].price_data.currency` | `"usd"` | Payment currency | `bill.currency` |
| `line_items[0].price_data.unit_amount` | `50000` | Amount in cents | `bill.amountCents` |
| `line_items[0].price_data.product_data.name` | `"Advisory and Onboarding"` | What they're paying for | `bill.name` |
| `success_url` | `"https://app.ignitegrowth.biz/bill-paid?session_id=..."` | Redirect after payment | Our domain |
| `cancel_url` | `"https://app.ignitegrowth.biz/bill-canceled"` | Redirect if cancelled | Our domain |

### Stripe Ignores (But We Use)

| Field | Value | Purpose | Who Uses It |
|-------|-------|---------|-------------|
| `metadata.billId` | `"cmkzxj9km0000lc04kzjotdgn"` | Find bill in webhook | **US** (webhook handler) |
| `metadata.companyId` | `"24beffe1-..."` | Find company in webhook | **US** (webhook handler) |
| `metadata.type` | `"one_off_bill"` | Classify payment type | **US** (webhook handler) |

## 🎯 The Critical Path

### Step 1: Get Stripe Customer ID

```typescript
// lib/stripe/customer.ts
const customerId = await getOrCreateStripeCustomer(company);
// Returns: "cus_abc123..." (Stripe ID)
```

**What this does:**
1. Checks if `company.stripeCustomerId` exists
2. If yes → Returns it
3. If no → Creates Stripe customer, saves ID to `company.stripeCustomerId`, returns it

**Stripe API Call:**
```typescript
stripe.customers.create({
  name: company.companyName,                    // "BusinessPoint Law"
  metadata: { companyHQId: company.id },       // OUR ID stored in Stripe
})
// Returns: { id: "cus_abc123...", ... }
```

### Step 2: Create Checkout Session

```typescript
// lib/stripe/billCheckout.ts
const session = await stripe.checkout.sessions.create({
  customer: customerId,                         // "cus_abc123..." ← FROM STEP 1
  mode: 'payment',
  line_items: [{
    price_data: {
      currency: bill.currency,                  // "usd"
      unit_amount: bill.amountCents,            // 50000
      product_data: {
        name: bill.name,                        // "Advisory and Onboarding"
      },
    },
  }],
  success_url: '...',
  cancel_url: '...',
  metadata: {
    billId: bill.id,                           // OUR ID (for webhook)
  },
});
```

## 🗄️ Database Schema - What Lives Where

### company_hqs Table (Our Database)

```sql
company_hqs
├─ id: "24beffe1-..." (OUR PRIMARY KEY)
├─ companyName: "BusinessPoint Law"
└─ stripeCustomerId: "cus_abc123..." (STRIPE ID - Foreign Key to Stripe)
```

**Key Point:** `stripeCustomerId` is the ONLY Stripe ID we store. It's the bridge.

### bills Table (Our Database)

```sql
bills
├─ id: "cmkzxj9km0000lc04kzjotdgn" (OUR PRIMARY KEY)
├─ companyId: "24beffe1-..." (FOREIGN KEY → company_hqs.id)
├─ amountCents: 50000
├─ currency: "usd"
└─ stripeCheckoutSessionId: NULL (We don't store this anymore!)
```

**Key Point:** `companyId` links to `company_hqs`, which has `stripeCustomerId`.

## 🔄 Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ OUR DATABASE                                                │
├─────────────────────────────────────────────────────────────┤
│ bills                                                       │
│ ├─ id: "cmkzxj9km..." (OUR ID)                            │
│ ├─ companyId: "24beffe1-..." (OUR ID)                     │
│ └─ amountCents: 50000                                      │
│                                                             │
│ company_hqs                                                 │
│ ├─ id: "24beffe1-..." (OUR ID)                            │
│ └─ stripeCustomerId: "cus_abc123..." (STRIPE ID) ←───────┼──┐
└─────────────────────────────────────────────────────────────┘  │
                                                                 │
                                                                 │
┌─────────────────────────────────────────────────────────────┐  │
│ STRIPE API CALL                                             │  │
├─────────────────────────────────────────────────────────────┤  │
│ stripe.checkout.sessions.create({                           │  │
│   customer: "cus_abc123...", ←────────────────────────────┼──┘
│   mode: "payment",                                          │
│   line_items: [{                                            │
│     price_data: {                                           │
│       currency: "usd",                                      │
│       unit_amount: 50000,                                   │
│       product_data: {                                       │
│         name: "Advisory and Onboarding",                    │
│       },                                                    │
│     },                                                      │
│   }],                                                       │
│   metadata: {                                               │
│     billId: "cmkzxj9km...", ← OUR ID (for webhook)         │
│   },                                                        │
│ })                                                          │
└─────────────────────────────────────────────────────────────┘
```

## ✅ What Stripe Actually Needs (Minimal Payload)

If we strip away everything optional, Stripe's MINIMUM requirements are:

```typescript
stripe.checkout.sessions.create({
  mode: 'payment',                    // REQUIRED
  line_items: [{                       // REQUIRED
    price_data: {
      currency: 'usd',                 // REQUIRED
      unit_amount: 50000,              // REQUIRED (cents)
      product_data: {
        name: 'Advisory and Onboarding', // REQUIRED
      },
    },
    quantity: 1,                       // REQUIRED
  }],
  success_url: 'https://...',          // REQUIRED
  cancel_url: 'https://...',           // REQUIRED
  
  // Optional but we use:
  customer: 'cus_abc123...',           // OPTIONAL - Links to Stripe customer
  expires_at: 1234567890,             // OPTIONAL - Session expiration
  metadata: { ... },                   // OPTIONAL - Our data
})
```

## 🎯 The Answer

**Stripe needs:**
1. ✅ **`customer`** - Stripe Customer ID (`cus_...`) - **This comes from `company_hqs.stripeCustomerId`**
2. ✅ **`line_items`** - Amount, currency, product name - **This comes from `bill`**
3. ✅ **`mode`** - `'payment'` for one-time - **Hardcoded**
4. ✅ **`success_url`** / **`cancel_url`** - Redirect URLs - **Our domain**

**Stripe DOESN'T need:**
- ❌ `companyId` - This is OUR internal ID
- ❌ `billId` - This is OUR internal ID  
- ❌ Any of our database structure

**The Bridge:**
- `company_hqs.stripeCustomerId` = The ONLY Stripe ID we need
- This links our company to Stripe's customer
- Stripe uses this customer ID for billing

## 🔍 Why It Might Be Failing

### Possible Issue #1: stripeCustomerId is NULL

**Symptom:** `company.stripeCustomerId` is `null`

**What happens:**
1. `getOrCreateStripeCustomer()` is called
2. It tries to create a Stripe customer
3. If this fails → No customer ID → Can't create session

**Check:**
```sql
SELECT id, "companyName", "stripeCustomerId" 
FROM company_hqs 
WHERE id = '24beffe1-6ada-4442-b90b-7e3ad8a2ec7d';
```

### Possible Issue #2: Stripe Customer Creation Fails

**Symptom:** `getOrCreateStripeCustomer()` throws error

**Causes:**
- Stripe API key invalid/missing
- Network error
- Stripe API down
- Invalid company name

**Check:** Look for errors in `getOrCreateStripeCustomer()` logs

### Possible Issue #3: Checkout Session Creation Fails

**Symptom:** `stripe.checkout.sessions.create()` throws error

**Causes:**
- Invalid customer ID
- Invalid amount (must be > 0)
- Invalid currency
- Stripe API error

**Check:** Look for Stripe API error messages

## 📊 Payload Breakdown by Source

| Stripe Field | Value Example | Source | Our Field |
|--------------|---------------|--------|-----------|
| `customer` | `"cus_abc123..."` | `company_hqs.stripeCustomerId` | ← **THE BRIDGE** |
| `line_items[0].price_data.currency` | `"usd"` | `bill.currency` | `bill.currency` |
| `line_items[0].price_data.unit_amount` | `50000` | `bill.amountCents` | `bill.amountCents` |
| `line_items[0].price_data.product_data.name` | `"Advisory..."` | `bill.name` | `bill.name` |
| `line_items[0].price_data.product_data.description` | `"Initial..."` | `bill.description` | `bill.description` |
| `metadata.billId` | `"cmkzxj9km..."` | `bill.id` | `bill.id` (for webhook) |
| `metadata.companyId` | `"24beffe1-..."` | `company.id` | `company_hqs.id` (for webhook) |

## 🎬 Summary

**The ONLY Stripe ID we need is `stripeCustomerId` on `company_hqs`.**

Everything else Stripe needs comes from:
- Bill data (amount, currency, name)
- Hardcoded values (mode, URLs)
- Our metadata (for webhook lookup)

**The flow:**
1. Bill has `companyId` → Links to `company_hqs`
2. `company_hqs` has `stripeCustomerId` → Links to Stripe customer
3. We use `stripeCustomerId` in Stripe API call
4. Stripe creates session using their customer ID
5. We store `billId` in metadata → Webhook uses it to find our bill

**If it's failing, check:**
1. Does `company_hqs.stripeCustomerId` exist?
2. Can we create Stripe customer if it doesn't?
3. Is Stripe API key valid?
4. Are all bill fields valid (amount > 0, valid currency)?
