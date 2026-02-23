# Off-Platform Email Send Tracking

**Purpose:** Track email sends that happen outside the Ignite platform (e.g., manual sends via Gmail, Outlook, Apollo, etc.) so we can calculate follow-up dates, trigger reminders, and eventually build an AI agent to automate outreach cadence.

---

## Problem Statement

Currently, the platform tracks emails sent **through** Ignite via the `email_activities` table. However, users often send emails **off-platform** (manually via Gmail, Outlook, Apollo, or other tools) and we have no way to:

1. Track when these off-platform sends happened
2. Calculate when the next follow-up should be sent
3. Remind users to follow up with contacts
4. Build an AI agent that can intelligently suggest or automate follow-ups

---

## Current State

### What Exists

- **`email_activities` table**: Tracks emails sent **through** the platform
  - `contact_id` (String?)
  - `createdAt` (DateTime) - when email was sent
  - `event` (String?) - 'sent', 'delivered', 'opened', 'clicked', etc.
  - No relation from Contact → email_activities (can query but not easily accessible)

- **`Contact` model**: Has manual tracking fields
  - `lastContact` (String?) - manual note like "Aug 2025", "Last week"
  - `persona_type` (PersonaType?)
  - `prior_relationship` (RelationshipEnum?)
  - `remindMeOn` (DateTime?) - manual reminder date (e.g., "remind me April 1")

### Gaps

- **No structured tracking** for off-platform sends
- **No date-based follow-up calculation** - relies on manual `lastContact` string
- **No manual reminder system** - can't set "remind me on April 1" dates
- **No reminder service** - no cron/job to surface contacts due for follow-up
- **No AI agent** - no intelligent automation for outreach cadence

---

## Proposed Solution

### 0. Manual Reminder Field: `remindMeOn`

Add a manual reminder date field directly to Contact model for ad-hoc reminders:

```prisma
model Contact {
  // ... existing fields ...
  remindMeOn DateTime? // Manual reminder: "remind me to contact on April 1"
  // ... rest of model ...
}
```

**Use Case:** User says "remind me to contact this person on April 1" - sets a specific date regardless of cadence rules.

**API:** 
- `PUT /api/contacts/[contactId]/remind-me` - Set/update reminder date
- `GET /api/contacts/[contactId]/remind-me` - Get reminder status

---

### 1. New Model: `off_platform_email_sends`

Add a new table to track off-platform email sends:

```prisma
model off_platform_email_sends {
  id                String   @id @default(cuid())
  contactId         String
  emailSent         DateTime // When the email was actually sent (off-platform)
  subject           String?  // Optional: what was the subject?
  platform          String?  // Optional: "gmail", "outlook", "apollo", "manual", etc.
  notes             String?  // Optional: any notes about the send
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  contacts          Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)

  @@index([contactId])
  @@index([contactId, emailSent])
  @@index([emailSent])
  @@map("off_platform_email_sends")
}
```

**Alternative Approach:** Add field directly to Contact model:
- `lastOffPlatformEmailSent` (DateTime?) - date of last off-platform send
- `offPlatformEmailCount` (Int?) - count of off-platform sends

**Recommendation:** Use separate table (`off_platform_email_sends`) because:
- ✅ Can track **multiple** off-platform sends per contact (history)
- ✅ Can store metadata (subject, platform, notes)
- ✅ More flexible for future features (analytics, patterns)
- ✅ Consistent with `email_activities` pattern

---

### 2. Add Relation to Contact Model

Update `Contact` model to include relation:

```prisma
model Contact {
  // ... existing fields ...
  
  off_platform_email_sends off_platform_email_sends[]
  
  // ... rest of model ...
}
```

---

### 3. Service: Calculate Next Send Date

Create a service to calculate when the next follow-up should be sent based on:
- Last send date (from `email_activities` OR `off_platform_email_sends`)
- Contact's `prior_relationship` (COLD, WARM, ESTABLISHED, DORMANT)
- Custom follow-up cadence rules

**Service:** `lib/services/followUpCalculator.ts`

```typescript
interface FollowUpConfig {
  coldFollowUpDays: number;      // e.g., 7 days
  warmFollowUpDays: number;      // e.g., 3 days
  establishedFollowUpDays: number; // e.g., 14 days
  dormantFollowUpDays: number;   // e.g., 30 days
}

async function calculateNextSendDate(
  contactId: string,
  config?: FollowUpConfig
): Promise<Date | null> {
  // 1. Get last send date (from email_activities OR off_platform_email_sends)
  // 2. Get contact's prior_relationship
  // 3. Apply cadence rules
  // 4. Return next send date
}
```

