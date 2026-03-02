# Target Subdomain Architecture Analysis

## 1. Current Inbound Architecture Summary

### How `crm.` Currently Works End-to-End

**Current State (MVP):**
- Webhook endpoint: `/api/inbound-email`
- Currently logs only (no database persistence)
- Receives multipart/form-data from SendGrid
- Extracts: from, to, subject, text, html, headers
- Returns 200 immediately

**Proposed Architecture (from `inbound-email-architecture-proposal.md`):**

1. **Webhook Reception:**
   - Endpoint: `/api/inbound-email` (or `/api/inbound-crm`)
   - Receives POST from SendGrid Inbound Parse
   - Parses multipart/form-data

2. **Slug Extraction:**
   - Parses recipient address: `{companySlug}@crm.ignitestrategies.co`
   - Extracts slug using regex: `^([^@]+)@crm\.(.+)$`
   - Example: `acme-corp@crm.ignitestrategies.co` → slug: `acme-corp`

3. **Slug Validation:**
   - Queries `company_hqs` table: `SELECT id FROM company_hqs WHERE slug = ?`
   - Returns 400 if slug not found (invalid recipient)
   - Sets `tenant_id` = `company_hqs.id` for routing

4. **Raw Data Storage:**
   - Creates `email_activities` record immediately
   - Sets `rawText` = full email text (preserved exactly)
   - Sets `rawHtml` = HTML content (if present)
   - Sets `rawHeaders` = headers as JSON (if present)
   - Sets `ingestionStatus` = "INGESTED"
   - Sets `direction` = "INBOUND"
   - Sets `emailSequenceOrder` = "CONTACT_SEND"
   - Sets `source` = "OFF_PLATFORM"
   - Sets `platform` = "sendgrid_inbound"

5. **AI Enrichment (Async):**
   - Triggers OpenAI normalization after save
   - AI extracts structured fields: subject, body, sender info, threading hints
   - AI does NOT determine tenancy (already set)
   - AI does NOT create contacts (v1 restriction)
   - Updates record: `parsedJson` = AI output, `aiSummary` = summary text
   - Sets `ingestionStatus` = "PARSED"

6. **Status Tracking:**
   - `ingestionStatus`: "INGESTED" → "PARSED" → (or "FAILED")
   - `direction`: "INBOUND" (explicit)
   - Status visible in UX for review workflow

### Where Routing Occurs

**Deterministic Routing:**
- Routing happens at **webhook handler level** (before database save)
- Extracted from `to` field in SendGrid payload
- Pattern: `{companySlug}@crm.{domain}`
- Validated against `company_hqs.slug` before processing
- Sets `tenant_id` field for company scoping

**No AI-Based Routing:**
- Company identification is deterministic (slug extraction)
- AI only normalizes content, not routing
- Routing failure = 400 response (invalid recipient)

### How Slug Validation Works

```typescript
// Extract slug from recipient
function extractCompanySlug(recipientAddress: string, subdomain: string): string | null {
  const pattern = new RegExp(`^([^@]+)@${subdomain}\\.(.+)$`);
  const match = recipientAddress.match(pattern);
  if (!match) return null;
  return match[1].toLowerCase().trim() || null;
}

// Validate slug exists
async function validateCompanySlug(slug: string): Promise<string | null> {
  const company = await prisma.company_hqs.findUnique({
    where: { slug },
    select: { id: true }
  });
  return company?.id || null;
}
```

### How Raw Data is Stored

**Storage Strategy:**
- `rawText` (TEXT) - Required, never overwritten
- `rawHtml` (TEXT) - Optional, preserved
- `rawHeaders` (JSON) - Optional, full headers
- All raw fields immutable after initial save
- Source of truth for original email content

**Storage Location:**
- Stored in `email_activities` table
- New fields added to existing model
- All fields nullable for backwards compatibility

### How AI Enrichment Runs

**Processing Flow:**
1. Save raw email immediately (status = "INGESTED")
2. Return 200 to SendGrid (non-blocking)
3. Trigger async AI normalization job
4. AI processes `rawText` and returns structured JSON
5. Update record with `parsedJson` and `aiSummary`
6. Set `ingestionStatus` = "PARSED"

**AI Constraints:**
- Does NOT determine tenancy (already set from slug)
- Does NOT create contacts (manual review required)
- Only normalizes content structure
- Returns JSON matching EmailActivity schema

### How Status is Tracked

**Status Enum:**
- `INGESTED` - Raw email received, AI processing pending
- `PARSED` - AI normalization completed successfully
- `FAILED` - AI processing failed or error occurred

