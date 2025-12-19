# ContactCandidate Forensic Audit

**Date:** 2025-01-27  
**Purpose:** Identify prior implementations equivalent to ContactCandidate (temporary contact preview/selection before persistence)

---

## Summary

**Finding:** No exact ContactCandidate equivalent exists. However, there are **three distinct patterns** for temporary contact data:

1. **Enrichment Preview Pattern** (Apollo/LinkedIn) - Redis-based, single contact preview
2. **ProspectCandidate Pattern** (CSV) - Database-based, batch processing
3. **Client-Side Selection Pattern** (Microsoft/CSV enrich pages) - In-memory, user selection

**Verdict:** None match ContactCandidate exactly. ContactCandidate is a new pattern for Microsoft message-based contact signals.

---

## Pattern 1: Enrichment Preview (Apollo/LinkedIn)

### What It's Called
- **Object Name:** `previewData`, `intelligenceData`, `normalizedContact`
- **Storage:** Redis (Upstash)
- **Keys:** `preview:${timestamp}:${random}` and `apollo:${previewId}`

### Where It's Stored
**Redis (Upstash)** with 7-day TTL

**Files:**
- `lib/redis.ts` - Redis helper functions
- `app/api/contacts/enrich/generate-intel/route.ts` - Creates preview
- `app/api/contacts/enrich/intelligence/route.ts` - Retrieves preview
- `app/api/contacts/enrich/raw/route.ts` - Gets raw JSON

### What Fields It Contains

**Preview Data Structure (from `generate-intel/route.ts`):**
```typescript
{
  previewId: string,              // "preview:123:abc"
  redisKey: string,                // "apollo:preview:123:abc"
  linkedinUrl: string | null,
  email: string | null,
  contactId: string | null,
  normalizedContact: {
    firstName, lastName, email, phone, title,
    seniority, department, jobRole, linkedinUrl,
    city, state, country, timezone,
    currentRoleStartDate, totalYearsExperience,
    numberOfJobChanges, averageTenureMonths,
    careerProgression, recentJobChange, recentPromotion,
    companyName, companyDomain, companySize, companyIndustry
  },
  normalizedCompany: {
    companyName, domain, website, industry,
    headcount, revenue, revenueRange, growthRate,
    fundingStage, lastFundingDate, lastFundingAmount,
    numberOfFundingRounds
  },
  intelligenceScores: {
    seniorityScore, buyingPowerScore, urgencyScore,
    rolePowerScore, buyerLikelihoodScore, readinessToBuyScore,
    careerMomentumScore, careerStabilityScore
  },
  companyIntelligence: {
    companyHealthScore, growthScore, stabilityScore,
    marketPositionScore, readinessScore
  },
  // Inference layer
  profileSummary: string,
  tenureYears: number,
  currentTenureYears: number,
  totalExperienceYears: number,
  avgTenureYears: number,
  careerTimeline: any,
  companyPositioning: {...}
}
```

### User Selection/Approval
**✅ Yes** - Users can preview and approve before saving

**Flow:**
1. User enters LinkedIn URL
2. Preview shown (basic info)
3. User clicks "Generate Intelligence"
4. Full preview with scores shown
5. User clicks "Save to CRM"
6. Data persisted to database

**Files:**
- `app/(authenticated)/contacts/enrich/linkedin/page.jsx` - UI with preview/approve flow

### Matches ContactCandidate?
**❌ No** - This is **enrichment-only** (adds data to existing/known contacts), not contact discovery from inbox signals.

---

## Pattern 2: ProspectCandidate (CSV)

### What It's Called
- **Object Name:** `ProspectCandidate` (Prisma model)
- **Storage:** Database (Prisma)
- **Table:** `prospect_candidates`

### Where It's Stored
**Database (Prisma)** - Persistent storage

**Schema:**
```prisma
model prospect_candidates {
  id          String   @id
  userId      String
  firstName   String
  lastName    String
  companyName String
  domain      String?
  status      String   // 'pending', 'processing', 'completed', 'failed'
  createdAt   DateTime @default(now())
  updatedAt   DateTime
}
```

**Files:**
- `app/api/enqueue-csv/route.js` - Creates ProspectCandidate records
- `prisma/schema.prisma` - Model definition

### What Fields It Contains
```typescript
{
  id: string,
  userId: string,
  firstName: string,
  lastName: string,
  companyName: string,
  domain: string | null,
  status: 'pending' | 'processing' | 'completed' | 'failed'
}
```

### User Selection/Approval
**❌ No** - Batch processing, no user selection. CSV upload → auto-enqueue → background processing.

**Flow:**
1. User uploads CSV
2. ProspectCandidate records created in DB
3. Enqueued to Redis (currently disabled)
4. Background job processes them
5. Contacts created automatically

### Matches ContactCandidate?
**❌ No** - This is **database-persisted** and **batch-processed**, not a preview/selection pattern.

---

## Pattern 3: Client-Side Selection (Microsoft/CSV Enrich Pages)

