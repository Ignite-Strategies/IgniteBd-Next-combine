# Unified Email Model Proposal

**Purpose:** Create a comprehensive email tracking model that consolidates platform sends, off-platform sends, and response tracking into a single, unified structure.

---

## Current State

We currently have:
1. **`email_activities`** - Platform sends (via SendGrid)
   - Has: subject, body, contact_id, event, messageId
   - Missing: response tracking

2. **`off_platform_email_sends`** - Off-platform sends (manual entry)
   - Has: subject, platform, emailSent date
   - Missing: body, response tracking

3. **No unified response tracking** - Can't easily see "did this contact respond?"

---

## Proposed Solution: Unified `emails` Model

Create a new comprehensive email model that tracks **all** emails (platform + off-platform) with full response tracking:

```prisma
model emails {
  id                    String   @id @default(cuid())
  contactId             String   // FK to Contact
  sendDate              DateTime // When email was sent
  subject               String?
  body                  String?  @db.Text // Full email body
  source                EmailSource // PLATFORM | OFF_PLATFORM
  platform              String?  // "sendgrid", "gmail", "outlook", "apollo", "manual"
  
  // Response tracking
  contactResponse       String?  @db.Text // The actual reply text from contact
  respondedAt           DateTime? // When contact responded
  responseSubject       String?  // Subject of their reply
  hasResponded          Boolean  @default(false)
  
  // References to original records (if applicable)
  emailActivityId       String?  @unique // If from email_activities
  offPlatformSendId     String?  @unique // If from off_platform_email_sends
  
  // Metadata
  messageId             String?  @unique // SendGrid message ID (if platform)
  campaignId            String?
  sequenceId            String?
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  contacts              Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)
  email_activities      email_activities? @relation(fields: [emailActivityId], references: [id])
  off_platform_email_sends? off_platform_email_sends @relation(fields: [offPlatformSendId], references: [id])
  campaigns             campaigns? @relation(fields: [campaignId], references: [id])

  @@index([contactId])
  @@index([contactId, sendDate])
  @@index([sendDate])
  @@index([hasResponded])
  @@index([source])
  @@map("emails")
}

enum EmailSource {
  PLATFORM
  OFF_PLATFORM
}
```

---

## Design Decisions

### Option A: New Unified Model (Recommended)
- ✅ **Pros:** Clean, comprehensive, single source of truth
- ✅ Can reference existing `email_activities` and `off_platform_email_sends` for migration
- ✅ Easy to query: "all emails to this contact" or "all emails with responses"
- ❌ **Cons:** Need to migrate existing data, maintain sync

### Option B: Enhance Existing Tables
- Add `contactResponse` and `respondedAt` to both `email_activities` and `off_platform_email_sends`
- ❌ **Cons:** Still fragmented, harder to query across both

### Option C: Hybrid Approach
- Keep existing tables for operational data
- Create `emails` as a "view" or sync table that consolidates both
- ✅ **Pros:** No breaking changes, can query unified model
- ❌ **Cons:** More complexity, need sync logic

---

## Recommended: Option A with Migration Path

1. **Create new `emails` model**
2. **Migrate existing data:**
   - Copy all `email_activities` → `emails` (source: PLATFORM)
   - Copy all `off_platform_email_sends` → `emails` (source: OFF_PLATFORM)
   - Link via `emailActivityId` and `offPlatformSendId`
3. **Update code to write to `emails` going forward**
4. **Eventually deprecate old tables** (or keep for historical reference)

---

## API Endpoints

### Create Email Record
```
POST /api/emails
Body: {
  contactId: string
  sendDate: string (ISO)
  subject?: string
  body?: string
  source: "PLATFORM" | "OFF_PLATFORM"
  platform?: string
  emailActivityId?: string (if from platform)
  offPlatformSendId?: string (if from off-platform)
}
```

### Record Response
```
PUT /api/emails/[emailId]/response
Body: {
  contactResponse: string (the reply text)
  respondedAt: string (ISO)
  responseSubject?: string
}
```

### Get Contact's Emails
```
GET /api/contacts/[contactId]/emails
Query: ?includeResponses=true
Returns: {
  emails: [
    {
      id, sendDate, subject, body, source,
      hasResponded, contactResponse, respondedAt,
      ...
    }
  ]
}
```

### Get Emails with Responses
```
GET /api/emails/with-responses?companyHQId=xxx
Returns: All emails where hasResponded = true
```

---

## Migration Strategy

### Phase 1: Create Model + Migrate Data
1. Add `emails` table
2. Migrate existing `email_activities` → `emails`
3. Migrate existing `off_platform_email_sends` → `emails`
4. Set `hasResponded = false` for all (we don't have response data yet)

### Phase 2: Update Code
1. Update `/api/outreach/send` to create `emails` record
2. Update `/api/contacts/[contactId]/off-platform-send` to create `emails` record
3. Create response tracking endpoint

### Phase 3: Response Tracking
1. Add inbound email parsing (SendGrid webhook)
2. Match replies to `emails` records
3. Update `hasResponded`, `contactResponse`, `respondedAt`

### Phase 4: Deprecate Old Tables (Optional)
- Keep `email_activities` and `off_platform_email_sends` for historical reference
- Or migrate fully and remove

---

## Benefits

1. **Unified Querying:** One table to query all emails
2. **Response Tracking:** Built-in response fields
3. **Complete History:** Subject + body for all emails
4. **Easy Analytics:** "Show me all contacts who responded" or "Show email thread"
5. **Future-Proof:** Can add threading, attachments, etc.

---

## Questions

1. **Should we keep old tables?** (Recommend: Yes, for historical reference)
2. **How to handle SendGrid webhooks?** Update both `email_activities` AND `emails`?
3. **Should `body` be required?** (Recommend: Optional, some sends might not have body)
4. **Threading?** Add `inReplyTo` field for email threads?

---

**Status:** 🟡 Proposal - Ready for Review
