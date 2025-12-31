# Client Portal Checkout Implementation Analysis

**Date:** 2025-01-28  
**Status:** Analysis - Needs Update for New Invoice Schema

---

## 🔍 Current Checkout Implementation

### Routes Found

1. **`POST /api/client/billing/[invoiceId]/checkout`** - Create Stripe checkout session
2. **`GET /api/client/billing/[invoiceId]/verify/[sessionId]`** - Verify payment (fallback)
3. **`POST /api/webhook/stripe`** - Stripe webhook handler
4. **`GET /api/client/billing`** - List invoices for client

---

## 🔒 Security: Server-Side Stripe Integration

**✅ CONFIRMED: All Stripe API calls are made server-side**

### Server-Side Route (`app/api/client/billing/[invoiceId]/checkout/route.js`)

```javascript
import Stripe from 'stripe';

// ✅ Server-side Stripe SDK (NOT client-side)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request, { params }) {
  // ... authentication and validation ...
  
  // ✅ Server-side Stripe API call
  const customer = await stripe.customers.create({
    email: contact.email || undefined,
    name: contact.firstName && contact.lastName 
      ? `${contact.firstName} ${contact.lastName}` 
      : contact.goesBy || undefined,
    metadata: {
      contactId: contact.id,
      companyId: contact.contactCompanyId || '',
    },
  });
  
  // ✅ Server-side Stripe checkout session creation
  const session = await stripe.checkout.sessions.create({
    ui_mode: 'embedded',
    payment_method_types: ['card'],
    customer: stripeCustomerId,
    line_items: [...],
    mode: 'payment',
    return_url: `${frontendUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}&invoice_id=${invoiceId}`,
    metadata: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      proposalId: invoice.proposalId,
      contactId: contact.id,
    },
  });
  
  // ✅ Returns clientSecret (safe to send to client)
  return NextResponse.json({
    success: true,
    clientSecret: session.client_secret,
    sessionId: session.id,
  });
}
```

### Client-Side Component (`InvoicePaymentModal.jsx`)

```javascript
// ✅ Client calls OUR API route (not Stripe directly)
const response = await api.post(`/api/client/billing/${invoice.id}/checkout`);

// ✅ Receives clientSecret from our server
if (response.data?.success && response.data.clientSecret) {
  setClientSecret(response.data.clientSecret);
}

// ✅ Uses clientSecret with Stripe's embedded checkout component
<EmbeddedCheckoutProvider
  stripe={stripePromise}  // Uses NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  options={{ fetchClientSecret }}
>
  <EmbeddedCheckout />
</EmbeddedCheckoutProvider>
```

### Security Confirmation

✅ **Secret Key Never Exposed:** `STRIPE_SECRET_KEY` is only used server-side  
✅ **Client Only Receives:** `clientSecret` (safe to expose)  
✅ **Client Uses Publishable Key:** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (safe to expose)  
✅ **All Stripe API Calls:** Made server-side via `stripe.checkout.sessions.create()`

### Flow Diagram

```
┌─────────────┐
│   CLIENT     │
│  (Browser)   │
└──────┬───────┘
       │
       │ POST /api/client/billing/[invoiceId]/checkout
       │ (Firebase token in header)
       ▼
┌─────────────────────────────────────┐
│   YOUR SERVER                        │
│   (Next.js API Route)                │
│                                      │
│   1. Verify Firebase token          │
│   2. Get invoice from database      │
│   3. Verify permissions              │
│   4. stripe.customers.create()      │ ← Server-side Stripe SDK
│   5. stripe.checkout.sessions.create() ← Server-side Stripe SDK
│   6. Return clientSecret             │
└──────┬──────────────────────────────┘
       │
       │ { clientSecret: "cs_..." }
       ▼
┌─────────────┐
│   CLIENT     │
│  (Browser)   │
│              │
│ Uses clientSecret with              │
│ Stripe Embedded Checkout            │
│ (client-side component)             │
└─────────────┘
```

**Summary:** This follows Stripe's recommended security pattern - secret keys stay on the server, and the client only receives the `clientSecret` needed for the embedded checkout UI.

---

## 🔄 Callback URL Handling - Server-Side Configuration