**Status Transitions:**
- Initial save: `INGESTED`
- After AI success: `PARSED`
- After AI failure: `FAILED`
- Status visible in UX for filtering and review

---

## 2. Proposed Pattern for `target.` Subdomain

### Purpose & Intent

**`target.` Subdomain Use Cases:**
- **Contact Creation** - Email contains new contact information
- **Note Logging** - Email contains notes/updates about existing contacts
- **Template Draft Creation** - Email contains content for email templates

**Key Principle:**
- All actions create **draft objects only**
- **No automatic execution**
- **UI review required** before finalization
- **No auto-sending** of emails

### Reusing Slug-Based Deterministic Routing

**Same Routing Pattern:**
- Extract slug from: `{companySlug}@target.ignitestrategies.co`
- Validate slug exists in `company_hqs`
- Set `tenant_id` = `company_hqs.id`
- Fail fast if slug invalid (400 response)

**Routing Logic Reuse:**
```typescript
// Same extraction function, different subdomain
const slug = extractCompanySlug(recipientAddress, 'target');
const companyId = await validateCompanySlug(slug);
```

### Separate Webhook Endpoint vs Shared Endpoint

**Option A: Separate Endpoint**
- `/api/inbound-target` - Dedicated endpoint for target subdomain
- Clear separation of concerns
- Different processing logic per endpoint
- Easier to maintain and debug

**Option B: Shared Endpoint with Subdomain Detection**
- Single `/api/inbound-email` endpoint
- Detect subdomain from `to` field
- Route to appropriate handler based on subdomain
- More centralized but requires routing logic

**Recommendation:** Option A (separate endpoints) for clarity and separation

### Raw Email Storage (Same Pattern)

**Identical Storage Strategy:**
- Preserve `rawText` exactly as received
- Store `rawHtml` and `rawHeaders` if present
- Never overwrite raw data
- Raw email is source of truth

**Storage Location:**
- Depends on schema choice (see Section 3)
- Could reuse `email_activities` with intent field
- Could use separate `inbound_actions` table
- Could use shared ingestion table with channel discriminator

### New Action-Type Field

**Action Types (Enum):**
- `CONTACT_CREATE` - Email contains new contact information
- `NOTE_CREATE` - Email contains notes/updates
- `TEMPLATE_CREATE` - Email contains template content

**Action Intent Detection:**
- AI determines intent from email content
- AI returns `intent` field in `parsedJson`
- User can override intent in UI
- Intent determines which draft object to create

**Draft Object Creation:**
- `CONTACT_CREATE` → Creates draft contact (not saved to `contacts` table)
- `NOTE_CREATE` → Creates draft note (not saved to notes/activities)
- `TEMPLATE_CREATE` → Creates draft template (not saved to `templates` table)

### No Auto-Sending

**Strict Guardrails:**
- No email sending triggered by inbound email
- No automatic mutations to existing records
- No automatic contact creation
- All actions require UI approval

**Workflow:**
1. Email arrives → Draft object created
2. AI processes → Intent determined
3. User reviews in UI → Approves/rejects
4. User clicks "Approve" → Final object created
5. No automatic side effects

---

## 3. Schema Considerations

### Option A: Reuse EmailActivity with Intent Field

**Approach:**
- Add `intent` field to `email_activities`
- Add `actionType` enum: `CONTACT_CREATE`, `NOTE_CREATE`, `TEMPLATE_CREATE`
- Add `channel` field: `CRM` | `TARGET`
- Store draft data in `parsedJson`

**Schema Addition:**
```prisma
model email_activities {
  // ... existing fields ...
  
  channel    InboundChannel?  // "CRM" | "TARGET"
  intent     InboundIntent?   // "CONTACT_CREATE" | "NOTE_CREATE" | "TEMPLATE_CREATE"
  draftData  Json?            // Draft object data (contact, note, template)
  
  // ... rest of fields ...
}

enum InboundChannel {
  CRM     // Email logging/activity tracking
  TARGET  // Action intake (contacts, notes, templates)
}

enum InboundIntent {
  CONTACT_CREATE   // Create new contact
  NOTE_CREATE      // Log note/update
  TEMPLATE_CREATE  // Create email template
}
```

**Pros:**
- ✅ Single table for all inbound emails
- ✅ Reuses existing raw storage fields
- ✅ Unified query interface
- ✅ Consistent status tracking
- ✅ Minimal schema changes

**Cons:**
- ❌ Mixes concerns (logging vs actions)
- ❌ `email_activities` becomes more generic
- ❌ May confuse queries (need channel filter)
- ❌ Draft objects stored as JSON (less structured)

