# Outreach Modularity Audit & Decomposition Plan

**Date:** 2024  
**System:** 1-to-1 Email Outreach via SendGrid  
**Issue:** Cascading failures, unclear logs, retry storms, 401→500 chains

---

## 🔍 AUDIT PHASE

### Step 1 — Responsibility Inventory

| File | Responsibilities | Too Many? | Details |
|------|------------------|-----------|---------|
| **`app/api/outreach/send/route.js`** | ✅ auth, ✅ owner fetch/create, ✅ sender validation, ✅ request validation, ✅ email sending, ✅ activity logging, ✅ error handling | **YES** | **GOD ROUTE** - 7 responsibilities |
| **`lib/services/outreachSendService.js`** | ✅ SendGrid init, ✅ email validation, ✅ message construction, ✅ SendGrid API call, ✅ error parsing/translation | **YES** | 5 responsibilities - mixes validation, construction, and sending |
| **`app/api/outreach/verified-senders/route.js`** | ✅ auth, ✅ owner fetch, ✅ sender fetch, ✅ sender validation (PUT), ✅ DB update | **YES** | GET: 3 responsibilities, PUT: 5 responsibilities |
| **`app/api/outreach/verified-senders/validate/route.js`** | ✅ auth, ✅ email validation, ✅ SendGrid API check | **NO** | 3 responsibilities, but cohesive |
| **`app/api/outreach/verified-senders/find-or-create/route.js`** | ✅ auth, ✅ owner fetch, ✅ DB check, ✅ SendGrid API check, ✅ DB update, ✅ conditional logic | **YES** | **GOD ROUTE** - 6 responsibilities with branching |
| **`app/api/outreach/senders/verify-and-assign/route.js`** | ✅ auth, ✅ owner fetch, ✅ SendGrid API check, ✅ DB update | **YES** | 4 responsibilities |
| **`app/api/contacts/retrieve/route.js`** | ✅ auth, ✅ owner fetch, ✅ membership check, ✅ contact fetch, ✅ serialization, ✅ error handling | **YES** | **GOD ROUTE** - 6 responsibilities |
| **`lib/sendgridSendersApi.js`** | ✅ API key management, ✅ HTTP client, ✅ multiple SendGrid endpoints | **NO** | Single responsibility: SendGrid API client |
| **`components/SenderIdentityPanel.jsx`** | ✅ sender state, ✅ API calls, ✅ UI rendering, ✅ modal management | **YES** | Client-side god component |
| **`components/ContactSelector.jsx`** | ✅ contact fetching, ✅ caching, ✅ search, ✅ selection, ✅ UI rendering | **YES** | Client-side god component |
| **`app/(authenticated)/outreach/compose/page.jsx`** | ✅ form state, ✅ contact creation, ✅ email sending, ✅ error handling, ✅ UI rendering | **YES** | Client-side god component |

### Step 2 — "God Routes" Identified

#### 🔴 **CRITICAL GOD ROUTES** (3+ responsibilities + conditional branching)

1. **`/api/outreach/send`** (route.js)
   - **Responsibilities:** 7
   - **Issues:**
     - Auth + owner fetch/create + sender validation + request validation + sending + logging + error handling
     - Creates owner if missing (side effect)
     - Validates sender format inline
     - Calls service + logs activity in same route
   - **Failure Points:** Any step can fail and cascade

2. **`/api/outreach/verified-senders/find-or-create`** (route.js)
   - **Responsibilities:** 6
   - **Issues:**
     - Complex conditional branching (if owner has sender → else check SendGrid → else return list)
     - Auth + owner fetch + DB check + SendGrid API + DB update + conditional logic
     - Name suggests "create" but doesn't actually create (misleading)
   - **Failure Points:** SendGrid API failure → DB inconsistency

3. **`/api/contacts/retrieve`** (route.js)
   - **Responsibilities:** 6
   - **Issues:**
     - Auth + owner fetch + membership check + contact fetch + serialization + error handling
     - Handles both single contact AND list retrieval (two different flows)
     - Complex serialization logic with fallbacks
   - **Failure Points:** Serialization failures mask real errors

#### 🟡 **MODERATE GOD ROUTES** (3+ responsibilities, less branching)