**Note:** This was Microsoft's **original implementation approach** - storing contacts in React component state (browser memory). However, we've now discovered Redis (like Apollo uses), so ContactCandidate should use the Redis preview pattern instead.

### What It's Called
- **Object Name:** `contacts` (array), `selected` (Set)
- **Storage:** React component state (in-memory, browser-only) - **ORIGINAL APPROACH**
- **No persistence** - lost on page refresh

### Where It's Stored
**Browser memory** (React useState) - No server-side storage

**Files:**
- `app/(authenticated)/contacts/enrich/microsoft/page.jsx` - Microsoft contacts selection (original React state approach)
- `app/(authenticated)/contacts/enrich/csv/page.jsx` - CSV contacts selection

### What Fields It Contains

**Microsoft Enrich Page:**
```typescript
// Parsed from Microsoft Graph contacts API
{
  email: string,
  firstName: string,
  lastName: string,
  company: string,
  title: string,
  id: null  // Will be found by email during enrichment
}
```

**CSV Enrich Page:**
```typescript
// Parsed from CSV
{
  email: string,
  id: null  // Will be found by email during enrichment
}
```

### User Selection/Approval
**✅ Yes** - Users can select contacts before enrichment

**Flow:**
1. User fetches contacts (Microsoft Graph or CSV)
2. Contacts displayed in list
3. User selects contacts (checkboxes)
4. User clicks "Enrich Selected"
5. Enrichment happens (currently shows "coming soon")

**Selection State:**
- Stored in `useState(new Set())` - Set of email addresses or contact IDs
- No persistence - lost on page refresh

### Matches ContactCandidate?
**❌ No** - This was Microsoft's original React state approach, but we should use Redis preview pattern instead:
- **Different source:** Contacts API (`/me/contacts`), not messages (`/me/messages`)
- **Different purpose:** Enrichment (add data to existing contacts), not discovery (find new contacts)
- **Wrong storage:** Pure client-side (React state) - **Should use Redis like Apollo preview pattern**
- **Architecture:** Client-side only - **Should be server-side Redis storage**

---

## Redis Usage Summary

### Redis Keys Found

1. **Enrichment Data:**
   - `apollo:enriched:${linkedinUrl}` - Single enrichment by LinkedIn URL
   - `apollo:contact:${contactId}:${timestamp}` - Enrichment by contact ID
   - `apollo:${previewId}` - Raw Apollo JSON payload

2. **Preview Intelligence:**
   - `preview:${timestamp}:${random}` - Normalized + intelligence scores

3. **Content Drafts:**
   - `presentation:outline:${timestamp}` - Presentation outlines
   - `blog:draft:${timestamp}` - Blog drafts

4. **TTL:** 7 days for enrichment, 1 hour for content drafts

### Redis Functions

**From `lib/redis.ts`:**
- `storeEnrichedContact(linkedinUrl, enrichedData, ttl)` - Store by LinkedIn URL
- `storeEnrichedContactByContactId(contactId, rawPayload, ttl)` - Store by contact ID
- `getEnrichedContactByKey(redisKey)` - Get by full Redis key
- `getPreviewIntelligence(previewId)` - Get preview data
- `getEnrichedContact(keyOrLinkedInUrl)` - Get by key or LinkedIn URL

---

## JSON Blob Storage

### Database JSON Fields

**Contact Model:**
- `enrichmentPayload` (Json?) - Full enrichment response (Apollo)
- **Note:** `enrichmentRedisKey` (String?) - Reference to Redis key

**Storage Pattern:**
- **Redis:** Raw Apollo JSON payload (temporary, 7 days)
- **Database:** `enrichmentRedisKey` reference (permanent)
- **Database:** `enrichmentPayload` JSON (if stored directly, not always used)

---

## Temporary Contact Lists

### Found Patterns

1. **Microsoft Enrich Page** (`/contacts/enrich/microsoft`)
   - Fetches contacts from Graph API
   - Stores in component state: `const [contacts, setContacts] = useState([])`
   - Selection: `const [selected, setSelected] = useState(new Set())`
   - **No persistence** - lost on refresh

2. **CSV Enrich Page** (`/contacts/enrich/csv`)
   - Parses CSV file
   - Stores in component state: `const [contacts, setContacts] = useState([])`
   - Selection: `const [selected, setSelected] = useState(new Set())`
   - **No persistence** - lost on refresh

3. **LinkedIn Enrich Page** (`/contacts/enrich/linkedin`)
   - Single contact preview (not a list)
   - Stores preview in component state
   - **No persistence** - but uses Redis for server-side preview data

---

## Comparison to ContactCandidate

### ContactCandidate Type (Mental Model)
```typescript
type ContactCandidate = {
  email: string
  displayName: string
  domain: string
  lastSeenAt: string
  messageCount: number
}
```

**Note:** "ContactCandidate" is the **type/mental model**. In code, use descriptive names:
- **Microsoft:** `outlookContact` or `microsoftContact` (following `{source}Contact` pattern)
- **Apollo/LinkedIn:** `normalizedContact` (existing pattern - see `generate-intel/route.ts`)
- **Pattern:** Use source-specific names in code, ContactCandidate as the type definition

