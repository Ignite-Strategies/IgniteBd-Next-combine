# Inbound Email Ingestion Architecture Proposal

## 1. Current Schema Review

### EmailActivity Structure (`email_activities`)

**Current Fields:**
- `id` (String, PK)
- `owner_id` (String, FK → owners)
- `contact_id` (String?, FK → contacts)
- `tenant_id` (String?) - Company HQ context
- `email` (String?) - Recipient email
- `subject` (String?)
- `body` (String?, TEXT) - Email body content
- `event` (String?) - Event type (sent, delivered, opened, clicked, etc.)
- `messageId` (String?, unique) - SendGrid message ID
- `createdAt` (DateTime)
- `updatedAt` (DateTime)
- `emailSequenceOrder` (EmailSequenceOrder?) - OWNER_SEND | CONTACT_SEND
- `responseFromEmail` (String?) - ID of response row (not FK)
- `campaign_id` (String?, FK → campaigns)
- `sequence_id` (String?, FK → email_sequences)
- `sequence_step_id` (String?, FK → sequence_steps)
- `reply_to_message_id` (String?)
- `source` (EmailSource?) - PLATFORM | OFF_PLATFORM
- `platform` (String?) - "sendgrid", "gmail", "outlook", etc.
- `sentAt` (DateTime?)

**Current Indexes:**
- Primary key on `id`
- Unique on `messageId`
- Indexes on: `campaign_id`, `contact_id`, `contact_id + createdAt`, `responseFromEmail`, `messageId`, `owner_id`, `sequence_id`, `source`, `sentAt`, `emailSequenceOrder`

### Company Schema (`company_hqs`)

**Relevant Fields:**
- `id` (String, PK)
- `slug` (String?, unique) - URL-friendly identifier (e.g., "acme-corp")
- `companyName` (String)
- `ownerId` (String?, FK → owners)
- Other company metadata fields

**Current Routing:**
- Company slugs are used in routes: `/cockpit/{businessSlug}`
- Slug is optional but unique when present
- Used for deterministic company identification

### Contact Schema (`contacts`)

**Relevant Fields:**
- `id` (String, PK)
- `email` (String?) - Contact email address
- `fullName` (String?) - Contact full name
- `nextEngagementDate` (String?) - ISO date only "YYYY-MM-DD"
- `nextEngagementPurpose` (NextEngagementPurpose?) - Purpose enum
- `crmId` (String, FK → company_hqs)

**Note:** `nextEngagementDate` is stored as date-only string "YYYY-MM-DD" (not DateTime)

### Missing Fields for Inbound Email Ingestion

**Raw Email Storage:**
- ❌ `emailRawText` (TEXT) - Required: Client's literal email as received (forwarded/pasted)

**Inbound Routing:**
- ✅ `tenant_id` exists but needs deterministic routing logic
- ❌ No explicit field for recipient address parsing
- ❌ No validation mechanism for company slug extraction

---

## 2. Proposed Schema Updates

### New Fields on `email_activities`

```prisma
model email_activities {
  // ... existing fields ...
  
  // Raw email storage (preserve original)
  emailRawText    String?  @db.Text  // Client's literal email (forwarded/pasted chains)
  
  // ... rest of existing fields ...
}
```

### Schema Rationale

**Raw Storage Requirements:**
- `emailRawText` stores the **exact email** the client sends (forwarded chains, pasted content)
- This is the literal email content - no formatting discipline expected
- Field is **never overwritten** - source of truth
- Future: Client may put contact name in subject line, but this is raw ingest (no parsing logic)

**No Status Tracking:**
- No `ingestionStatus` enum - keep it simple
- No `direction` enum - use existing `emailSequenceOrder` field
- No `parsedJson` storage - AI returns structured data that maps directly to schema fields

**Backwards Compatibility:**
- New field is **optional** (nullable)
- Existing records remain valid (null for new field)
- No breaking changes to existing queries

### Indexes

```prisma
// No new indexes needed - existing indexes sufficient
```

---

## 3. Ingestion Flow Design

### Architecture Flow

