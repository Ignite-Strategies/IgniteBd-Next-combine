# Outreach Execution Flow Diagrams

## Current Flow (Monolithic)

### Send Email Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ CLIENT: compose/page.jsx                                        │
│                                                                 │
│ 1. User fills form (to, subject, body)                        │
│ 2. Checks hasVerifiedSender (from SenderIdentityPanel)         │
│ 3. Validates form fields                                       │
│ 4. POST /api/outreach/send                                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ API: /api/outreach/send/route.js                               │
│                                                                 │
│ STEP 1: Auth                                                   │
│   verifyFirebaseToken() → firebaseUser                         │
│   ❌ FAILURE: Returns 401                                      │
│                                                                 │
│ STEP 2: Owner Fetch                                            │
│   prisma.owners.findUnique({ firebaseId })                     │
│   ❌ IF NOT FOUND: prisma.owners.create() [SIDE EFFECT]        │
│   ❌ FAILURE: Returns 500 (should be 404)                      │
│                                                                 │
│ STEP 3: Sender Validation                                     │
│   Read owner.sendgridVerifiedEmail                             │
│   ❌ IF NULL: Returns 400                                      │
│   Validate email format (regex)                                │
│   ❌ IF INVALID: Returns 400                                    │
│                                                                 │
│ STEP 4: Request Validation                                     │
│   Parse request body                                           │
│   Validate to/subject/body                                     │
│   ❌ IF INVALID: Returns 400                                    │
│                                                                 │
│ STEP 5: Send Email                                             │
│   sendOutreachEmail({ ... })                                   │
│   └─ lib/services/outreachSendService.js                       │
│      ├─ Initialize SendGrid                                    │
│      ├─ Validate inputs (DUPLICATE)                           │
│      ├─ Construct message                                     │
│      ├─ Call sgMail.send()                                    │
│      │  ❌ FAILURE: SendGrid API error                         │
│      │     - 401 → Returns 500 (should be 401)                │
│      │     - 403 → Returns 500 (should be 403)                │
│      │     - Unverified sender → Returns 500                   │
│      └─ Parse response/errors                                 │
│   ❌ FAILURE: Returns 500 (unclear error)                     │
│                                                                 │
│ STEP 6: Log Activity                                          │
│   prisma.email_activities.create() [SIDE EFFECT]               │
│   ❌ FAILURE: Returns 500 (but email already sent!)            │
│                                                                 │
│ STEP 7: Return Response                                       │
│   Return { success, messageId, emailActivityId }               │
└─────────────────────────────────────────────────────────────────┘
```

### Sender Verification Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ CLIENT: SenderIdentityPanel.jsx                                │
│                                                                 │
│ On Mount:                                                      │
│   GET /api/outreach/verified-senders                           │
│                                                                 │
│ On "Change" Click:                                             │
│   POST /api/outreach/verified-senders/find-or-create          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ API: /api/outreach/verified-senders (GET)                      │
│                                                                 │
│ STEP 1: Auth                                                   │
│   verifyFirebaseToken()                                        │
│                                                                 │
│ STEP 2: Owner Fetch                                            │
│   prisma.owners.findUnique()                                   │
│                                                                 │
│ STEP 3: Return Sender                                         │
│   Return owner.sendgridVerifiedEmail                           │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ API: /api/outreach/verified-senders/find-or-create (POST)     │
│                                                                 │
│ STEP 1: Auth                                                   │
│   verifyFirebaseToken()                                        │
│                                                                 │
│ STEP 2: Owner Fetch                                            │
│   prisma.owners.findUnique()                                   │
│                                                                 │
│ STEP 3: Check Owner's Sender                                   │
│   IF owner.sendgridVerifiedEmail exists:                       │
│     listSenders() → Check if still verified                    │
│     ❌ FAILURE: SendGrid API error → Returns 500               │
│                                                                 │
│ STEP 4: Check SendGrid                                         │
│   ELSE:                                                         │
│     listSenders() → Filter verified                            │
│     ❌ FAILURE: SendGrid API error → Returns 500               │
│                                                                 │
│ STEP 5: Update Owner (if email provided)                       │
│   IF email provided:                                           │
│     Find matching sender                                       │
│     prisma.owners.update() [SIDE EFFECT]                      │
│     ❌ FAILURE: DB error → Returns 500                         │
│                                                                 │
│ STEP 6: Return Result                                         │
│   Return senders list or single sender                         │
└─────────────────────────────────────────────────────────────────┘
```

## Proposed Flow (Modular)

### Send Email Flow (After Refactor)