### Option B: Create New InboundAction Table

**Approach:**
- New `inbound_actions` table
- Separate from `email_activities`
- Dedicated to action intake
- Clear separation of concerns

**Schema:**
```prisma
model inbound_actions {
  id                String            @id @default(cuid())
  tenant_id         String            // Company HQ (from slug)
  owner_id          String?           // Owner (from company)
  
  // Raw email storage
  rawText           String            @db.Text
  rawHtml           String?           @db.Text
  rawHeaders        Json?
  
  // AI processing
  parsedJson        Json?
  aiSummary         String?           @db.Text
  
  // Status tracking
  ingestionStatus   InboundActionStatus
  intent            InboundIntent
  
  // Draft object data
  draftData         Json?             // Contact, note, or template draft
  
  // Metadata
  recipientAddress  String            // Full "to" address
  senderAddress     String            // Full "from" address
  subject           String?
  
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  
  company_hqs       company_hqs       @relation(fields: [tenant_id], references: [id])
  owners            owners?           @relation(fields: [owner_id], references: [id])
  
  @@index([tenant_id])
  @@index([ingestionStatus])
  @@index([intent])
  @@index([tenant_id, ingestionStatus])
}

enum InboundActionStatus {
  INGESTED
  PARSED
  APPROVED
  REJECTED
  FAILED
}

enum InboundIntent {
  CONTACT_CREATE
  NOTE_CREATE
  TEMPLATE_CREATE
}
```

**Pros:**
- ✅ Clear separation of concerns
- ✅ Dedicated table for actions
- ✅ Easier to query action-specific data
- ✅ No confusion with email logging
- ✅ Can evolve independently

**Cons:**
- ❌ Duplicates raw storage fields
- ❌ Two tables to maintain
- ❌ More complex queries if need unified view
- ❌ More schema changes

### Option C: Shared Ingestion Table with Channel Discriminator

**Approach:**
- New `inbound_emails` table (shared ingestion)
- `channel` field discriminates: `CRM` | `TARGET`
- Routes to appropriate downstream table
- Raw storage centralized

**Schema:**
```prisma
model inbound_emails {
  id                String            @id @default(cuid())
  tenant_id         String            // Company HQ (from slug)
  owner_id          String?           // Owner (from company)
  
  // Channel discrimination
  channel           InboundChannel   // "CRM" | "TARGET"
  
  // Raw email storage
  rawText           String            @db.Text
  rawHtml           String?           @db.Text
  rawHeaders        Json?
  
  // AI processing
  parsedJson        Json?
  aiSummary         String?           @db.Text
  
  // Status tracking
  ingestionStatus   InboundIngestionStatus
  
  // Intent (for TARGET channel)
  intent            InboundIntent?
  
  // Metadata
  recipientAddress  String
  senderAddress     String
  subject           String?
  
  // Downstream references
  emailActivityId   String?           // FK to email_activities (if CRM)
  inboundActionId   String?           // FK to inbound_actions (if TARGET)
  
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  
  company_hqs       company_hqs       @relation(fields: [tenant_id], references: [id])
  owners            owners?           @relation(fields: [owner_id], references: [id])
  
  @@index([tenant_id])
  @@index([channel])
  @@index([ingestionStatus])
  @@index([channel, ingestionStatus])
}

enum InboundChannel {
  CRM
  TARGET
}

enum InboundIngestionStatus {
  INGESTED
  PARSED
  FAILED
}
```

**Pros:**
- ✅ Centralized raw storage
- ✅ Clear channel separation
- ✅ Flexible routing to downstream tables
- ✅ Single source of truth for raw emails

**Cons:**
- ❌ More complex schema (three tables)
- ❌ Requires FK management
- ❌ More joins for queries
- ❌ Over-engineered for current needs

### Recommendation: Option B (New InboundAction Table)

**Rationale:**
- **Clear Separation:** `email_activities` for logging, `inbound_actions` for actions
- **Independent Evolution:** Each table can evolve for its purpose
- **Simpler Queries:** No need to filter by channel everywhere
- **Better Semantics:** Table name matches purpose
- **Draft Objects:** Can store structured draft data without mixing concerns

**Tradeoffs Accepted:**
- Some duplication of raw storage fields (acceptable for clarity)
- Two tables to maintain (but clear boundaries)
- More schema changes (but cleaner long-term)

---

## 4. Endpoint Design Options

### Option A: Single Webhook Endpoint with Subdomain Detection

**Endpoint:** `/api/inbound-email`

