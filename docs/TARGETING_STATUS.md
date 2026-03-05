# Targeting Cockpit — Current Status
_Last updated: Mar 3, 2026_

---

## What's Shipped (committed + pushed)

### Schema
| Change | Status |
|--------|--------|
| `ContactOutreachIntent` enum (`PROSPECT` \| `TARGET`) | ✅ In schema |
| `Contact.outreachIntent` field with `@default(PROSPECT)` | ✅ In schema |
| `@@index([outreachIntent])` on contacts table | ✅ In schema |
| Migration SQL created | ✅ `prisma/migrations/20260303190000_add_contact_outreach_intent/` |
| Migration applied to DB (Neon) | ✅ Executed via `prisma db execute` |
| Prisma client regenerated | ✅ `npx prisma generate` |

---

### API Routes
| Route | Method | Purpose | Status |
|-------|--------|---------|--------|
| `/api/targeting/list` | GET | Fetch all contacts with `outreachIntent=TARGET` for a company | ✅ Done |
| `/api/targeting/submit` | POST | Upsert contacts as TARGETs; ensures `prospect/need-to-engage` pipeline | ✅ Done |

Both routes are auth-guarded (Firebase token → owner → membership check).

---

### UI
| Component / Page | Status | Notes |
|-----------------|--------|-------|
| `app/(authenticated)/targeting/page.jsx` | ✅ Done | Target Cockpit page |
| `components/targeting/TargetSubmissionModal.jsx` | ✅ Done | 5-step intake modal |
| Sidebar nav item (Targeting / Crosshair icon) | ✅ Done | Under Engage group, after Outreach |
| AppShell `ROUTES_WITH_SIDEBAR` | ✅ Done | `/targeting` added so sidebar + nav render |

---

## How the Page Hydrates

`/targeting` → `AppShell` sees path starts with `/targeting` → sidebar + nav rendered ✅

The page itself (`TargetCockpitInner`) resolves `companyHQId`:
1. Checks `?companyHQId=` URL param first
2. Falls back to `localStorage.getItem('companyHQId')`

Then calls `GET /api/targeting/list?companyHQId=...` with Firebase auth token to load the queue.

The Sidebar also forwards `companyHQId` via `getHref()`, so clicking Targeting from anywhere in the app preserves the company context automatically.

---

## The Submission Flow (end-to-end)

```
User clicks "Submit Targets"
  → TargetSubmissionModal opens

Step 1: Choose method
  → CSV Upload  (file input → auto-parse → Preview)
  → Paste       (textarea → Parse button → Preview)

Step 2: Preview & Edit
  → Card per contact: Name, Company, Title, LinkedIn,
    Relationship Context (dropdown), Notes
  → Add / delete contacts
  → "Review N targets →"

Step 3: Confirm
  → Read-only summary list
  → "Save N targets"
  → POST /api/targeting/submit → upserts contacts with outreachIntent=TARGET
                               → ensureContactPipeline (prospect/need-to-engage)

Step 4: Done
  → Success card (N new, N updated)
  → onSuccess() callback → cockpit refreshes queue

Queue refreshes → contacts appear grouped by submission date
                → status badge: "Queued" (amber) or "Enriched" (blue)
```

---

## What `TARGET` Actually Does to a Contact

When saved via the submit API, each contact gets:
- `outreachIntent = 'TARGET'` (flag for the queue)
- `howMet` = relationship context dropdown value (e.g. "Warm intro")
- `notes` = personal notes
- `pipelineSnap = 'prospect'`, `pipelineStageSnap = 'need-to-engage'`
- A `pipelines` row: `prospect / need-to-engage`

When the **first email is sent** (via `/api/outreach/send` or `/api/contacts/[id]/off-platform-send`):
- Pipeline auto-advances to `prospect / engaged-awaiting-response` (existing logic, unchanged)
- `outreachIntent` stays `TARGET` until we build "clear on send" (next phase)

---

## What's NOT Built Yet

| Feature | Notes |
|---------|-------|
| Clear `outreachIntent` on first send | Contacts stay TARGET even after emailing. Low priority — cockpit still shows them, just with different status badge in future |
| "Send initial email" action from cockpit | Will wire up existing outreach send from the Targeting queue row |
| Template generation from TARGET | The queue feeds template gen; not built yet |
| Enrich targets from cockpit | "Hydrate all targets" button — can call existing enrich API |
| Filter queue by "not yet sent" | Trivial once we add `targetedAt` or clear on send |
| `outreachIntent` in CSV upload | Existing `/contacts/upload` page doesn't set TARGET; could add a "Mark as target" toggle |

---

## Files Changed in This Commit (`cdcf1cb`)

```
app/(authenticated)/targeting/page.jsx         ← Target Cockpit page
app/api/targeting/list/route.js                ← GET targets
app/api/targeting/submit/route.js              ← POST save targets
components/targeting/TargetSubmissionModal.jsx ← 5-step modal
components/AppShell.jsx                        ← added /targeting to ROUTES_WITH_SIDEBAR
components/Sidebar.jsx                         ← added Targeting nav item
prisma/schema.prisma                           ← ContactOutreachIntent enum + field + index
prisma/migrations/20260303190000_.../          ← migration SQL (applied to DB)
docs/TARGETING_UX_PROPOSAL.md                 ← design rationale
docs/TARGETING_CONTACT_CHANGES.md             ← freeze-frame of schema changes
```

---

## Navigation Path

Sidebar → **Engage** group → **Targeting** (Crosshair icon) → `/targeting?companyHQId=...`

The `companyHQId` is appended automatically by `Sidebar.getHref()` using the same pattern as every other nav item.
