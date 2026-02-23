# Retainer flow: why company at start, Stripe, and where data lives

**Purpose:** Clarify why company is chosen at retainer creation, how Stripe ties to the company’s existing customer ID, and where data is stored (IgniteBd DB only; Platform Manager proxies).

<!--
PARSE_BLOB
title: Retainer Stripe and Data Flow
purpose: Why company at start; Stripe flow (reuse company.stripeCustomerId); where DB lives (IgniteBd only); proxy vs backend.
where_data_lives: IgniteBd app DB only (Prisma/Postgres). company_hqs, company_retainers, bills, plans, invoices. Platform Manager has no DB; proxies to IGNITEBD_API_URL.
stripe_flow: Retainer is ONE-OFF payment (mode payment, like bills). Create retainer → client opens link → getOrCreateStripeCustomer → Checkout Session payment mode, metadata type=company_retainer. Webhook checkout.session.completed sets retainer ACTIVE, paidAt. No subscription. Monthly repeat = future cron/service that creates bill (or new payment) and sends link.
company_at_start: Retainer is for one company; companyId set at creation. Link encodes company+retainer; no separate assign step.
key_entities: company_hqs (stripeCustomerId), company_retainers (companyId, slug, publicRetainerUrl, paidAt). No stripeSubscriptionId for one-off.
proxy: Platform Manager UI → /api/platform/* proxies to IgniteBd APIs; auth forwarded; all writes in IgniteBd.
retainer_container: Public URL /retainer/[companySlug]/[part] uses RetainerContainer; same layout as InvoiceBill.
webhooks: checkout.session.completed for company_retainer → set retainer ACTIVE, paidAt. invoice.paid etc. still used for plan subscriptions and legacy; retainers are one-off so no subscription events.
monthly_later: To make monthly automatic: cron or service finds retainers (e.g. by last paidAt or schedule), creates a new bill (or new payment opportunity), gets public URL, sends link (email etc.).
PARSE_BLOB
-->

---

## 1. Why we “assign” the company at start

We’re not “assigning” in the plan sense. We’re **creating a retainer that is for one company**.

- A **retainer** is “monthly bill for this company.” So when you create it, you must say **which company** it’s for.
- That gives us:
  - A `company_retainers` row with `companyId` (e.g. BusinessPoint Law’s id).
  - A public URL that encodes company + retainer (e.g. `/retainer/businesspoint-law/crm-management-xyz`).

When the client opens the link:

- We look up the retainer by slug.
- We get the company from `retainer.company_hqs` (including `stripeCustomerId`).
- We create a Stripe Checkout Session **for that Stripe customer** and that retainer.

So “company at start” = “this retainer and this link belong to this company.” No second step to “assign” later.

---

## 2. Stripe flow: one-off payment (like bills)


Retainers are **one-off payments** — same pattern as bills. No Stripe subscription; you get control for upcharge, summary of items, etc. Monthly repeat is wired later via a cron/service that creates a new bill (or payment opportunity) and sends the link.

**Step-by-step:** (1) Create retainer → get public link. (2) Client opens link → we load retainer + company (`stripeCustomerId`, e.g. `cus_TsAEnGO0GKyYK6`). (3) We create Checkout Session with `mode: "payment"` (one-off), customer, line_items (no recurring), metadata `type: company_retainer`, retainerId, companyId. (4) User pays once. (5) Webhook `checkout.session.completed` → set retainer ACTIVE, paidAt, activatedAt (no stripeSubscriptionId). Implementation: `lib/stripe/retainerCheckout.ts`.

### Monthly repeat (future): cron + service

To make "the dude gets another bill every month" automatic: a **cron or scheduled service** (e.g. monthly) finds retainers that are due (e.g. by `paidAt` or schedule), **creates a new bill** for that company (existing bill flow) with the retainer amount or variable/upcharge, gets the public bill URL, and **sends the link** (email, Slack, etc.). Client pays one-off; next month the cron runs again.

### Webhooks for retainers (one-off)

Only `checkout.session.completed` (metadata type = company_retainer) matters for retainers: we set ACTIVE, paidAt, activatedAt. Subscription events (invoice.paid, etc.) are still used for **plan** subscriptions; retainers are one-off so no subscription id.

### Customer notification

Stripe can email a **receipt** for the one-time payment (Dashboard → Settings → Customer emails → "Successful payments"). When you add the monthly cron, your "send the link" step can use the **template email with the bill embedded**: `lib/email/billPaymentLinkTemplate.js` (HTML + text) and `lib/email/sendBillPaymentLinkEmail.js` (SendGrid). API: `POST /api/billing/send-payment-link` with body `{ to, paymentUrl, amountFormatted, companyName, description?, isRetainer? }` sends that email (auth required).


---

## 3. Proxy vs DB: where everything lives

**Single source of truth: IgniteBd (Ignite stack)**

- **Database**: All of it is in the **IgniteBd** app’s DB (Prisma/Postgres).
  - `company_hqs` (including `stripeCustomerId`), `company_retainers`, `bills`, `plans`, `invoices`, etc. — all live there.
- **Stripe**: Stripe Customer IDs and Subscription IDs are stored on that same DB (e.g. `company_hqs.stripeCustomerId`, `company_retainers.stripeSubscriptionId`).
- **Webhooks**: Stripe is configured to send webhooks to **IgniteBd** (e.g. `https://api.ignitegrowth.biz/api/stripe/webhook` or whatever your IgniteBd URL is). IgniteBd is the only app that updates DB from Stripe events for this flow.

**Platform Manager = UI only (proxy)**

- Platform Manager **does not have its own DB** for companies, retainers, or Stripe state.
- When you use “Retainers” or “Create retainer”:
  - The browser talks to Platform Manager (e.g. `platform.ignitegrowth.biz` or `app.ignitegrowth.biz`).
  - Platform Manager’s API routes (e.g. `/api/platform/retainers`) **proxy** the request to IgniteBd (e.g. `IGNITEBD_API_URL` → `https://api.ignitegrowth.biz`), forwarding auth and body.
  - IgniteBd validates auth, reads/writes **its** DB, and returns JSON. Platform Manager returns that to the client.

So: **all persistence and Stripe linkage are on the Ignite stack (IgniteBd).** The “proxy war” is just: Platform Manager is the front office; IgniteBd is the backend and the only place that saves this data.

---

## 4. Your company record in this flow

For BusinessPoint Law (`id: 24beffe1-6ada-4442-b90b-7e3ad8a2ec7d`):

- `stripeCustomerId: "cus_TsAEnGO0GKyYK6"` → we use this for the retainer Checkout Session. No new Stripe customer.
- `planId`, `planStatus`, `stripeSubscriptionId` = null → SaaS plan fields; retainer flow does not set these. Retainer state lives only in `company_retainers` (and Stripe’s subscription object).

When you create a retainer for this company and the client pays (one-off):

- A row in `company_retainers` exists with `companyId = 24beffe1-...`; we set status ACTIVE, paidAt, activatedAt. No `stripeSubscriptionId` (one-off).
- `company_hqs` for BusinessPoint Law is unchanged (same `stripeCustomerId`, still no `planId`/`planStatus`/`stripeSubscriptionId` unless you use the SaaS plan flow separately). Monthly repeat later: cron creates a new bill and sends the link.

---

## 5. Retainer “container” on load from URL

When a client opens the retainer link (e.g. `https://app.ignitegrowth.biz/retainer/businesspoint-law/crm-management-xyz`), the page that loads is the **retainer container** — the same style as the billing (bill) container:

- **Bill:** `app/(public)/[companySlug]/[part]/page.jsx` uses **`InvoiceBill`** (`components/bill/InvoiceBill.jsx`) — red header with logo, “From” / “Bill To”, invoice details, amount, “Pay Here” CTA.
- **Retainer:** `app/(public)/retainer/[companySlug]/[part]/page.jsx` uses **`RetainerContainer`** (`components/retainer/RetainerContainer.jsx`) — same layout: red header with logo (“Monthly retainer”), “From” / “Retainer for” (company name + address), retainer name/description, amount per month + optional start date, “Continue to secure payment” CTA, same footer.

So the retainer URL load presents the same container experience as the bill URL; only the label (“Invoice” vs “Monthly retainer”) and the “Bill To” vs “Retainer for” copy differ. Data for the container (retainer, company name/address, checkout URL) is loaded server-side on that page.