```
┌─────────────────────────────────────────────────────────────────┐
│ CLIENT: compose/page.jsx                                        │
│                                                                 │
│ 1. User fills form                                             │
│ 2. Validates form fields                                       │
│ 3. POST /api/outreach/send                                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ API: /api/outreach/send/route.ts (THIN WRAPPER)                │
│                                                                 │
│ STEP 1: Auth Only                                              │
│   verifyFirebaseToken() → firebaseUser                         │
│   ❌ FAILURE: Returns 401 (clear)                              │
│                                                                 │
│ STEP 2: Orchestrate Flow                                       │
│   runOutreachFlow({                                            │
│     firebaseId: firebaseUser.uid,                              │
│     emailData: { to, subject, body, ... }                      │
│   })                                                           │
│                                                                 │
│ STEP 3: Return Result                                          │
│   Return result (success/error)                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ CORE: lib/outreach/core/runFlow.ts (ORCHESTRATION)             │
│                                                                 │
│ STEP 1: Fetch Owner                                            │
│   owner = fetchOwnerByFirebaseId(firebaseId)                   │
│   ❌ FAILURE: throw OwnerNotFoundError                         │
│                                                                 │
│ STEP 2: Verify Sender                                          │
│   senderStatus = verifySenderStatus(owner.sendgridVerifiedEmail)│
│   ❌ IF NOT VERIFIED: throw SenderNotVerifiedError              │
│                                                                 │
│ STEP 3: Send Email                                             │
│   result = sendOutreachEmail({                                 │
│     to, subject, body,                                         │
│     from: senderStatus.sender.email                            │
│   })                                                           │
│   ❌ FAILURE: throw SendGridError (with clear message)         │
│                                                                 │
│ STEP 4: Log Activity                                          │
│   activityId = logEmailActivity({                              │
│     ownerId, contactId, messageId, ...                         │
│   })                                                           │
│   ❌ FAILURE: Log warning, but don't fail (email sent)         │
│                                                                 │
│ STEP 5: Return Result                                         │
│   Return {                                                    │
│     success: true,                                             │
│     messageId,                                                │
│     activityId                                                │
│   }                                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Sender Verification Flow (After Refactor)

```
┌─────────────────────────────────────────────────────────────────┐
│ CLIENT: SenderIdentityPanel.jsx                                │
│                                                                 │
│ On Mount:                                                      │
│   GET /api/outreach/sender-status                              │
│                                                                 │
│ On "Change" Click:                                             │
│   GET /api/outreach/verify-sender?email=X                      │
│   PUT /api/outreach/sender-status (if verified)                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ API: /api/outreach/sender-status/route.ts (THIN WRAPPER)      │
│                                                                 │
│ STEP 1: Auth                                                   │
│   verifyFirebaseToken()                                        │
│                                                                 │
│ STEP 2: Fetch Owner                                            │
│   owner = fetchOwnerByFirebaseId(firebaseId)                   │
│                                                                 │
│ STEP 3: Return Status                                          │
│   Return {                                                     │
│     verifiedEmail: owner.sendgridVerifiedEmail,                │
│     verifiedName: owner.sendgridVerifiedName                    │
│   }                                                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ API: /api/outreach/verify-sender/route.ts (THIN WRAPPER)       │
│                                                                 │
│ STEP 1: Auth                                                   │
│   verifyFirebaseToken()                                        │
│                                                                 │
│ STEP 2: Verify Sender                                          │
│   result = verifySenderStatus(email)                           │
│   ❌ FAILURE: Returns 400 with clear message                   │
│                                                                 │
│ STEP 3: Return Result                                          │
│   Return { verified: true/false, sender: {...} }               │
└─────────────────────────────────────────────────────────────────┘
```

## Error Flow Comparison

### Current Error Flow (Cascading)

```
SendGrid API Error (401)
  ↓
outreachSendService.js catches error
  ↓
Parses error → throws generic Error
  ↓
route.js catches error
  ↓
handleServerError() → Returns 500
  ↓
Client receives 500 (unclear)
```

### Proposed Error Flow (Explicit)

```
SendGrid API Error (401)
  ↓
sendEmail.ts catches error
  ↓
Throws SendGridAuthError (401)
  ↓
runFlow.ts catches error
  ↓
Propagates SendGridAuthError
  ↓
route.ts catches error
  ↓
Returns 401 with clear message
  ↓
Client receives 401 (clear)
```

## Module Dependency Graph

### Current (Tightly Coupled)

```
route.js
  ├─ verifyFirebaseToken()
  ├─ prisma.owners.findUnique()
  ├─ prisma.owners.create() [SIDE EFFECT]
  ├─ sendOutreachEmail()
  │   └─ sgMail.send()
  └─ prisma.email_activities.create() [SIDE EFFECT]
```

### Proposed (Loosely Coupled)

```
route.ts
  └─ runFlow.ts
      ├─ fetchOwner.ts
      │   └─ prisma
      ├─ verifySender.ts
      │   └─ sendgridSendersApi.ts
      ├─ sendEmail.ts
      │   └─ sgMail.send()
      └─ logActivity.ts
          └─ prisma
```

## Failure Point Analysis

### Current System

| Step | Failure Point | Error Code | Clarity |
|------|--------------|------------|---------|
| Auth | Firebase token invalid | 401 | ✅ Clear |
| Owner fetch | Owner not found | 500 | ❌ Should be 404 |
| Owner create | DB error | 500 | ✅ Clear |
| Sender validation | No sender | 400 | ✅ Clear |
| Email format | Invalid format | 400 | ✅ Clear |
| Request validation | Missing fields | 400 | ✅ Clear |
| SendGrid init | API key missing | 500 | ✅ Clear |
| SendGrid send | Auth error | 500 | ❌ Should be 401 |
| SendGrid send | Unverified sender | 500 | ❌ Should be 400 |
| Activity log | DB error | 500 | ❌ Email sent but failed |

### Proposed System

| Step | Failure Point | Error Code | Clarity |
|------|--------------|------------|---------|
| Auth | Firebase token invalid | 401 | ✅ Clear |
| Owner fetch | Owner not found | 404 | ✅ Clear |
| Sender verification | Not verified | 400 | ✅ Clear |
| Send email | SendGrid auth error | 401 | ✅ Clear |
| Send email | Unverified sender | 400 | ✅ Clear |
| Activity log | DB error | Warning | ✅ Logged, not failed |

---

**END OF FLOW DIAGRAMS**