4. **`/api/outreach/verified-senders`** (route.js)
   - GET: auth + owner fetch + sender return
   - PUT: auth + email validation + SendGrid verification + DB update + error handling

5. **`/api/outreach/senders/verify-and-assign`** (route.js)
   - Auth + owner fetch + SendGrid check + DB update

6. **`lib/services/outreachSendService.js`**
   - SendGrid init + validation + message construction + API call + error parsing

### Step 3 — Execution Flow Trace

#### User Action: Click "Send Email" on `/outreach/compose`

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENT: compose/page.jsx                                    │
│ - Validates form (to, subject, body)                        │
│ - Checks hasVerifiedSender (from SenderIdentityPanel)       │
│ - Calls: POST /api/outreach/send                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ API: /api/outreach/send/route.js                           │
│ 1. verifyFirebaseToken() → firebaseUser                    │
│ 2. prisma.owners.findUnique() → owner                      │
│    └─ IF NOT FOUND: prisma.owners.create() [SIDE EFFECT]   │
│ 3. Read owner.sendgridVerifiedEmail                         │
│ 4. Validate email format (regex)                           │
│ 5. Parse request body                                       │
│ 6. Validate to/subject/body                                │
│ 7. Call sendOutreachEmail() service                         │
│    └─ lib/services/outreachSendService.js                  │
│       ├─ Initialize SendGrid                               │
│       ├─ Validate inputs                                   │
│       ├─ Construct message                                 │
│       ├─ Call sgMail.send()                                │
│       └─ Parse response/errors                             │
│ 8. prisma.email_activities.create() [SIDE EFFECT]          │
│ 9. Return response                                         │
└─────────────────────────────────────────────────────────────┘
```

#### Pre-Send Flow: Sender Verification

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENT: SenderIdentityPanel.jsx                            │
│ - On mount: GET /api/outreach/verified-senders              │
│ - On "Change": POST /api/outreach/verified-senders/find-or-create │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ API: /api/outreach/verified-senders (GET)                  │
│ 1. verifyFirebaseToken()                                    │
│ 2. prisma.owners.findUnique()                              │
│ 3. Return sender email/name                                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ API: /api/outreach/verified-senders/find-or-create (POST)  │
│ 1. verifyFirebaseToken()                                    │
│ 2. prisma.owners.findUnique()                              │
│ 3. IF owner.sendgridVerifiedEmail exists:                  │
│    └─ listSenders() → check if still verified              │
│ 4. ELSE: listSenders() → filter verified                   │
│ 5. IF email provided:                                       │
│    └─ Find matching → prisma.owners.update()                │
│ 6. Return senders list or single sender                   │
└─────────────────────────────────────────────────────────────┘
```