```
1. Webhook Receives POST from SendGrid
   ↓
2. Parse multipart/form-data
   - Extract: from, to, subject, text, html, headers
   ↓
3. Extract companySlug from recipient address
   - Parse "to" field: {companySlug}@crm.domain.com
   - Example: "acme-corp@crm.ignitestrategies.co" → slug: "acme-corp"
   ↓
4. Validate companySlug exists in company_hqs
   - Query: SELECT id FROM company_hqs WHERE slug = ?
   - If not found → return 400 (invalid recipient)
   ↓
5. Create EmailActivity record (everything null initially)
   - Set: emailRawText = full email text (preserve exactly)
   - Set: tenant_id = company_hqs.id (from slug lookup)
   - Set: emailSequenceOrder = "CONTACT_SEND"
   - Set: source = "OFF_PLATFORM"
   - Set: platform = "sendgrid_inbound"
   - Set: subject = null, body = null, contact_id = null, etc. (all null)
   ↓
6. Trigger OpenAI parsing service (async, after save)
   - Call: takeCrmClientEmailAndParseAiService(emailRawText, headers)
   - Service returns structured data matching EmailActivity fields
   - AI does NOT determine tenancy (already set)
   - AI does NOT create contacts (v1 restriction)
   ↓
7. Update record with parsed fields directly
   - Map AI response directly to EmailActivity columns:
     - subject = parsed.subject
     - body = parsed.body
     - email = parsed.contactEmail (from field)
     - contact_id = match by parsed.contactEmail (if found)
   ↓
8. Detect if this is a response (threading lookup)
   - Check parsed.inReplyTo for Message-ID
   - Query: SELECT id FROM email_activities WHERE messageId = ? AND tenant_id = ?
   - If found → this is a response to existing email
   ↓
9. Handle response vs new action
   - If response detected:
     - Update **original email**: responseFromEmail = new inbound row's id (stamp parent)
     - Update **original email**: event = 'sent' (proof it went out)
     - Set contact.nextEngagementDate = today + 7 days (1 week)
     - Set contact.nextEngagementPurpose = 'PERIODIC_CHECK_IN'
   - If new action:
     - If nextEngagementDate parsed → update contact.nextEngagementDate
   - Preserve emailRawText unchanged
   ↓
8. Error handling
   - If AI fails → log error but preserve emailRawText
   - Return 200 to SendGrid (don't retry on our side)
   - Record remains with null fields (can retry parsing later)
```

### Key Design Principles

**Deterministic Routing:**
- Company routing is **NOT AI-based**
- Extract slug from recipient address deterministically
- Validate slug exists in database before processing
- Fail fast if slug invalid (400 response)

**AI as Parsing Layer:**
- AI extracts structured fields from raw email
- AI does NOT determine tenancy (already set from slug)
- AI does NOT auto-create contacts (v1 restriction)
- AI output maps directly to EmailActivity schema fields (no intermediate JSON storage)

**Raw Email Preservation:**
- `emailRawText` is **never overwritten**
- Original email is source of truth
- AI parsing can be re-run if needed
- User can always view original

**Simple & Chill:**
- No status tracking enums
- No complex state machines
- Just: save raw email → parse → update fields
- Keep it simple

---

## 4. AI Parsing Service

### Service: `takeCrmClientEmailAndParseAiService`

**Location:** `lib/services/takeCrmClientEmailAndParseAiService.ts`

**Pattern:** Follows existing parsing services (e.g., `PersonaMinimalService`, `parseRunClubFromText`)

**Input:**
```typescript
emailRawText: string  // Client's literal email (forwarded chains, pasted content)
```

**Output:**
```typescript
{
  subject: string,              // Extracted subject
  body: string,                 // Extracted body (cleaned if needed)
  contactEmail: string,         // Contact email address
  contactName: string?,         // Contact name (if found)
  nextEngagementDate: string?,  // ISO date "YYYY-MM-DD" (if mentioned)
  inReplyTo?: string,           // Message-ID from In-Reply-To header (if present)
  references?: string[],         // Message-IDs from References header (if present)
  isResponse?: boolean,         // AI-detected: is this likely a response?
}
```

**What to Parse:**
1. **Contact Name** - Extract from email signature, from field, or body
2. **Contact Email** - Extract from from field or signature
3. **Next Engagement Date** - Look for date mentions like "follow up in 3-6 months", "later this year", specific dates
4. **Threading Headers** - Extract In-Reply-To and References headers for response detection
5. **Response Detection** - Determine if this appears to be a response (subject starts with "RE:", contains quoted text, etc.)

