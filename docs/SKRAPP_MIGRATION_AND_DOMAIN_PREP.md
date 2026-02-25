# Skrapp.io Migration & Domain/Company Prep

**Goal:** Move contact email enrichment from Apollo to Skrapp.io (more reliable). Skrapp’s API expects **first name + last name** and **company name OR company domain** — so we need a clear path to pass domain and company.

**Note:** The product is **Skrapp.io** (https://skrapp.io, API at https://api.skrapp.io). “Skrapio” may be a typo; this doc uses Skrapp.

---

## 1. Skrapp.io API (relevant parts)

- **Auth:** `X-Access-Key: <API_KEY>` (paid account).
- **Email Finder (single):**  
  `GET https://api.skrapp.io/api/v2/find`
  - Query params: `firstName`, `lastName` (or `fullName`), and **at least one of**:
    - `domain` – company domain (e.g. `vistaequity.com`)
    - `company` – company name (e.g. `Vista Equity Partners`)
  - Returns: `{ email, quality: { status, status_message } }`.
- **Bulk Email Finder:**  
  `POST https://api.skrapp.io/api/v2/find_bulk`
  - Body: JSON array of objects with `firstName`, `lastName` (or `name`), and `company` and/or `domain`.
  - Max 100 per request.
  - Same “company OR domain” rule.

So for every enrichment call we need: **name** (first + last or full) and **company and/or domain**.

---

## 2. What we have today (schema & usage)

### Contact

- `firstName`, `lastName`, `companyName` (denormalized).
- `companyDomain` – company domain when we have it.
- `domain` – also used for domain (e.g. in by-email lookup).
- `contactCompanyId` → **companies** (assigned company).

### Companies

- `companyName`, `domain`, `website`.
- When creating/updating a company with `website`, we already derive `domain` in `app/api/companies/route.js` (strip protocol, www, path).

So we **do** have company and domain in the schema; the gap is **reliably populating and using them** for enrichment.

---

## 3. Domain resolution for a contact (how to pass domain)

We need a single place that answers: “What company domain (and name) do we use for this contact when calling Skrapp?”

Suggested helper (e.g. in `lib/enrichment/contactDomain.ts` or `lib/skrapp.ts`):

```ts
/**
 * Resolve company name and domain for a contact (for Skrapp / any provider that needs company or domain).
 * Prefer assigned company; fall back to contact denormalized fields.
 */
function getCompanyAndDomainForContact(contact: {
  companyDomain?: string | null;
  domain?: string | null;
  companyName?: string | null;
  companies?: { companyName?: string | null; domain?: string | null; website?: string | null } | null;
}): { company?: string; domain?: string } {
  const company = contact.companies?.companyName || contact.companyName || undefined;
  const domain =
    contact.companyDomain ||
    contact.domain ||
    contact.companies?.domain ||
    (contact.companies?.website ? extractDomainFromUrl(contact.companies.website) : undefined);
  return { company, domain };
}

function extractDomainFromUrl(website: string): string {
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}
```

Rules:

- **Domain:** Prefer `contact.companyDomain` / `contact.domain`, then `companies.domain`, then domain parsed from `companies.website`.
- **Company:** Prefer `companies.companyName`, then `contact.companyName`.
- For Skrapp we need **at least one of** company or domain; both is fine.

---

## 4. Gaps / prep work

| Area | Status | Action |
|------|--------|--------|
| Contact has company/domain fields | OK | Schema already has `companyDomain`, `domain`, `companyName`, `contactCompanyId`. |
| Companies have domain/website | OK | `companies.domain` and `companies.website` exist; domain is derived from website on create/update. |
| Assigning company to contact | OK | Contact detail and view already support assigning a company. |
| Populating company domain | Partial | Ensure whenever we assign or create a company we set/derive `companies.domain` (and optionally `website`). Companies route already derives domain from website. |
| Contact’s denormalized domain | Partial | Enrich/save already sets `contact.companyDomain` from Apollo. For Skrapp we can set it from `getCompanyAndDomainForContact` when we have it. |
| Bulk enrich currently | Apollo-only | Uses LinkedIn URL only; no company/domain passed. |
| Single contact enrich | Apollo | By email or LinkedIn; no domain. |

So the main prep is:

1. **Use a single “company + domain” resolver** (e.g. `getCompanyAndDomainForContact`) whenever we call an enrichment API that needs company/domain.
2. **Ensure companies have domain** where possible (encourage website/domain on company create/edit; we already derive domain from website).
3. **Add Skrapp as an enrichment provider** and call it when we have name + (company or domain).

---

## 5. Implementation outline

1. **Env**
   - Add `SKRAPP_API_KEY` (or `SKRAPP_ACCESS_KEY`). Get key from Skrapp account (paid).

2. **`lib/skrapp.ts`**
   - `findEmail({ firstName, lastName, company?, domain? })` → GET `/api/v2/find`, return email + quality.
   - Optional: `findBulk(rows: Array<{ firstName, lastName, company?, domain? }>)` → POST `/api/v2/find_bulk`.
   - Header: `X-Access-Key: process.env.SKRAPP_API_KEY`.

3. **`lib/enrichment/contactDomain.ts` (or inside `lib/skrapp.ts`)**
   - `getCompanyAndDomainForContact(contact)` as above.
   - Use it in every place we call Skrapp (and optionally when we still call Apollo so contact/company stay in sync).

4. **Bulk enrich** (`app/api/contacts/bulk-enrich/route.ts`)
   - Today: Apollo only, by LinkedIn URL.
   - Change: For each contact, resolve `getCompanyAndDomainForContact(contact)`.
     - If we have (firstName + lastName) and (company or domain): call Skrapp `findEmail`; if we get an email, use it and optionally skip Apollo.
     - If we still want LinkedIn-based path (e.g. no company/domain): keep Apollo call when `linkedinUrl` is present.
   - So: **prefer Skrapp when we have company/domain; fall back to Apollo by LinkedIn when we don’t or when Skrapp fails.**

5. **Single-contact enrich**
   - Same idea: resolve company/domain; if present, try Skrapp first; else/by preference use existing Apollo flow (email or LinkedIn).

6. **Company assignment and domain**
   - When a contact gets a company assigned, ensure `companies.domain` is set (from company’s `website` if needed). Already done in companies route.
   - Optionally: when we enrich via Skrapp and get a company/domain back, update contact’s `companyDomain` and/or link to company if we have a match.

7. **Feature flag / config (optional)**
   - e.g. `ENRICHMENT_PROVIDER=skrapp` vs `apollo` so we can switch or A/B test without code deploy.

---

## 6. Files to touch (summary)

- **New:** `lib/skrapp.ts` – Skrapp client (findEmail, findBulk).
- **New:** `lib/enrichment/contactDomain.ts` (or in skrapp) – `getCompanyAndDomainForContact`, `extractDomainFromUrl`.
- **Env:** `SKRAPP_API_KEY`.
- **Modify:** `app/api/contacts/bulk-enrich/route.ts` – resolve company/domain; call Skrapp when possible; keep Apollo fallback for LinkedIn-only.
- **Modify:** Any other enrich routes that should use Skrapp (e.g. single contact enrich, enrich by email) – same pattern: resolve company/domain, prefer Skrapp when we have it.
- **Optional:** Companies create/edit UI to nudge filling `website` so `domain` is derived and available for Skrapp.

---

## 7. References

- Skrapp API: https://skrapp.io/api  
- Email Finder: GET `https://api.skrapp.io/api/v2/find` (params: firstName, lastName or fullName; company or domain).  
- Bulk: POST `https://api.skrapp.io/api/v2/find_bulk`.  
- Apollo usage today: `lib/apollo.ts` (`enrichPerson` by LinkedIn or email); no domain/company passed.

Once this is in place, we pass domain (and company) consistently and can rely on Skrapp as the main enrichment provider with Apollo as fallback where needed.