#### Contact Selection Flow

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENT: ContactSelector.jsx                                │
│ - On mount: GET /api/contacts?companyHQId=X                │
│ - Uses localStorage cache                                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ API: /api/contacts/retrieve (GET)                          │
│ 1. verifyFirebaseToken()                                    │
│ 2. prisma.owners.findUnique()                              │
│ 3. resolveMembership() → check permissions                 │
│ 4. prisma.contact.findMany()                              │
│ 5. Serialize contacts (with fallbacks)                      │
│ 6. Return contacts array                                    │
└─────────────────────────────────────────────────────────────┘
```

### 🔴 **CRITICAL ISSUES IDENTIFIED**

1. **Cascading Failures:**
   - `/api/outreach/send` creates owner if missing → can fail mid-flow
   - Sender validation happens AFTER owner fetch → 401 can become 500
   - SendGrid errors are parsed inline → unclear error messages

2. **Unclear Logs:**
   - Multiple console.log statements scattered across routes
   - No structured logging or correlation IDs
   - Error messages don't indicate which step failed

3. **Retry Storms:**
   - Client retries entire `/api/outreach/send` on failure
   - No idempotency checks
   - Activity logging happens AFTER send → duplicates on retry

4. **401 → 500 Chains:**
   - Auth failures in nested calls (e.g., SendGrid API) become 500s
   - No clear separation between auth errors and business logic errors

5. **Hidden Side Effects:**
   - Owner creation in send route
   - Activity logging in send route
   - DB updates in verification routes

---

## 🧱 REFACTOR PLAN

### Step 4 — Responsibility Boundaries

#### Core Modules (Pure Functions)

1. **`verifySenderStatus(email: string) → { verified: boolean, sender: object }`**
   - **Input:** Email address
   - **Output:** Verification status + sender object
   - **Side Effects:** None (read-only)
   - **Dependencies:** `lib/sendgridSendersApi.js`

2. **`fetchOwnerByFirebaseId(firebaseId: string) → owner`**
   - **Input:** Firebase UID
   - **Output:** Owner object
   - **Side Effects:** None (read-only)
   - **Dependencies:** `prisma`

3. **`fetchContactsForCompany(companyHQId: string, filters?: object) → contacts[]`**
   - **Input:** CompanyHQ ID + optional filters
   - **Output:** Contacts array
   - **Side Effects:** None (read-only)
   - **Dependencies:** `prisma`, `resolveMembership`

4. **`sendOutreachEmail(params: EmailParams) → { messageId, statusCode }`**
   - **Input:** Email parameters (to, subject, body, from, etc.)
   - **Output:** SendGrid response
   - **Side Effects:** None (calls SendGrid API only)
   - **Dependencies:** `lib/services/outreachSendService.js` (refactored)

5. **`logEmailActivity(params: ActivityParams) → activityId`**
   - **Input:** Activity parameters
   - **Output:** Activity ID
   - **Side Effects:** Writes to DB
   - **Dependencies:** `prisma`

6. **`runOutreachFlow(params: FlowParams) → result`**
   - **Input:** Flow parameters (firebaseId, email data)
   - **Output:** Result object
   - **Side Effects:** Orchestrates other modules
   - **Dependencies:** All above modules

### Step 5 — Proposed File Structure

```
/lib/outreach/
  /core/
    verifySender.ts          # verifySenderStatus()
    fetchOwner.ts            # fetchOwnerByFirebaseId()
    fetchContacts.ts          # fetchContactsForCompany()
    sendEmail.ts              # sendOutreachEmail() (refactored)
    logActivity.ts            # logEmailActivity()
    runFlow.ts                # runOutreachFlow() (orchestration)
  
  /api/
    verify-sender/
      route.ts                # GET /api/outreach/verify-sender
    contacts/
      route.ts                # GET /api/outreach/contacts
    send/
      route.ts                # POST /api/outreach/send (thin wrapper)
    sender-status/
      route.ts                # GET /api/outreach/sender-status