**AI Prompt Structure:**
```
You are an email parsing assistant. Extract structured data from this raw email.

The email may be a forwarded chain or pasted content. Extract:

1. Contact name (from signature, from field, or body)
2. Contact email (from from field or signature)
3. Next engagement date (if mentioned - look for phrases like "follow up in X months", "later this year", specific dates)
4. Threading headers (In-Reply-To, References) if present in raw headers
5. Response detection (does this appear to be a reply? subject starts with "RE:", contains quoted text, etc.)

Return JSON:
{
  "subject": "...",
  "body": "...",
  "contactEmail": "...",
  "contactName": "...",
  "nextEngagementDate": "YYYY-MM-DD" or null,
  "inReplyTo": "Message-ID" or null,
  "references": ["Message-ID1", "Message-ID2"] or null,
  "isResponse": true or false
}

Raw email:
{emailRawText}
```

**Implementation Pattern:**
```typescript
// Similar to PersonaMinimalService.parseResponse()
private static parseResponse(content: string): ParsedEmailData {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (parseError) {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Invalid JSON response from OpenAI');
    }
  }
  
  return {
    subject: parsed.subject || '',
    body: parsed.body || '',
    contactEmail: parsed.contactEmail || '',
    contactName: parsed.contactName || null,
    nextEngagementDate: parsed.nextEngagementDate || null,
  };
}
```

### Matching Strategy

**Contact Matching:**
- Use `contactEmail` from parsed data
- Query: `SELECT id FROM contacts WHERE email = ? AND crmId = ?`
- If found → set `contact_id` on email_activities
- If not found → leave `contact_id` null (manual review)

**Response Detection (Threading):**
- Check if this email is a response to an existing `email_activities` record
- Lookup: Extract Message-ID from In-Reply-To header, find matching `email_activities.messageId`
- Pattern matches existing `off-platform-conversation` route (lines 121-126)

**Response Handling:**
- If response detected:
  1. Create new inbound `email_activities` row (CONTACT_SEND) - this is the response
  2. Find original `email_activities` record by `messageId` (from In-Reply-To header)
  3. Update **original email**: `responseFromEmail` = new inbound row's `id` (stamp parent with response id)
  4. Update **original email**: `event` = 'sent' (proof email went out)
  5. Set `contact.nextEngagementDate` = today + 7 days (1 week from response)
  6. Set `contact.nextEngagementPurpose` = 'PERIODIC_CHECK_IN'