**Logic:**
- Find most recent send: `MAX(email_activities.createdAt, off_platform_email_sends.emailSent)`
- Apply cadence based on `prior_relationship`:
  - COLD → 7 days
  - WARM → 3 days
  - ESTABLISHED → 14 days
  - DORMANT → 30 days
- Return `lastSendDate + cadenceDays`

---

### 4. Reminder Service

Create a service that finds contacts due for follow-up. Includes both:
- **Automatic reminders**: Based on cadence rules (last send + relationship type)
- **Manual reminders**: Based on `remindMeOn` field (user-set specific dates)

**Service:** `lib/services/reminderService.js`

```javascript
async function getContactsDueForFollowUp(
  companyHQId: string,
  options?: {
    daysOverdue?: number; // Optional: only contacts X days overdue
    includeManualReminders?: boolean; // Include manual reminders (default: true)
  }
): Promise<Contact[]> {
  // 1. Get all contacts for company (including remindMeOn)
  // 2. For each contact:
  //    - Check manual reminder first (remindMeOn <= today)
  //    - Otherwise check automatic cadence-based follow-up
  // 3. Filter where due (nextSendDate <= today OR remindMeOn <= today)
  // 4. Optionally filter by daysOverdue
  // 5. Return list with reminderType ('manual' | 'automatic')
}
```

**Priority:** Manual reminders (`remindMeOn`) take precedence over automatic cadence calculations.

**API Endpoint:** `GET /api/contacts/due-for-followup?companyHQId=xxx&daysOverdue=0`

**UI:** New page or section: "Follow-ups Due" showing:
- Contact name
- Last send date
- Days overdue
- Suggested template (from persona matching)
- Quick action: "Send Follow-up"

---

### 5. Cron Job / Scheduled Task

Set up a cron job to:
1. Run daily (or configurable frequency)
2. Find contacts due for follow-up
3. Send reminder digest to user (email or in-app notification)

**Implementation:**
- Use Vercel Cron (if on Vercel) or similar
- Or use a background job queue (BullMQ, etc.)

**Cron:** `app/api/cron/daily-followup-reminders/route.ts`

```typescript
export async function GET(request: Request) {
  // Verify cron secret
  // For each company:
  //   - Get contacts due for follow-up
  //   - Send digest email or create in-app notification
}
```

---

### 6. AI Agent for Outreach Reminders

**Big Picture Vision:** An AI agent that:
- Monitors all contacts (on-platform + off-platform sends)
- Calculates optimal follow-up timing
- Suggests personalized follow-up content
- Can optionally auto-draft or auto-send (with approval)

**Phase 1: Suggest & Remind**
- Agent identifies contacts due for follow-up
- Suggests template/snippet based on persona + relationship
- Drafts one-line follow-up using LLM
- User reviews and sends manually

**Phase 2: Auto-Draft**
- Agent drafts full follow-up email
- User reviews, edits, approves
- User clicks "Send" (still manual send)

**Phase 3: Auto-Send (with guardrails)**
- Agent sends follow-ups automatically
- Only for certain relationship types (e.g., ESTABLISHED only)
- User can set rules: "auto-send if no reply after X days"
- Always includes opt-out mechanism

**Implementation:**
- Use existing LLM integration (OpenAI, Anthropic, etc.)
- Create agent service: `lib/services/outreachAgent.ts`
- Store agent decisions/actions in new table: `agent_outreach_actions`

---

## Implementation Plan

### Phase 1: Data Model & Basic Tracking (Week 1)
1. ✅ Add `remindMeOn` field to Contact model (migration)
2. ✅ Create `off_platform_email_sends` table (migration)
3. ✅ Add relation to Contact model
4. ✅ Create API endpoint: `PUT /api/contacts/[contactId]/remind-me`
   - Set/update manual reminder date
5. ✅ Create API endpoint: `POST /api/contacts/[contactId]/off-platform-send`
   - Accept: `{ emailSent: string, subject?: string, platform?: string, notes?: string }`
   - Create record in `off_platform_email_sends`
6. ✅ Create API endpoint: `GET /api/contacts/[contactId]/email-history`
   - Returns combined history: `email_activities` + `off_platform_email_sends`
   - Sorted by date

