# Plan assign, checkout URL, and start date

## 1. Is assign deprecated? Does it hydrate?

**No — assign is the current, supported approach.** It’s not deprecated.

When you **Assign company to this plan**:

- The API `POST /api/platform/plans/assign` sets **`company_hqs.planId`** (direct FK).
- That assignment is what the rest of the system uses:
  - **Stripe checkout** (`POST /api/stripe/checkout`) requires the company to already have that plan: it loads the company, checks `company.plans.id === planId`, then creates a Stripe session. So assign must happen first.
  - **Settings → Billing** (`/settings/billing`) shows the company’s plan and a “Pay” button that calls that checkout API.
  - **Stripe webhook** (`checkout.session.completed`) uses `companyHQId` + `planId` from session metadata and updates `company_hqs` (planStatus, stripeSubscriptionId, planStartedAt).

So: **assign = “this company is on this plan.”** It hydrates everywhere that cares about plan+company (checkout, billing page, webhook). No separate “plan+company assigned” record is needed; `company_hqs.planId` is the source of truth.

---

## 2. “Send the dude a URL” (like billing)

**Bills** have a **static public URL** you can send:

- e.g. `https://bills.ignitegrowth.biz/{companySlug}/{billPart}`
- Customer opens link → page loads → we create a Stripe Checkout session and show a Pay button. One link, no login.

**Plans** today do **not** have an equivalent “send one link” flow:

- Checkout is **authenticated**: `POST /api/stripe/checkout` (Firebase token) with `companyHQId`, `planId`, `successUrl`.
- The only place that calls it is the **app** billing page (`/settings/billing`), when the logged-in user clicks Pay. So the customer has to be in the app, not just click a link from email.

So for “I want to send the dude a URL” for a plan (e.g. seed subscription / retainer), you have two directions:

- **Option A – Public plan-checkout URL (bills-style)**  
  Add a public route, e.g.  
  `https://checkout.ignitegrowth.biz/plan/{companySlug}/{planId}` or a tokenized link.  
  That page would:
  1. Resolve company + plan (by slug + planId or by token).
  2. Create a Stripe Checkout session (server-side, no auth required for the link).
  3. Redirect to Stripe or show a “Pay” button.  
  Then in Platform Manager, after assigning the plan, show a “Copy checkout link” that uses this URL.

- **Option B – Keep current flow**  
  Customer goes to the app → Billing → Pay. No single “send this URL” link; you’d send them to the app and they use billing there.

If the goal is “same as billing — send one link,” Option A is what’s missing.

---

## 3. Start date when assigning

**Today there is no “start date” when you assign.** The assign API only sets `company_hqs.planId`. It does **not** set:

- `planStartedAt`
- `planEndedAt`
- Any “subscription starts on” field

**When does `planStartedAt` get set?**

- In the **Stripe webhook** when checkout completes:  
  `planStartedAt: new Date()` (and planStatus, stripeSubscriptionId, etc.). So “start” is effectively “when they paid.”

So:

- **If “start date” = “when did they get access”**  
  Current behavior is: start = time of successful checkout. No UI for “starts on date” at assign time.

- **If “start date” = “when should the subscription / first charge happen”**  
  That would require:
  1. Optional **start date (or billing anchor) when assigning** (e.g. in the assign API + Plan Builder UI).
  2. When creating the **Stripe subscription**, pass that through (e.g. `billing_cycle_anchor` or trial end) so the first charge happens on that date. Right now we don’t pass a custom anchor; Stripe uses “now” when the session is created.

**Concrete next steps for “start date at assign”:**

1. **Assign API**: Add optional body field, e.g. `startDate` (ISO date). If provided, set `company_hqs.planStartedAt = startDate` (and optionally use it when creating the Stripe session later).
2. **Plan Builder UI**: In “Assign company to this plan,” add an optional “Subscription starts on” (date picker). On assign, send that as `startDate`.
3. **Stripe**: When creating a subscription from the plan, if `company_hqs.planStartedAt` is in the future (or you store a separate “billing anchor” from assign), use it as `billing_cycle_anchor` (or equivalent) so the first invoice is on that date.

---

## Summary

| Question | Answer |
|----------|--------|
| Is assign deprecated? | No. Assign sets `company_hqs.planId` and that hydrates checkout, billing, and webhook. |
| Does it hydrate as “plan+company assigned”? | Yes. `company_hqs.planId` is the single source of truth; no extra “assignment” record. |
| Can we send a URL like billing? | Not yet. Bills have a public URL; plans only have in-app checkout. Need a public plan-checkout URL (Option A above) to “send the dude a link.” |
| How do we set start date when assigning? | Not implemented. Today start = when they pay (webhook). To support “starts on X”: add optional start date to assign API + UI and pass it to Stripe when creating the subscription. |
