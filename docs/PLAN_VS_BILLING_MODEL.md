# Plan (universal) vs Billing (many-to-one) — and do we need planForCompanyId?

## Mental model you’re describing

- **Plan** = universal, **one-to-many**. Like a SaaS catalog: one plan row (“Gold Monthly $100”) is shared; many companies can be on it. No “assign” on the plan screen — plan is just the definition. Companies get on a plan when they **self-select** in the app (or when we use the billing flow below).
- **Billing** = **many-to-one**. We create a bill or a subscription link **for** a specific company. So the action is “for this company, here’s a link” — the company is the target, not the plan.

So: **Plan = catalog (one-to-many). Billing = “for this company” (many-to-one).**

---

## How it works today (no planForCompanyId)

**Data model**

- **`plans`** — one row per product (e.g. “CRM Management Monthly Retainer”). Universal. `company_hqs[]` = many companies can reference it.
- **`company_hqs.planId`** — FK to `plans`. Meaning: “this company is on this plan.”

So the **assignment** is just “company has a plan”: `company_hqs.planId`. There is no separate “plan for company” row.

**Two ways a company gets `planId` set**

1. **Self-serve** — In the app, the company (user) picks a plan at checkout → we set `company_hqs.planId`. Same universal plan row.
2. **Subscription link (billing)** — Admin picks plan + company in “Subscription link”, we call assign API → we set `company_hqs.planId` and show the link. Still the **same** universal plan row; we’re just setting the FK for that company so the link works.

So for the “send them a link” use case we **don’t** need a new `planForCompanyId` or a new table. We use:

- The **universal** plan (one-to-many).
- The **company** we’re sending the link to.
- The **assignment** = `company_hqs.planId` pointing at that plan.

Same model for both self-serve and “admin sent link”; only the **flow** differs (who set the FK).

---

## When you *would* need “plan for company” (planForCompanyId / company-specific plan)

You’d add something like “plan for company” only if you need **company-specific plans** — i.e. a plan that exists for one company only (e.g. custom pricing, custom product name, one-off deal).

Options then:

**Option A — Optional `companyId` on `plans`**

- `plans.companyId` = `null` → universal (catalog) plan (one-to-many).
- `plans.companyId` = set → this plan is only for that company (custom plan for that company).
- List “available plans” for a company = universal plans + plans where `companyId = this company`.

**Option B — Separate “plan assignment” or “deal” table**

- e.g. `plan_assignments(companyId, planId, customAmountCents?, ...)` for overrides or custom terms, while `plans` stays 100% universal.
- Company’s “effective” plan = universal plan + optional overrides from that table.

**Option C — Keep current model**

- No company-specific plan. Every plan is universal. Custom deals are handled by:
  - a different plan row (e.g. “Acme custom monthly”), or
  - one-off **bills** for that company (many-to-one), not a recurring plan.

---

## Recommendation

- **For the current “subscription link” flow:** keep the existing model. Plan = universal (one-to-many). Billing = “pick plan + company, assign, get link.” Assignment = `company_hqs.planId` only. No `planForCompanyId` needed.
- **Add “plan for company” (or planForCompanyId) only when** you need true company-specific plans (custom pricing per company, or plans that only one company can see). Then introduce either optional `plans.companyId` (Option A) or a separate assignment/override table (Option B) and document the rule: universal vs company-specific.

So: you’re not missing a planForCompanyId for the link flow; that’s just “assign this universal plan to this company.” Plan stays universal; billing stays many-to-one; the special case is “we set the link up for this company,” not a new kind of plan.