### Pattern Comparison

| Pattern | Source | Storage | Selection | Purpose | Matches? |
|---------|--------|--------|----------|---------|----------|
| **Enrichment Preview** | Apollo API | Redis | ✅ Single preview | Enrich known contact | ❌ No - enrichment only |
| **ProspectCandidate** | CSV upload | Database | ❌ Batch | Background processing | ❌ No - persisted, no preview |
| **Client Selection** | Graph/CSV | Memory | ✅ Multi-select | Enrich existing | ⚠️ Partial - wrong source |
| **ContactCandidate** | Messages | **NEW** | ✅ Preview list | Discover contacts | ✅ **NEW PATTERN** |

---

## Files Relevant to ContactCandidate

### ✅ Reusable Patterns

1. **Redis Storage Pattern**
   - `lib/redis.ts` - Can reuse Redis helper functions
   - Pattern: Store temporary data with TTL, retrieve by key

2. **Preview/Selection UI Pattern**
   - `app/(authenticated)/contacts/enrich/microsoft/page.jsx` - Similar UI pattern
   - Pattern: Fetch → Display list → Select → Action

3. **API Preview Endpoint Pattern**
   - `app/api/contacts/enrich/preview/route.ts` - Preview without saving
   - Pattern: Return data, no database writes

### ❌ Not Relevant

1. **Enrichment Save Flow**
   - `app/api/contacts/enrich/save/route.ts` - Persists to database
   - **Out of scope** - ContactCandidate should NOT persist

2. **ProspectCandidate Model**
   - `prisma/schema.prisma` - Database model
   - **Out of scope** - ContactCandidate is preview-only

3. **Intelligence Generation**
   - `app/api/contacts/enrich/generate-intel/route.ts` - Complex scoring
   - **Out of scope** - ContactCandidate is simple signal extraction

---

## Recommendations

### For ContactCandidate Implementation

**Key Insight:** Use Apollo's Redis preview pattern, but transform Microsoft message data to ContactCandidate format.

1. **Storage:** Use Redis pattern (like Apollo enrichment preview)
   - Key: `microsoft:preview:${ownerId}:${timestamp}` (similar to `apollo:preview:${previewId}`)
   - Preview ID: `preview:microsoft:${timestamp}:${random}` (similar to Apollo's `preview:${timestamp}:${random}`)
   - TTL: 1 hour (shorter than enrichment - just for preview session)
   - Structure: Array of ContactCandidate objects

2. **API Pattern:** Follow `/api/contacts/enrich/generate-intel` pattern
   - Endpoint: `/api/microsoft/contacts/preview`
   - Fetch messages from Graph API
   - Transform to ContactCandidate format
   - Store in Redis under previewId
   - Return: `{ previewId, redisKey, contactCandidates: [...] }`
   - No database writes

3. **Data Transformation:** Match Microsoft's message response format
   - Source: `GET /v1.0/me/messages?$select=from,receivedDateTime&$top=25`
   - Transform: Group by email, count messages, extract domain
   - Output: ContactCandidate array

4. **UI Pattern:** Follow Apollo enrichment preview pattern
   - Fetch → Store in Redis → Display preview → (Future: Select → Action)
   - Retrieve preview by previewId (like Apollo does)

5. **Do NOT:**
   - Use React state only (Microsoft's original approach - too limited)
   - Use ProspectCandidate model (database persistence)
   - Use enrichment save flow (database writes)

---

## Conclusion

**No existing ContactCandidate equivalent found.**

**Closest patterns:**
- **Enrichment Preview** - Redis-based preview, but enrichment-focused
- **Client Selection** - Multi-select UI (Microsoft's original approach), but wrong data source (contacts API vs messages)

**ContactCandidate pattern:**
- Message-based contact discovery (not enrichment)
- Simple signal extraction (not complex scoring)
- Preview-only (not persistence)
- **Redis storage** (like Apollo preview pattern, not React state)
- **Transform Microsoft messages** to ContactCandidate format

**Safe to ignore:**
- ProspectCandidate (database model, batch processing)
- Enrichment save flows (database persistence)
- Intelligence generation (complex scoring)
- Lusha integration (deprecated)

**Microsoft's Original Approach (React State):**
- The Microsoft enrich page (`/contacts/enrich/microsoft`) uses **client-side only** storage (React state)
- This was the original implementation - fetch contacts, store in browser memory, select, enrich
- **Problem:** Data lost on page refresh, no server-side persistence

**New Approach (Redis Preview - Like Apollo):**
- **For ContactCandidate:** Use **server-side Redis storage** (like Apollo enrichment preview pattern)
- Fetch messages → Transform to ContactCandidate → Store in Redis → Return previewId
- User can retrieve preview by previewId (like Apollo does)
- Matches Apollo's proven pattern, but with Microsoft message data