**Flow:**
```typescript
POST /api/inbound-email
1. Parse multipart/form-data
2. Extract `to` field
3. Detect subdomain from `to`:
   - If `@crm.` → route to CRM handler
   - If `@target.` → route to TARGET handler
4. Execute appropriate handler
5. Return 200
```

**Pros:**
- ✅ Single endpoint to configure in SendGrid
- ✅ Centralized webhook handling
- ✅ Easier to add new subdomains later
- ✅ Shared validation logic

**Cons:**
- ❌ Routing logic in handler (more complex)
- ❌ Harder to debug (which path executed?)
- ❌ Mixed concerns in one endpoint
- ❌ Harder to scale independently

### Option B: Separate Webhook Endpoints

**Endpoints:**
- `/api/inbound-crm` - For `crm.` subdomain
- `/api/inbound-target` - For `target.` subdomain

**Flow:**
```typescript
// SendGrid config:
// crm.ignitestrategies.co → https://app.ignitegrowth.biz/api/inbound-crm
// target.ignitestrategies.co → https://app.ignitegrowth.biz/api/inbound-target

POST /api/inbound-crm
1. Parse multipart/form-data
2. Extract slug from `to` (expects @crm.)
3. Validate slug
4. Create email_activities record
5. Trigger AI enrichment
6. Return 200

POST /api/inbound-target
1. Parse multipart/form-data
2. Extract slug from `to` (expects @target.)
3. Validate slug
4. Create inbound_actions record
5. Trigger AI intent detection
6. Return 200
```

**Pros:**
- ✅ Clear separation of concerns
- ✅ Easier to debug (dedicated endpoint)
- ✅ Independent scaling
- ✅ Simpler handler logic
- ✅ Clear SendGrid configuration

**Cons:**
- ❌ Two endpoints to maintain
- ❌ Some code duplication (validation, parsing)
- ❌ Two SendGrid configurations

### Recommendation: Option B (Separate Endpoints)

**Rationale:**
- **Clarity:** Each endpoint has single responsibility
- **Maintainability:** Easier to understand and debug
- **Independence:** Can evolve endpoints separately
- **SendGrid Config:** Clear mapping (subdomain → endpoint)

**Code Sharing:**
- Extract shared utilities:
  - `extractCompanySlug(recipientAddress, subdomain)`
  - `validateCompanySlug(slug)`
  - `parseSendGridPayload(formData)`
- Each endpoint imports shared utilities
- Minimal duplication, maximum clarity

---

## 5. Safety & Guardrails

### No Auto-Sending

**Strict Rule:**
- Inbound emails **never** trigger outbound sends
- No automatic email sending from `target.` subdomain
- No automatic email sending from `crm.` subdomain (for now)
- All sends require explicit user action

**Implementation:**
- No `sendEmail()` calls in webhook handlers
- No background jobs that auto-send
- No triggers on inbound action approval
- Explicit "Send Email" button in UI only

### No Automatic Destructive Mutations

**Protected Operations:**
- No automatic deletion of records
- No automatic updates to existing contacts
- No automatic changes to existing templates
- No automatic pipeline stage changes

**Allowed Operations:**
- Create draft objects only
- Update draft objects (before approval)
- Create final objects (after user approval)
- Link draft to existing records (user selects)

### Draft-Only Creation

**Draft Object Pattern:**
- All inbound actions create draft objects
- Drafts stored in `draftData` JSON field
- Drafts visible in UI for review
- User must explicitly approve to create final object

**Draft Lifecycle:**
```
1. Email arrives → Draft created (status: INGESTED)
2. AI processes → Draft enriched (status: PARSED)
3. User reviews → Draft visible in UI
4. User approves → Final object created, draft linked
5. User rejects → Draft marked REJECTED, no object created
```

**Draft Storage:**
- `CONTACT_CREATE` → `draftData: { firstName, lastName, email, ... }`
- `NOTE_CREATE` → `draftData: { contactId, noteText, ... }`
- `TEMPLATE_CREATE` → `draftData: { subject, body, ... }`

### Slug Validation Required

**Validation Rules:**
- Extract slug from recipient address
- Validate slug exists in `company_hqs` table
- Return 400 if slug invalid
- Never process email without valid slug
- Log invalid attempts for monitoring

**Implementation:**
```typescript
const slug = extractCompanySlug(recipientAddress, subdomain);
if (!slug) {
  return NextResponse.json(
    { success: false, error: 'Invalid recipient address format' },
    { status: 400 }
  );
}

const companyId = await validateCompanySlug(slug);
if (!companyId) {
  return NextResponse.json(
    { success: false, error: 'Company slug not found' },
    { status: 400 }
  );
}
```

### Always Return 200 to SendGrid