**✅ CONFIRMED: Callback URLs are configured server-side**

### Two Types of Callbacks

#### 1. Client-Side Redirect (Return URL) - For UX

**Server-Side Configuration** (`app/api/client/billing/[invoiceId]/checkout/route.js`):

```javascript
// ✅ Server-side: Set return URL when creating checkout session
const session = await stripe.checkout.sessions.create({
  ui_mode: 'embedded',
  payment_method_types: ['card'],
  customer: stripeCustomerId,
  line_items: [...],
  mode: 'payment',
  
  // ✅ RETURN URL configured server-side
  return_url: `${frontendUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}&invoice_id=${invoiceId}`,
  
  metadata: {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    proposalId: invoice.proposalId,
    contactId: contact.id,
  },
});

// frontendUrl is determined server-side:
const frontendUrl = process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL || 
                   (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
```

**How It Works:**
1. ✅ Server creates checkout session with `return_url`
2. ✅ Stripe replaces `{CHECKOUT_SESSION_ID}` with actual session ID
3. ✅ After payment, Stripe redirects client to: `/dashboard?session_id=cs_xxx&invoice_id=yyy`
4. ✅ Client-side dashboard can verify payment using the verify route

**Environment Variable:**
- `NEXT_PUBLIC_CLIENT_PORTAL_URL` - Set server-side (e.g., `https://clientportal.ignitegrowth.biz`)

---

#### 2. Server-Side Webhook (Primary Callback) - For Reliability

**Webhook Endpoint** (`app/api/webhook/stripe/route.js`):

```javascript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request) {
  // ✅ Server-side: Verify webhook signature
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');
  
  // ✅ Server-side: Verify webhook is from Stripe
  const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  
  // ✅ Server-side: Handle payment events
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // ✅ Server-side: Find invoice by session ID
    const invoice = await prisma.invoice.findUnique({
      where: { stripeCheckoutSessionId: session.id },
    });
    
    if (invoice) {
      // ✅ Server-side: Update invoice status
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'paid',
          paidAt: new Date(),
          stripePaymentIntentId: session.payment_intent,
          paidByContactId: session.metadata?.contactId,
        },
      });
    }
  }
  
  return NextResponse.json({ received: true });
}
```

**How It Works:**
1. ✅ Stripe sends webhook POST to: `https://your-domain.com/api/webhook/stripe`
2. ✅ Server verifies webhook signature using `STRIPE_WEBHOOK_SECRET`
3. ✅ Server processes payment event server-side
4. ✅ Server updates invoice status in database
5. ✅ Works even if client closes browser (async)

**Environment Variables:**
- `STRIPE_SECRET_KEY` - Server-side only
- `STRIPE_WEBHOOK_SECRET` - Server-side only (from Stripe dashboard)

**Stripe Dashboard Configuration:**
- Webhook endpoint URL: `https://your-domain.com/api/webhook/stripe`
- Events to listen for:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`

---

### Callback Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  PAYMENT COMPLETES                                          │
└───────────────┬─────────────────────────────────────────────┘
                │
                ├─────────────────────────────────────┐
                │                                     │
                ▼                                     ▼
┌──────────────────────────────┐    ┌──────────────────────────────────┐
│  CLIENT-SIDE REDIRECT        │    │  SERVER-SIDE WEBHOOK             │
│  (For UX)                    │    │  (For Reliability)               │
├──────────────────────────────┤    ├──────────────────────────────────┤
│                              │    │                                  │
│  Stripe redirects client to: │    │  Stripe POSTs to:                │
│  /dashboard?session_id=xxx  │    │  /api/webhook/stripe             │
│                              │    │                                  │
│  Client can verify via:      │    │  Server verifies signature       │
│  GET /api/client/billing/    │    │  Server updates invoice          │
│    [invoiceId]/verify/       │    │  Server logs payment             │
│    [sessionId]               │    │                                  │
│                              │    │  ✅ Works even if client closes   │
│  ⚠️ Requires client to      │    │  ✅ Async - doesn't block         │
│     complete redirect         │    │  ✅ Source of truth              │
└──────────────────────────────┘    └──────────────────────────────────┘
```

---

### Key Points

