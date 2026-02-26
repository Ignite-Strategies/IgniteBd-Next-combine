# Freeze-frame: nextEngagementPurpose — string vs enum, how we write it

## Current state

- **Schema:** `nextEngagementPurpose` is **String?** (optional string). No enum in the DB.
- **Comment in schema:** `// unresponsive | periodic_check_in | referral_no_contact | manual` — intended values, but not enforced.

---

## How we write it today

| Source | Value written |
|--------|----------------|
| **Remind-me** (PUT /api/contacts/[id]/remind-me) | `'manual'` |
| **Cadence** (computeAndPersistNextEngagement) | If no next date → `null`. If next date: `result.isManualOverride ? 'manual'` else if `result.nextContactNote` then we use `result.nextContactNote` (free text), else `'unresponsive'`. So: `'manual'` \| `'unresponsive'` \| **nextContactNote** (free text, e.g. "Follow next quarter") |
| **PATCH next-engagement** (contact detail edit) | Whatever string (or null) the client sends. No validation. |

So we **mix**:
- **Enum-like:** `manual`, `unresponsive`
- **Free text:** from `nextContactNote` (and from PATCH), e.g. "Follow next quarter", "Do not call - March"

---

## Does the logic fit?

- **String** fits because we need both:
  - A small set of known “reasons” (manual, unresponsive; and from docs: periodic_check_in, referral_no_contact).
  - Optional **free-form note** (e.g. "Follow next quarter") that we already have in `nextContactNote` and sometimes persist into `nextEngagementPurpose` when we don’t set a fixed reason.
- If we switched to an **enum** only, we’d lose the ability to store that free text in the same column. We’d need either:
  - Keep a separate **nextContactNote** (or new `nextEngagementNote`) for free text and use enum only for “reason”, or
  - Keep **string** and treat a few values as canonical (manual, unresponsive, periodic_check_in, referral_no_contact) and allow any other string for notes.

---

## Recommendation (freeze-frame)

- **Keep it as String?** for now so logic and code continue to fit: we can store both canonical reasons and a short note.
- **Canonical values** (for display/filtering, not DB constraint): `manual`, `unresponsive`, `periodic_check_in`, `referral_no_contact`. Anything else can be treated as free text (e.g. from nextContactNote or user edit).
- **Writing:**  
  - Remind-me → `'manual'`.  
  - Cadence → `'manual'` \| `'unresponsive'` \| or copy of `nextContactNote` when present.  
  - PATCH → accept any string or null; no enum validation.  
- If later we want strict enum only, we’d add a Prisma enum and a separate `nextEngagementNote` (or keep using `nextContactNote`) for free text and stop storing that in `nextEngagementPurpose`.
