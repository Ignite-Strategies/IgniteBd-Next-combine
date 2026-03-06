# Email Parse Modal Refactor — Wiring Map & Plan

**Date:** 2026-03-06  
**Goal:** Make off-platform email parse a modal (not page-dependent), inline on contact pages, with AI summary + contact-create-from-parse.

---

## 1. Current Wiring — How Everything Connects

### Two Separate Flows (The Problem)

| Flow | Entry | Source | Parse | Record | AI Summary | Contact Create |
|------|-------|--------|-------|--------|------------|----------------|
| **Inbound Parse** | `/inbound-parse` page | InboundEmail (SendGrid webhook) | AI (takeCrmClientEmailAndParseAiService) | push-to-ai | ✅ Yes | ✅ Yes |
| **Record Off-Platform** | `/outreach/record-off-platform` (or contact "Add Email Manually") | User paste/CSV | Regex heuristic (emailConversationParser) | off-platform-send/conversation | ❌ No | ✅ Yes |

**Key insight:** The AI parse + summary + contact-create flow only works with InboundEmail. Record-off-platform uses a dumb parser and never gets AI summary.

---

## 2. What's Already Built (No Gaps)

### AI Summary — Fully Wired

1. **Parse:** `takeCrmClientEmailAndParseAiService` returns `summary` (1–2 sentence)
2. **Store:** `push-to-ai` writes `summary` to `email_activities.summary`
3. **Consume:** `computeAndPersistNextEngagement` reads latest `email_activities.summary` and uses `inferDateFromSummary()` to set `nextEngagementDate`

### Contact Create From Parse — Already Implemented

In `app/api/inbound-parse/push-to-ai/route.ts` (lines 94–118):

```ts
// ── 2. Contact find-or-create (never orphan an activity) ──
let contactId: string | null = null;
if (effectiveContactEmail && companyHQId) {
  const existing = await prisma.contact.findFirst({...});
  if (existing) {
    contactId = existing.id;
  } else {
    const newContact = await prisma.contact.create({
      data: { crmId: companyHQId, email: normalizedEmail, firstName, lastName, ... },
    });
    contactId = newContact.id;
  }
}
```

When no contact matches, it creates one. No extra work needed.

---

## 3. The Gap: APIs Require InboundEmail

Both parse and push-to-ai are tied to InboundEmail:

| API | Input | Limitation |
|-----|-------|------------|
| `POST /api/inbound-parse/parse` | `inboundEmailId` | Must have InboundEmail from SendGrid |
| `POST /api/inbound-parse/push-to-ai` | `inboundEmailId` | Same |

To support paste-from-contact-page, we need **raw-email** variants that accept `{ text?, html?, raw? }` + `companyHQId`.

---

## 4. Refactor Plan

### Phase 1: Raw-Email APIs (Backend)

Add two endpoints that accept raw content instead of inboundEmailId.

#### 4.1 `POST /api/inbound-parse/parse-raw`

**Body:**
```json
{
  "text": "...",        // optional
  "html": "...",        // optional
  "raw": "...",         // optional (MIME or combined)
  "companyHQId": "...", // required
  "contactId": "..."    // optional — when on contact page, pre-bias contact lookup
}
```

**Logic:** Same as existing parse route, but:
- Build parse input from body (`text`, `html`, `raw`) instead of InboundEmail
- Use `companyHQId` for contact lookup
- If `contactId` provided, can optionally pre-fill / bias (or just use for owner context)

**Returns:** Same shape as current parse (`parsed`, `contact`, `emailHistory`, `nextEngage`, `alreadyIngested`)

#### 4.2 `POST /api/inbound-parse/record-from-raw`

**Body:**
```json
{
  "text": "...",
  "html": "...",
  "raw": "...",
  "companyHQId": "...",
  "contactEmail": "...",      // override
  "contactName": "...",       // override
  "nextEngagementDate": "..." // override
}
```

**Logic:** Same as push-to-ai, but:
- Build parse input from body
- No InboundEmail; no step 7 (mark ingested)
- Everything else identical: AI parse → find-or-create contact → log activity with summary → stamp engagement → set nextEngagementDate → pipeline shift

**Returns:** Same as push-to-ai (`contactId`, `parsed`, `emailActivityId`)

### Phase 2: Reusable Modal Component

#### `components/email/ParseEmailModal.jsx`

**Props:**
- `open: boolean`
- `onClose: () => void`
- `companyHQId: string` (required)
- `contactId?: string` (optional — when opened from contact page)
- `onRecorded?: (contactId: string) => void` (optional — e.g. refresh contact page)

**UI:**
- Paste area (textarea for raw email)
- Parse & Preview (calls parse-raw, shows 4 steps)
- Record Activity (calls record-from-raw)
- Calculate Engagement (calls compute-engagement)
- Same step layout as inbound-parse page, in a modal

**Behavior:**
- When `contactId` provided: contact is pre-selected; can still override if AI finds different contact
- When no `contactId`: full find-or-create flow; "Create contact" is already handled by API

### Phase 3: Integrate on Contact Page

On contact page Email History section:
- Add second button: **"Parse & Record Email"** (or **"Paste Email to Parse"**)
- Opens `ParseEmailModal` with `contactId` + `companyHQId`
- On success: `onRecorded` → refresh email history

Keep "Add Email Manually" for the record-off-platform flow (manual/CSV entry without AI parse).

### Phase 4 (Optional): Inbound Parse Page

- Option A: Refactor `/inbound-parse` to use `ParseEmailModal` for a "Paste email" mode (alongside InboundEmail list)
- Option B: Keep page as-is; modal is primarily for contact-scoped paste

---

## 5. File Summary

| File | Change |
|------|--------|
| `app/api/inbound-parse/parse-raw/route.ts` | **New** — parse from raw body |
| `app/api/inbound-parse/record-from-raw/route.ts` | **New** — record from raw body (no InboundEmail) |
| `components/email/ParseEmailModal.jsx` | **New** — reusable modal |
| `app/(authenticated)/contacts/[contactId]/page.jsx` | Add "Parse & Record Email" button, render `ParseEmailModal` |
| `app/(authenticated)/inbound-parse/page.jsx` | Optional: add paste mode using modal |

---

## 6. Data Flow (After Refactor)

```
Contact Page → "Parse & Record Email"
    → ParseEmailModal opens
    → User pastes email
    → Parse & Preview → POST /api/inbound-parse/parse-raw
        → takeCrmClientEmailAndParseAiService (AI + summary)
        → Contact lookup (or "no match, will create")
        → 4-step preview
    → Record Activity → POST /api/inbound-parse/record-from-raw
        → AI parse again (or could cache from parse-raw)
        → Find or create contact
        → Create email_activities (with summary)
        → stampLastEngagement
        → Set nextEngagementDate if parsed
        → Pipeline shift
    → Calculate Engagement (optional) → POST /api/contacts/[id]/compute-engagement
        → Reads summary, infers date via inferDateFromSummary
```

---

## 7. AI Summary Usage (Reference)

| Stage | Where | What |
|-------|-------|------|
| Extract | `takeCrmClientEmailAndParseAiService` | Returns `summary` in ParsedEmailData |
| Store | `push-to-ai` / `record-from-raw` | `email_activities.summary = parsed.summary` |
| Use | `computeAndPersistNextEngagement` | Reads latest activity summary → `inferDateFromSummary` → sets `nextEngagementDate` |

No additional wiring needed for AI summary; it flows through once we use the same parse/record path.