✅ **Return URL:** Configured server-side when creating checkout session  
✅ **Webhook URL:** Configured in Stripe dashboard, handled server-side  
✅ **Both use server-side Stripe SDK:** `stripe.checkout.sessions.create()` and `stripe.webhooks.constructEvent()`  
✅ **No client-side Stripe API calls:** All Stripe interactions are server-side  
✅ **Webhook is primary:** More reliable than client redirect  
✅ **Client redirect is fallback:** For immediate UX feedback

---

## 📋 Current Implementation Details

### 1. Checkout Route (`/api/client/billing/[invoiceId]/checkout`)

**File:** `ignitebd-clientportal/app/api/client/billing/[invoiceId]/checkout/route.js`

**Current Flow:**
1. Verify Firebase token → Get Contact by `firebaseUid`
2. Get invoice with `proposal` relation:
   ```javascript
   const invoice = await prisma.invoice.findUnique({
     where: { id: invoiceId },
     include: {
       proposal: {
         select: {
           id: true,
           companyId: true,
           clientCompany: true,
         },
       },
     },
   });
   ```
3. Verify invoice belongs to contact's company:
   ```javascript
   if (invoice.proposal.companyId !== contact.contactCompanyId) {
     return error;
   }
   ```
4. Create Stripe customer (if needed)
5. Create Stripe checkout session with:
   - `invoice.invoiceNumber`
   - `invoice.amount` (converted to cents)
   - `invoice.currency`
   - `invoice.description`
   - `invoice.proposal.clientCompany` (for description)
6. Store `stripeCheckoutSessionId` on invoice
7. Return `clientSecret` and `sessionId`

**Fields Used:**
- ✅ `invoice.id`
- ✅ `invoice.stripeCustomerId`
- ✅ `invoice.invoiceNumber`
- ✅ `invoice.amount`
- ✅ `invoice.currency`
- ✅ `invoice.description`
- ✅ `invoice.status`
- ❌ `invoice.proposal` - **DOESN'T EXIST IN NEW SCHEMA**
- ❌ `invoice.proposalId` - **DOESN'T EXIST IN NEW SCHEMA**
- ❌ `invoice.proposal.companyId` - **DOESN'T EXIST IN NEW SCHEMA**
- ❌ `invoice.proposal.clientCompany` - **DOESN'T EXIST IN NEW SCHEMA**

---

### 2. Verify Route (`/api/client/billing/[invoiceId]/verify/[sessionId]`)

**File:** `ignitebd-clientportal/app/api/client/billing/[invoiceId]/verify/[sessionId]/route.js`

**Current Flow:**
1. Verify Firebase token → Get Contact
2. Get invoice with `proposal` relation
3. Verify invoice belongs to contact's company via `proposal.companyId`
4. Verify session matches invoice
5. Retrieve session from Stripe
6. If paid, update invoice:
   ```javascript
   await prisma.invoice.update({
     where: { id: invoiceId },
     data: {
       status: 'paid',
       paidAt: new Date(),
       stripePaymentIntentId: session.payment_intent,
       paidByContactId: session.metadata?.contactId,
     },
   });
   ```

**Fields Used:**
- ✅ `invoice.id`
- ✅ `invoice.stripeCheckoutSessionId`
- ✅ `invoice.status`
- ✅ `invoice.paidAt`
- ✅ `invoice.stripePaymentIntentId`
- ✅ `invoice.paidByContactId`
- ❌ `invoice.proposal` - **DOESN'T EXIST IN NEW SCHEMA**
- ❌ `invoice.proposal.companyId` - **DOESN'T EXIST IN NEW SCHEMA**

---

### 3. Webhook Route (`/api/webhook/stripe`)

**File:** `ignitebd-clientportal/app/api/webhook/stripe/route.js`

**Current Flow:**
1. Verify webhook signature
2. Handle `checkout.session.completed` event
3. Find invoice by `stripeCheckoutSessionId`
4. Update invoice status:
   ```javascript
   await prisma.invoice.update({
     where: { id: invoice.id },
     data: {
       status: 'paid',
       paidAt: new Date(),
       stripePaymentIntentId: session.payment_intent,
       paidByContactId: session.metadata?.contactId,
     },
   });
   ```