```

#### File Mapping

| Current File | New Module | Notes |
|-------------|------------|-------|
| `app/api/outreach/send/route.js` | `lib/outreach/core/runFlow.ts` + `lib/outreach/api/send/route.ts` | Extract logic to core, route becomes thin wrapper |
| `lib/services/outreachSendService.js` | `lib/outreach/core/sendEmail.ts` | Refactor to pure function |
| `app/api/outreach/verified-senders/route.js` | `lib/outreach/core/verifySender.ts` + `lib/outreach/api/sender-status/route.ts` | Extract verification logic |
| `app/api/contacts/retrieve/route.js` | `lib/outreach/core/fetchContacts.ts` + `lib/outreach/api/contacts/route.ts` | Extract contact fetching |
| `app/api/outreach/verified-senders/find-or-create/route.js` | **DELETE** | Replace with simpler routes |
| `app/api/outreach/senders/verify-and-assign/route.js` | **DELETE** | Replace with simpler routes |

### Step 6 — Migration Strategy

#### Phase 1: Extract Core Modules (Week 1)
**Goal:** Create pure functions without changing routes

1. ✅ Create `lib/outreach/core/verifySender.ts`
   - Extract from `lib/sendgridSendersApi.js` + validation logic
   - Test independently

2. ✅ Create `lib/outreach/core/fetchOwner.ts`
   - Extract owner fetch logic (no create)
   - Test independently

3. ✅ Create `lib/outreach/core/fetchContacts.ts`
   - Extract contact fetching + membership check
   - Test independently

4. ✅ Refactor `lib/services/outreachSendService.js` → `lib/outreach/core/sendEmail.ts`
   - Remove validation (move to route)
   - Remove error parsing (move to route)
   - Pure SendGrid call only

5. ✅ Create `lib/outreach/core/logActivity.ts`
   - Extract activity logging
   - Test independently

#### Phase 2: Create Orchestration (Week 2)
**Goal:** Build flow orchestrator

6. ✅ Create `lib/outreach/core/runFlow.ts`
   - Orchestrates: fetchOwner → verifySender → sendEmail → logActivity
   - Handles errors explicitly
   - Returns structured result

7. ✅ Write tests for `runFlow.ts`
   - Test each failure point
   - Test idempotency
   - Test error propagation

#### Phase 3: Rewire Routes (Week 3)
**Goal:** Routes become thin wrappers

8. ✅ Refactor `app/api/outreach/send/route.js`
   - Call `runFlow()` instead of inline logic
   - Handle auth only
   - Return result

9. ✅ Create `app/api/outreach/sender-status/route.ts`
   - Call `verifySender()` + `fetchOwner()`
   - Return sender status

10. ✅ Refactor `app/api/contacts/retrieve/route.js`
    - Call `fetchContacts()`
    - Handle auth only

11. ✅ Create `app/api/outreach/verify-sender/route.ts`
    - Call `verifySender()`
    - Handle auth only

#### Phase 4: Cleanup (Week 4)
**Goal:** Remove duplicated logic

12. ✅ Delete `app/api/outreach/verified-senders/find-or-create/route.js`
13. ✅ Delete `app/api/outreach/senders/verify-and-assign/route.js`
14. ✅ Consolidate `app/api/outreach/verified-senders/route.js` → `app/api/outreach/sender-status/route.ts`
15. ✅ Update client components to use new routes
16. ✅ Remove old service files

#### Phase 5: Client Refactor (Week 5)
**Goal:** Simplify client components

17. ✅ Refactor `SenderIdentityPanel.jsx`
    - Use new `/api/outreach/sender-status` route
    - Remove inline API calls

18. ✅ Refactor `ContactSelector.jsx`
    - Use new `/api/outreach/contacts` route
    - Simplify caching logic

19. ✅ Refactor `compose/page.jsx`
    - Use new `/api/outreach/send` route
    - Remove inline validation

---

## ✅ HARD REQUIREMENTS CHECKLIST

- [x] **Do NOT merge responsibilities "for convenience"**
  - Each module has ONE responsibility
  - Orchestration is separate from execution

- [x] **Do NOT refactor UI until backend modules are clean**
  - Phase 1-3: Backend only
  - Phase 4: Route cleanup
  - Phase 5: Client refactor

- [x] **Do NOT introduce retries**
  - No retry logic in modules
  - Client handles retries if needed

- [x] **Prioritize debuggability over DRY**
  - Each module logs independently
  - Structured error messages
  - Correlation IDs (future enhancement)

- [x] **Prefer explicitness over cleverness**
  - No magic conditionals
  - Clear function signatures
  - Explicit error handling

---

## 📊 EXPECTED OUTCOMES

### Before Refactor
- **God Routes:** 6 routes doing 3+ responsibilities
- **Failure Points:** 15+ potential cascade points
- **Error Clarity:** Low (mixed error types)
- **Testability:** Low (tightly coupled)

### After Refactor
- **God Routes:** 0 (all routes are thin wrappers)
- **Failure Points:** 5 (one per module)
- **Error Clarity:** High (explicit error types per module)
- **Testability:** High (pure functions, easy to mock)

### Debuggability Improvements
- ✅ Each module logs independently
- ✅ Errors include module name + step
- ✅ No hidden side effects
- ✅ Clear separation of concerns

---

## 🚨 RISK MITIGATION

1. **Leave existing routes intact during extraction**
   - New modules are created alongside old code
   - Routes continue to work during refactor

2. **Test each module independently**
   - Unit tests for each core module
   - Integration tests for orchestration

3. **Gradual migration**
   - One route at a time
   - Feature flags if needed
   - Rollback plan for each phase

4. **No "big bang" refactor**
   - Phased approach over 5 weeks
   - Each phase is independently deployable

---

## 📝 NEXT STEPS

1. **Review this audit** with team
2. **Approve architecture** before code changes
3. **Start Phase 1** (extract core modules)
4. **Set up testing infrastructure** for modules
5. **Create correlation ID system** for logging (future)

---

**END OF AUDIT**