**New Action Handling:**
- If NOT a response (new action):
  1. Parse `nextEngagementDate` from email content if mentioned
  2. If `nextEngagementDate` parsed and `contact_id` found:
     - Update `contacts.nextEngagementDate` = parsed date
     - Date format: "YYYY-MM-DD" (date-only string)
  3. If `contact_id` not found → skip (can't set engagement date without contact)

**Complexity Note:**
- Threading detection is complex and may not be 100% accurate
- It's okay if we can't perfectly detect all responses
- Fallback: User can manually link responses in UI
- Priority: Detect obvious responses (In-Reply-To header) first

**Example Email Parsing:**

From the provided example:
```
Joel Gulick
BusinessPoint Law PLLC
(703) 298-8051 
Joel.Gulick@businesspointlaw.com

"I will follow up later this year as suggested."
```

Parsed output:
```json
{
  "contactEmail": "Joel.Gulick@businesspointlaw.com",
  "contactName": "Joel Gulick",
  "nextEngagementDate": null,  // "later this year" is too vague
  "subject": "RE: NDA Processing Check-In",
  "body": "Thanks for letting me know. I will follow up later this year..."
}
```

---

## 5. UX Implications

### Inbound Review Page

**Route:** `/inbound-emails` or `/cockpit/{companySlug}/inbound`

**Features:**

1. **List View:**
   - Table of inbound emails
   - Columns: Date, From, Subject, Contact, Actions
   - Filter by: date range, contact
   - Sort by: date (newest first)

2. **Detail View:**
   - Show parsed fields (subject, body, contact info)
   - Toggle to view `emailRawText` (original email)
   - Show contact match status
   - Show nextEngagementDate if parsed

3. **Editing Interface:**
   - Allow editing of parsed fields
   - Fields: subject, body, contact assignment
   - "Save" button to finalize
   - "Re-parse" button to re-run AI parsing

4. **Contact Matching:**
   - Show parsed contact email/name
   - Show matched contact (if found)
   - Allow manual contact selection
   - Create new contact option (v1: manual only)

5. **Next Engagement Date:**
   - Show parsed date (if found)
   - Allow editing date
   - Update contact.nextEngagementDate when saved

### User Workflow

```
1. Email arrives → email_activities created (all fields null except emailRawText)
   ↓
2. AI processes → Fields updated directly (subject, body, contactEmail, etc.)
   ↓
3. User reviews in Inbound Review page
   - Sees parsed fields
   - Views raw email if needed
   - Reviews contact match
   ↓
4. User edits if needed
   - Adjusts subject/body
   - Selects/creates contact
   - Sets nextEngagementDate
   ↓
5. User clicks "Save"
   - Updates email_activities with final fields
   - Links to contact
   - Updates contact.nextEngagementDate if set
```

### Always Visible

- **Original raw input** (`emailRawText`) - Always accessible via toggle
- **Parsed fields** - Always shown (if parsing succeeded)
- **Ability to override** - All parsed fields editable

---

## 6. Migration Plan

### Schema Migration Steps

1. **Add new column (nullable):**
   ```sql
   ALTER TABLE "email_activities" 
     ADD COLUMN "emailRawText" TEXT;
   ```

2. **No new indexes needed** - existing indexes sufficient

### Backwards Compatibility

**Existing Records:**
- New field is `NULL` for existing records
- Existing queries continue to work (null checks where needed)
- No data loss or modification

**API Compatibility:**
- Existing endpoints unchanged
- New field optional in API responses
- No breaking changes

**Application Code:**
- Update Prisma schema
- Regenerate Prisma client
- Add null checks where reading new field
- No breaking changes to existing code paths

### Rollout Strategy

1. **Phase 1: Schema Migration**
   - Deploy migration
   - Verify no errors
   - Confirm existing records unaffected

2. **Phase 2: Webhook Handler**
   - Update `/api/inbound-email` route
   - Implement slug extraction
   - Save raw email (emailRawText)
   - Create record with null fields initially
   - Test with SendGrid webhook

3. **Phase 3: AI Parsing Service**
   - Implement `takeCrmClientEmailAndParseAiService`
   - Parse contact name, email, nextEngagementDate
   - Update email_activities fields directly
   - Handle contact matching
   - Handle nextEngagementDate updates

4. **Phase 4: UX**
   - Build Inbound Review page
   - Add editing interface
   - Test user workflow

### Risk Mitigation

**Data Safety:**
- New field nullable (no required constraints)
- Raw data preserved even if AI fails
- No auto-deletion or modification of existing records

**Performance:**
- Async AI processing (non-blocking)
- Raw email storage may be large (TEXT field)

**Error Handling:**
- Fail gracefully if slug invalid
- Log AI failures but don't block ingestion
- Preserve emailRawText even on errors
- Record remains with null fields if parsing fails (can retry)

---

## 7. Implementation Notes

### Company Slug Extraction

```typescript
function extractCompanySlug(recipientAddress: string): string | null {
  // Parse: {companySlug}@crm.domain.com
  const match = recipientAddress.match(/^([^@]+)@crm\.(.+)$/);
  if (!match) return null;
  
  const slug = match[1].toLowerCase().trim();
  return slug || null;
}
```

### Validation

```typescript
async function validateCompanySlug(slug: string): Promise<string | null> {
  const company = await prisma.company_hqs.findUnique({
    where: { slug },
    select: { id: true }
  });
  return company?.id || null;
}
```

### Service Implementation Pattern

**Follow existing parsing services:**
- `lib/services/PersonaMinimalService.ts` - Class-based service
- `lib/services/parseRunClubFromText.ts` - Function-based service
- Pattern: OpenAI call → JSON parse → return structured data → caller maps to DB

**Service Structure:**
```typescript
// lib/services/takeCrmClientEmailAndParseAiService.ts

export interface ParsedEmailData {
  subject: string;
  body: string;
  contactEmail: string;
  contactName: string | null;
  nextEngagementDate: string | null;  // "YYYY-MM-DD" or null
  inReplyTo: string | null;           // Message-ID from In-Reply-To header
  references: string[] | null;         // Message-IDs from References header
  isResponse: boolean;                // AI-detected: is this likely a response?
}

export async function takeCrmClientEmailAndParseAiService(
  emailRawText: string,
  headers?: string  // Raw headers string from SendGrid
): Promise<ParsedEmailData> {
  // 1. Extract headers (In-Reply-To, References) if provided
  // 2. Build prompt (include headers in context)
  // 3. Call OpenAI
  // 4. Parse JSON response
  // 5. Return structured data
  // 6. Caller maps to email_activities fields and handles threading
}
```

### Threading Lookup Implementation

**Response Detection Logic:**
```typescript
// Pattern matches existing off-platform-conversation route
async function detectAndLinkResponse(
  newInboundEmailId: string,
  parsed: ParsedEmailData,
  tenantId: string,
  contactId: string | null
): Promise<void> {
  // Lookup original email by Message-ID from In-Reply-To header
  if (!parsed.inReplyTo) return; // Not a response
  
  const original = await prisma.email_activities.findFirst({
    where: {
      messageId: parsed.inReplyTo,
      tenant_id: tenantId,
    },
    select: { id: true }
  });
  
  if (!original) return; // Original not found
  
  // Update PARENT row: stamp it with response id (existing pattern)
  await prisma.email_activities.update({
    where: { id: original.id },
    data: {
      responseFromEmail: newInboundEmailId,  // Parent stores response id
      event: 'sent'  // Proof email went out
    }
  });
  
  // Set next engagement date (1 week from response)
  if (contactId) {
    const oneWeekFromNow = new Date();
    oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
    const nextEngagementDate = oneWeekFromNow.toISOString().slice(0, 10); // "YYYY-MM-DD"
    
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        nextEngagementDate,
        nextEngagementPurpose: 'PERIODIC_CHECK_IN'
      }
    });
  }
}
```

**New Action Handling:**
```typescript
// If NOT a response, use parsed nextEngagementDate if available
if (!parsed.inReplyTo && parsed.nextEngagementDate && contactId) {
  await prisma.contact.update({
    where: { id: contactId },
    data: {
      nextEngagementDate: parsed.nextEngagementDate
    }
  });
}
```

### Next Engagement Date Handling

**Date Parsing:**
- Look for explicit dates: "March 15, 2026", "3/15/2026"
- Look for relative dates: "in 3 months", "later this year", "Q2 2026"
- Convert to ISO date format: "YYYY-MM-DD"
- If too vague → return null

**Contact Update:**
```typescript
if (parsed.nextEngagementDate && contactId) {
  await prisma.contact.update({
    where: { id: contactId },
    data: {
      nextEngagementDate: parsed.nextEngagementDate,  // "YYYY-MM-DD" string
      // nextEngagementPurpose can be set to GENERAL_CHECK_IN or left null
    }
  });
}
```

---

## Summary

This architecture proposal:

✅ Preserves raw email exactly as received (`emailRawText`)  
✅ Routes deterministically via company slug  
✅ Uses AI only for parsing (not routing)  
✅ Simple approach - no status tracking  
✅ Maps AI output directly to schema fields (no intermediate JSON)  
✅ Response detection and threading support  
✅ Maintains backwards compatibility  
✅ Handles errors gracefully  

**Key Features:**
- **Raw Email Storage:** `emailRawText` stores client's literal email (forwarded chains, pasted content)
- **Response Detection:** Detects if email is a response to existing email_activities record
- **Threading:** Links responses via `responseFromEmail` field
- **Proof of Send:** Marks original email as `event = 'sent'` when response received
- **Next Engagement Date:**
  - **Response:** Sets `contact.nextEngagementDate` = today + 7 days (1 week)
  - **New Action:** Uses parsed date from email content if mentioned

**Key Simplifications:**
- No `ingestionStatus` enum - keep it chill
- No `parsedJson` storage - map directly to fields
- No complex state machine - just parse and update
- `emailRawText` is the literal email client sends

**Response Detection:**
- Uses existing threading pattern: parent row stores `responseFromEmail` = response row's id
- Matches `off-platform-conversation` route pattern (lines 121-126)
- Lookup by Message-ID from In-Reply-To header
- If not found → treat as new action (user can manually link later)

**Next Steps:**
1. Review and approve schema changes
2. Create migration (add `emailRawText` column)
3. Implement webhook handler with slug extraction
4. Build `takeCrmClientEmailAndParseAiService` with threading support
5. Implement response detection logic
6. Create Inbound Review UX
