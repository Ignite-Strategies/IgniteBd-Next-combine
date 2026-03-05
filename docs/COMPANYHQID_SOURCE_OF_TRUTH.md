# companyHQId Source of Truth

**Purpose**: Document where `companyHQId` / `companyHQ` may be written to localStorage, and how pages resolve it. Prevents "Ignite Strategies vs BusinessPoint Law" flip bugs.

## Rule: Who May Write companyHQId to localStorage

**ONLY these flows** may set `localStorage.companyHQId` / `localStorage.companyHQ`:

1. **Welcome page `handleContinue`** – User explicitly clicks Continue after selecting (or auto-selecting) a company.
2. **Context switch** – User selects a different company via Switch Company; `switchCompanyHQ()` does the write.
3. **Tenant switch** – SuperAdmin / tenant switcher; `wipeTenantData` + redirect.
4. **Company create flow** – After creating a new company; writes the new company ID.
5. **useCompanyHydration refresh** – Writes the `companyHQId` that was **passed in** to the hook (not from hydrate response).

## Never Write companyHQId from Hydrate Response

`GET /api/owner/hydrate` returns `owner.companyHQId` = first membership by role sort (OWNER > MANAGER > others). That is a **display default** only.

**Never** do:
```js
const res = await api.get('/api/owner/hydrate');
localStorage.setItem('companyHQId', res.data.owner.companyHQId);  // ❌ WRONG
```

Any code that hydrates and then writes `owner.companyHQId` would overwrite the user's explicit choice (e.g. BusinessPoint Law) with the API default (e.g. Ignite Strategies).

### Places that call hydrate and must NOT touch companyHQId

- `app/(authenticated)/settings/page.jsx` – `refreshOwner` writes `owner` / `ownerId` only ✅
- `app/(onboarding)/welcome/page.jsx` – Saves `owner`, `memberships`; only writes `companyHQId` in `handleContinue` ✅
- `app/(authenticated)/context-switch/page.jsx` – Uses `switchCompanyHQ` (explicit user action) ✅

## Universal Pattern: useCompanyHQId

Use the `useCompanyHQId` hook for any page that needs company context:

```js
import { useCompanyHQId } from '@/hooks/useCompanyHQId';

const { companyHQId, missing } = useCompanyHQId();
if (missing) return <CompanyKeyMissingError />;
```

The hook:
1. Resolves `companyHQId` from URL first, then localStorage
2. If URL is missing it but localStorage has it → `router.replace` to add the param (preserves path + other params)
3. Returns `{ companyHQId, missing }` — show error only when `missing` is true

**Apply to**: growth-dashboard, and gradually to other company-scoped pages (personas, outreach/compose, templates, etc.).