**Fields Used:**
- ✅ `invoice.stripeCheckoutSessionId`
- ✅ `invoice.id`
- ✅ `invoice.status`
- ✅ `invoice.paidAt`
- ✅ `invoice.stripePaymentIntentId`
- ✅ `invoice.paidByContactId`
- ✅ `invoice.invoiceNumber` (for logging)

**Status:** ✅ **Mostly compatible** - only needs minor updates

---

### 4. List Invoices Route (`/api/client/billing`)

**File:** `ignitebd-clientportal/app/api/client/billing/route.js`

**Current Flow:**
1. Verify Firebase token → Get Contact
2. Get invoices via `proposal.companyId`:
   ```javascript
   const invoices = await prisma.invoice.findMany({
     where: {
       proposal: {
         companyId: contact.contactCompanyId,
       },
     },
     include: {
       proposal: {
         select: {
           id: true,
           clientCompany: true,
         },
       },
     },
   });
   ```
3. Return formatted invoice list

**Fields Used:**
- ✅ `invoice.id`
- ✅ `invoice.invoiceNumber`
- ✅ `invoice.amount`
- ✅ `invoice.currency`
- ✅ `invoice.description`
- ✅ `invoice.status`
- ✅ `invoice.dueDate`
- ✅ `invoice.paidAt`
- ✅ `invoice.paidByContactId`
- ❌ `invoice.proposal` - **DOESN'T EXIST IN NEW SCHEMA**
- ❌ `invoice.proposal.companyId` - **DOESN'T EXIST IN NEW SCHEMA**
- ❌ `invoice.proposal.clientCompany` - **DOESN'T EXIST IN NEW SCHEMA**

---

## ⚠️ Issues with New Schema

### Problem: `invoice.proposal` Doesn't Exist

The client portal code assumes invoices are linked to proposals, but the new schema has:
- `invoice.workPackageId` (optional - for legacy invoices)
- `invoice.companyId` (optional - billing company)
- `invoice.contactId` (optional - billing contact)
- `invoice.companyHQId` (required - company scope)

### Solution: Update to Use New Schema Fields

**For Company Verification:**
- Old: `invoice.proposal.companyId === contact.contactCompanyId`
- New: `invoice.companyId === contact.contactCompanyId` OR `invoice.companyHQId === contact.crmId`

**For Invoice Description:**
- Old: `invoice.proposal.clientCompany`
- New: `invoice.invoiceName` or `invoice.company.companyName`

---

## 🔧 Required Updates

### 1. Update Checkout Route

**Change:**
```javascript
// OLD
const invoice = await prisma.invoice.findUnique({
  where: { id: invoiceId },
  include: {
    proposal: {
      select: {
        companyId: true,
        clientCompany: true,
      },
    },
  },
});

// Verify via proposal
if (invoice.proposal.companyId !== contact.contactCompanyId) {
  return error;
}
```

**To:**
```javascript
// NEW
const invoice = await prisma.invoice.findUnique({
  where: { id: invoiceId },
  include: {
    company: {
      select: {
        id: true,
        companyName: true,
      },
    },
    contact: {
      select: {
        id: true,
        contactCompanyId: true,
      },
    },
  },
});

// Verify via companyId or companyHQId
const hasAccess = 
  invoice.companyId === contact.contactCompanyId ||
  invoice.companyHQId === contact.crmId;

if (!hasAccess) {
  return error;
}
```

**Update Stripe Session:**
```javascript
// OLD
description: invoice.description || `Payment for ${invoice.proposal.clientCompany}`,

// NEW
description: invoice.invoiceDescription || invoice.invoiceName || `Payment for ${invoice.company?.companyName || 'Invoice'}`,
```

### 2. Update Verify Route

**Change:**
```javascript
// OLD
const invoice = await prisma.invoice.findUnique({
  where: { id: invoiceId },
  include: {
    proposal: {
      select: {
        companyId: true,
      },
    },
  },
});

if (invoice.proposal.companyId !== contact.contactCompanyId) {
  return error;
}
```

**To:**
```javascript
// NEW
const invoice = await prisma.invoice.findUnique({
  where: { id: invoiceId },
});

const hasAccess = 
  invoice.companyId === contact.contactCompanyId ||
  invoice.companyHQId === contact.crmId;

if (!hasAccess) {
  return error;
}
```