**SendGrid Behavior:**
- SendGrid retries on non-2xx responses
- We want to accept email even if processing fails
- Return 200 immediately after saving raw email
- Process AI enrichment asynchronously

**Error Handling:**
```typescript
try {
  // Save raw email
  await saveRawEmail(...);
  
  // Return success immediately
  return NextResponse.json({ success: true }, { status: 200 });
  
  // Trigger async AI processing (non-blocking)
  processAIEnrichment(emailId).catch(err => {
    console.error('AI processing failed:', err);
    // Update status to FAILED, but email already saved
  });
} catch (error) {
  // Even on error, return 200 to prevent retries
  console.error('Webhook error:', error);
  return NextResponse.json({ success: false }, { status: 200 });
}
```

**Exception:**
- Return 400 for invalid slug (before save)
- SendGrid may retry, but we'll reject again
- Prevents invalid emails from being processed

### Raw Email Never Modified

**Immutability Rule:**
- `rawText`, `rawHtml`, `rawHeaders` are immutable after initial save
- Never overwrite raw fields
- Never delete raw fields
- Raw email is source of truth

**Implementation:**
- Set raw fields only on initial create
- No UPDATE statements that modify raw fields
- Use `parsedJson` for AI-processed data
- Use `draftData` for user-edited data
- Raw fields remain unchanged

**Audit Trail:**
- Raw email preserved for debugging
- Can re-run AI processing if needed
- User can always view original email
- Compliance and audit requirements met

---

## 6. Implementation Considerations

### Shared Utilities

**Extract Common Functions:**
```typescript
// lib/inbound-email/utils.ts

export function extractCompanySlug(
  recipientAddress: string, 
  subdomain: string
): string | null {
  const pattern = new RegExp(`^([^@]+)@${subdomain}\\.(.+)$`);
  const match = recipientAddress.match(pattern);
  if (!match) return null;
  return match[1].toLowerCase().trim() || null;
}

export async function validateCompanySlug(
  slug: string
): Promise<string | null> {
  const company = await prisma.company_hqs.findUnique({
    where: { slug },
    select: { id: true }
  });
  return company?.id || null;
}

export function parseSendGridPayload(formData: FormData) {
  return {
    from: formData.get('from') as string,
    to: formData.get('to') as string,
    subject: formData.get('subject') as string,
    text: formData.get('text') as string,
    html: formData.get('html') as string,
    headers: formData.get('headers') as string,
  };
}
```

### AI Processing Differences

**CRM Channel:**
- AI normalizes email content
- Extracts: subject, body, sender info, threading
- Returns EmailActivity-compatible JSON

**TARGET Channel:**
- AI detects intent (CONTACT_CREATE, NOTE_CREATE, TEMPLATE_CREATE)
- Extracts structured data based on intent
- Returns intent-specific JSON structure

**AI Prompt Differences:**
```typescript
// CRM prompt
"You are an email normalization assistant. Extract structured data from this raw email..."

// TARGET prompt
"You are an action detection assistant. Determine the intent of this email and extract structured data:
- CONTACT_CREATE: Extract contact information
- NOTE_CREATE: Extract note content and contact reference
- TEMPLATE_CREATE: Extract template subject and body

Return JSON with 'intent' field and intent-specific data..."
```

### Status Workflow Differences

**CRM Channel:**
- `INGESTED` → `PARSED` → (final state)
- No approval workflow (logging only)

**TARGET Channel:**
- `INGESTED` → `PARSED` → `APPROVED` | `REJECTED`
- Approval workflow required
- User must review before final object creation

---

## Summary

### Architecture Decisions

1. **Schema:** Option B - New `inbound_actions` table for clear separation
2. **Endpoints:** Option B - Separate `/api/inbound-crm` and `/api/inbound-target`
3. **Routing:** Deterministic slug extraction (same pattern for both)
4. **Storage:** Raw email preserved identically in both channels
5. **AI:** Different prompts/intent detection for TARGET channel
6. **Safety:** Draft-only creation, no auto-sending, slug validation required

### Key Principles

✅ **Deterministic Routing** - Slug-based, not AI-based  
✅ **Raw Preservation** - Never modify raw email  
✅ **Draft-Only** - No automatic execution  
✅ **UI Review Required** - All actions need approval  
✅ **Clear Separation** - CRM for logging, TARGET for actions  
✅ **Always Return 200** - Accept email even if processing fails  

### Next Steps

1. Review and approve schema approach
2. Create `inbound_actions` table migration
3. Implement `/api/inbound-target` endpoint
4. Build AI intent detection service
5. Create TARGET review UI
6. Test end-to-end workflow