### Phase 2: Follow-Up Calculator (Week 2)
1. ✅ Create `followUpCalculator` service
2. ✅ Add configurable cadence rules (company-level or global)
3. ✅ Add `nextSendDate` to Contact queries (computed field)
4. ✅ Create API endpoint: `GET /api/contacts/[contactId]/next-send-date`

### Phase 3: Reminder Service (Week 3)
1. ✅ Create `reminderService` to find contacts due
   - Includes both automatic (cadence) and manual (`remindMeOn`) reminders
   - Manual reminders take precedence
2. ✅ Create API endpoint: `GET /api/contacts/due-for-followup`
   - Supports `includeManualReminders` query param
   - Returns `reminderType` field ('manual' | 'automatic')
3. ⏳ Create UI page: `/contacts/follow-ups-due`
4. ⏳ Show list with last send date, days overdue, suggested template

### Phase 4: Cron Job (Week 4)
1. ✅ Set up cron job infrastructure
2. ✅ Create daily reminder digest
3. ✅ Send email or in-app notification
4. ✅ Allow user to configure reminder frequency

### Phase 5: AI Agent (Future)
1. Research & design agent architecture
2. Create agent service with LLM integration
3. Build suggestion engine (template matching + draft)
4. Add approval workflow
5. Test with beta users
6. Iterate based on feedback

---

## API Endpoints

### Set Manual Reminder
```
PUT /api/contacts/[contactId]/remind-me
Body: {
  remindMeOn: string (ISO date string) | null (to clear)
}
Response: {
  success: true,
  contact: { id, firstName, lastName, remindMeOn }
}
```

### Get Manual Reminder Status
```
GET /api/contacts/[contactId]/remind-me
Response: {
  success: true,
  remindMeOn: string | null,
  isDue: boolean,
  daysUntilReminder: number | null
}
```

### Track Off-Platform Send
```
POST /api/contacts/[contactId]/off-platform-send
Body: {
  emailSent: string (ISO date string)
  subject?: string
  platform?: string
  notes?: string
}
```

### Get Email History (Combined)
```
GET /api/contacts/[contactId]/email-history
Returns: {
  activities: [
    {
      id: string
      type: 'platform' | 'off-platform'
      date: string
      subject?: string
      platform?: string
      event?: string
    }
  ]
}
```

### Calculate Next Send Date
```
GET /api/contacts/[contactId]/next-send-date
Returns: {
  nextSendDate: string | null
  lastSendDate: string | null
  daysUntilDue: number | null
  relationship: RelationshipEnum
  cadenceDays: number
}
```

### Get Contacts Due for Follow-Up
```
GET /api/contacts/due-for-followup?companyHQId=xxx&daysOverdue=0&includeManualReminders=true
Returns: {
  contacts: [
    {
      id: string
      firstName: string
      lastName: string
      email: string
      reminderType: 'manual' | 'automatic'
      lastSendDate: string | null
      daysOverdue: number
      nextSendDate: string
      remindMeOn: string | null (if manual reminder)
      relationship: RelationshipEnum
      cadenceDays: number | null
    }
  ],
  count: number,
  filters: { daysOverdue, limit, includeManualReminders }
}
```

---

## Database Schema Changes

### Migration 1: Add `remindMeOn` to Contact

```sql
ALTER TABLE "contacts" ADD COLUMN "remindMeOn" TIMESTAMP(3);
CREATE INDEX "contacts_remindMeOn_idx" ON "contacts"("remindMeOn");
```

### Migration 2: Add `off_platform_email_sends` table