### 3. Update List Invoices Route

**Change:**
```javascript
// OLD
const invoices = await prisma.invoice.findMany({
  where: {
    proposal: {
      companyId: contact.contactCompanyId,
    },
  },
  include: {
    proposal: {
      select: {
        id: true,
        clientCompany: true,
      },
    },
  },
});
```

**To:**
```javascript
// NEW
const invoices = await prisma.invoice.findMany({
  where: {
    OR: [
      { companyId: contact.contactCompanyId },
      { companyHQId: contact.crmId },
    ],
  },
  include: {
    company: {
      select: {
        id: true,
        companyName: true,
      },
    },
    contact: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    },
  },
});
```

**Update Response:**
```javascript
// OLD
proposal: {
  id: invoice.proposal.id,
  title: invoice.proposal.clientCompany,
}

// NEW
company: {
  id: invoice.company?.id,
  name: invoice.company?.companyName || invoice.invoiceName,
}
```

### 4. Update Webhook Route

**Status:** ✅ **No changes needed** - webhook doesn't use proposal relation

---

## 📊 Field Mapping

| Client Portal Expects | Old Schema | New Schema |
|----------------------|------------|------------|
| `invoice.invoiceNumber` | ✅ `invoiceNumber` | ✅ `invoiceNumber` |
| `invoice.amount` | ✅ `amount` | ✅ `amount` |
| `invoice.currency` | ✅ `currency` | ✅ `currency` |
| `invoice.description` | ✅ `description` | ✅ `invoiceDescription` |
| `invoice.status` | ✅ `status` | ✅ `status` (enum) |
| `invoice.stripeCheckoutSessionId` | ✅ `stripeCheckoutSessionId` | ✅ `stripeCheckoutSessionId` |
| `invoice.stripeCustomerId` | ✅ `stripeCustomerId` | ✅ `stripeCustomerId` |
| `invoice.stripePaymentIntentId` | ✅ `stripePaymentIntentId` | ✅ `stripePaymentIntentId` |
| `invoice.paidAt` | ✅ `paidAt` | ✅ `paidAt` |
| `invoice.paidByContactId` | ✅ `paidByContactId` | ✅ `paidByContactId` |
| `invoice.dueDate` | ❌ Missing | ✅ `dueDate` |
| `invoice.proposal.companyId` | ✅ Via relation | ❌ Use `companyId` or `companyHQId` |
| `invoice.proposal.clientCompany` | ✅ Via relation | ❌ Use `company.companyName` or `invoiceName` |

---

## 🎯 Summary

### Routes That Need Updates:
1. ✅ **Checkout Route** - Update company verification and description
2. ✅ **Verify Route** - Update company verification
3. ✅ **List Invoices Route** - Update query and response format
4. ✅ **Webhook Route** - No changes needed

### Key Changes:
- Replace `invoice.proposal.companyId` with `invoice.companyId` or `invoice.companyHQId`
- Replace `invoice.proposal.clientCompany` with `invoice.company.companyName` or `invoice.invoiceName`
- Update company verification logic to check both `companyId` and `companyHQId`
- Update invoice description to use `invoiceDescription` or `invoiceName`

---

## 📝 Next Steps

1. Update checkout route to use new schema fields
2. Update verify route to use new schema fields
3. Update list invoices route to use new schema fields
4. Test checkout flow with new invoice types (PLATFORM_FEE, MONTHLY_RECURRING, CUSTOM)
5. Verify webhook still works (should be fine)

---

## 🔗 Related Files

- **Client Portal Checkout:** `ignitebd-clientportal/app/api/client/billing/[invoiceId]/checkout/route.js`
- **Client Portal Verify:** `ignitebd-clientportal/app/api/client/billing/[invoiceId]/verify/[sessionId]/route.js`
- **Client Portal List:** `ignitebd-clientportal/app/api/client/billing/route.js`
- **Client Portal Webhook:** `ignitebd-clientportal/app/api/webhook/stripe/route.js`
- **Invoice Modal:** `ignitebd-clientportal/app/components/InvoicePaymentModal.jsx`
- **New Schema:** `IgniteBd-Next-combine/prisma/schema.prisma`