```sql
CREATE TABLE "off_platform_email_sends" (
  "id" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "emailSent" TIMESTAMP(3) NOT NULL,
  "subject" TEXT,
  "platform" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "off_platform_email_sends_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "off_platform_email_sends_contactId_idx" ON "off_platform_email_sends"("contactId");
CREATE INDEX "off_platform_email_sends_contactId_emailSent_idx" ON "off_platform_email_sends"("contactId", "emailSent");
CREATE INDEX "off_platform_email_sends_emailSent_idx" ON "off_platform_email_sends"("emailSent");

ALTER TABLE "off_platform_email_sends" ADD CONSTRAINT "off_platform_email_sends_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

---

## UI Components

### 1. Manual Entry Form
- **Location:** Contact detail page
- **Component:** "Log Off-Platform Send" button/modal
- **Fields:**
  - Date sent (date picker, default: today)
  - Subject (optional)
  - Platform (dropdown: Gmail, Outlook, Apollo, Manual, Other)
  - Notes (optional textarea)

### 2. Follow-Ups Due Page
- **Location:** `/contacts/follow-ups-due`
- **Shows:**
  - Table of contacts due
  - Last send date
  - Days overdue
  - Suggested template
  - Quick actions: "Send Follow-up", "Mark as Contacted"

### 3. Email History Timeline
- **Location:** Contact detail page
- **Shows:**
  - Combined timeline of platform + off-platform sends
  - Visual indicator for each type
  - Next send date highlighted

---

## Configuration

### Follow-Up Cadence Rules

Store in `company_hqs` table or separate `follow_up_config` table:

```prisma
model follow_up_config {
  id                        String      @id @default(cuid())
  companyHQId               String      @unique
  coldFollowUpDays         Int         @default(7)
  warmFollowUpDays         Int         @default(3)
  establishedFollowUpDays   Int         @default(14)
  dormantFollowUpDays       Int         @default(30)
  createdAt                 DateTime    @default(now())
  updatedAt                 DateTime    @updatedAt
  
  company_hqs               company_hqs @relation(fields: [companyHQId], references: [id], onDelete: Cascade)
}
```

Or simpler: Add to `company_hqs` as JSON field:
```prisma
followUpCadence Json? // { cold: 7, warm: 3, established: 14, dormant: 30 }
```

---

## Questions & Decisions Needed

1. **Model Location:** Separate table vs. field on Contact?
   - ✅ **Decision: Separate table** (more flexible, tracks history)

2. **Date Format:** DateTime vs. String?
   - ✅ **Decision: DateTime** (proper date type, queryable)

3. **Cadence Rules:** Company-level vs. Global?
   - **Recommendation:** Company-level (different companies have different cadences)

4. **Reminder Frequency:** Daily? Weekly? User-configurable?
   - **Recommendation:** User-configurable (default: daily)

5. **AI Agent Scope:** Suggest only? Auto-draft? Auto-send?
   - **Recommendation:** Start with suggest, iterate to auto-draft, be cautious with auto-send

6. **Integration with Existing `lastContact` Field:**
   - Should we deprecate `lastContact` (String) in favor of structured tracking?
   - Or keep both (manual note + structured dates)?

---

## Related Docs

- `BETA_OUTREACH_FLOW_AND_GAPS.md` - Step 6 (Send dates) & Step 8 (Remind)
- `CONTACT_MODEL_AUDIT.md` - Contact model structure
- `CURRENT_LAST_SEND_TRACKING.md` - Current email tracking approach

---

## Next Steps

1. ✅ **Review & Approve** this design doc
2. ✅ **Create migration** for `off_platform_email_sends` table
3. ✅ **Implement Phase 1** (data model + basic API)
4. ✅ **Implement Phase 2** (follow-up calculator)
5. ✅ **Implement Phase 3** (reminder service)
6. ⏳ **Run migration** - `npx prisma migrate dev`
7. ⏳ **Test** with manual entries
8. ⏳ **Iterate** based on feedback

---

## Implementation Status

### ✅ Completed (Phase 1-3)

1. **Database Schema**
   - ✅ Added `off_platform_email_sends` model to Prisma schema
   - ✅ Added relation from Contact → off_platform_email_sends
   - ✅ Created migration file: `20260223122647_add_off_platform_email_sends/migration.sql`

2. **Services**
   - ✅ `lib/services/followUpCalculator.js` - Calculate next send dates
   - ✅ `lib/services/reminderService.js` - Find contacts due for follow-up

3. **API Endpoints**
   - ✅ `PUT /api/contacts/[contactId]/remind-me` - Set/update manual reminder
   - ✅ `GET /api/contacts/[contactId]/remind-me` - Get reminder status
   - ✅ `POST /api/contacts/[contactId]/off-platform-send` - Track off-platform send
   - ✅ `GET /api/contacts/[contactId]/off-platform-send` - Get off-platform sends
   - ✅ `GET /api/contacts/[contactId]/email-history` - Combined email history
   - ✅ `GET /api/contacts/[contactId]/next-send-date` - Calculate next send date
   - ✅ `GET /api/contacts/due-for-followup` - Get contacts due for follow-up (includes manual reminders)

### ⏳ Remaining (Phase 4-5)

4. **Cron Job** - Daily reminder digest (requires deployment setup)
5. **AI Agent** - Future enhancement

---

**Status:** 🟢 Phase 1-3 Implemented - Ready for Migration & Testing
