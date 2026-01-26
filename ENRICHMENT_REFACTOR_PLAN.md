# Enrichment Refactor Plan - MVP1 Simplification

## Core Philosophy

**MVP1 Goal:** Get contacts with basic info. Company details come later when we need to "target every person at Diameter."

**Key Insight:** Contact ID is the primary identifier. Company metadata should be simple fields on the Contact model, not separate Company records with complex financials.

---

## Current Problems

1. **Too much complexity** - Creating/updating Company records for every contact save
2. **Wrong abstraction** - Separate Company model when we just need basic metadata
3. **Language confusion** - "Enrich" sounds complex when we just want "get contact info"
4. **Wrong flow** - Trying to do full enrichment during initial save

---

## New MVP1 Flow

### 1. LinkedIn Contact Page (Simplified)

**Page Name:** "Get Contact from LinkedIn" (not "Enrich")

**What it does:**
- User enters LinkedIn URL
- Calls Apollo to get basic contact info
- Shows: Name, Email, Title, Company Name
- **One button:** "Save Contact"
- On success: Redirect to contact detail page

**What it saves:**
- Contact fields: firstName, lastName, email, title, phone, linkedinUrl
- Simple company metadata on Contact:
  - `companyName` (string) - "Diameter"
  - `companyIndustry` (string) - "Software" 
  - `companySize` (enum: 'small' | 'medium' | 'large') - Simple size indicator
  - `positionType` (string) - "VP", "Director", "Manager", etc.

**What it does NOT do:**
- ❌ Create Company records
- ❌ Store funding amounts, revenue, headcount
- ❌ Run intelligence scoring
- ❌ Create company relationships

**Code location:**
- `app/(authenticated)/contacts/linkedin/page.jsx` (rename from `enrich/linkedin`)

---

### 2. Contact Detail Page (Full Enrichment)

**When:** User views a contact and wants full enrichment

**What it does:**
- Shows contact with basic info
- Button: "Enrich Full Profile"
- Runs full Apollo enrichment
- Shows intelligence scores, company details, etc.
- **Then** creates/updates Company record if needed

**Code location:**
- `app/(authenticated)/contacts/[id]/page.jsx` - Add enrichment button

---

## Data Model Changes

### Contact Model (Add Simple Company + Career Fields)

```prisma
model Contact {
  // ... existing fields ...
  
  // Simple company metadata (MVP1)
  companyName      String?  // "Diameter"
  companyIndustry  String?  // "Software", "Finance", etc.
  companySize      String?  // "small" | "medium" | "large" (or enum)
  positionType     String?  // "VP", "Director", "Manager", "Individual Contributor"
  
  // Career history (from enrichment)
  careerTimeline          Json?     // Array of { company, title, startDate, endDate }
  currentTenureYears      Float?    // How long at current company
  totalYearsExperience    Float?    // Total career experience
  numberOfJobChanges      Int?      // Number of job changes
  averageTenureMonths     Float?    // Average tenure across roles
  
  // Career signals (inferred)
  recentJobChange         Boolean?  // Changed jobs recently?
  recentPromotion         Boolean?  // Got promoted recently?
  careerProgression       String?  // "upward" | "lateral" | "downward"
  careerMomentum          String?  // "high" | "medium" | "low" (inferred from signals)
  whatTheyreLookingFor    String?  // Inferred: "growth", "stability", "opportunity", etc.
  
  // Keep existing company relationship for later (MVP2+)
  contactCompanyId String?  // FK to companies table (for MVP2+)
  companies        companies? @relation(fields: [contactCompanyId], references: [id])
}
```

**Why:**
- Simple fields for MVP1 - no separate Company record needed
- Can query: "Show me all contacts at large software companies"
- Can filter: "Show me all VPs"
- Later (MVP2): Can create Company records and link them

---

## Implementation Steps

### Step 1: Simplify LinkedIn Page

**File:** `app/(authenticated)/contacts/linkedin/page.jsx`

**Changes:**
1. Rename from "LinkedIn Enrich" to "Get Contact from LinkedIn"
2. Remove "Enrich Full Profile" button
3. Keep only "Save Contact" button
4. On save success: Redirect to `/contacts/[id]`

**Save logic:**
```typescript
// Step 1: Create contact with basic info
const contact = await api.post('/api/contacts', {
  crmId: companyHQId,
  firstName: enrichedProfile.firstName,
  lastName: enrichedProfile.lastName,
  email: enrichedProfile.email,
  phone: enrichedProfile.phone,
  title: enrichedProfile.title,
  linkedinUrl: url,
  // Simple company metadata
  companyName: enrichedProfile.companyName,
  companyIndustry: extractIndustry(enrichedProfile), // Simple extraction
  companySize: inferCompanySize(enrichedProfile), // Simple inference
  positionType: extractPositionType(enrichedProfile.title), // From title
});
```

---

### Step 2: Create Simple Save Route

**File:** `app/api/contacts/linkedin/save/route.ts` (new)

**Purpose:** Simple save - just contact + basic company metadata

**What it does:**
1. Validate input
2. Create/update contact with basic fields
3. Set simple company metadata fields
4. **NO Company record creation**
5. Return contact

**What it does NOT do:**
- ❌ Create Company records
- ❌ Run intelligence scoring
- ❌ Store complex enrichment payloads
- ❌ Handle company relationships

---

### Step 3: Move Full Enrichment to Contact Detail Page

**File:** `app/(authenticated)/contacts/[id]/page.jsx`

**Add:**
- "Get Full Career History" button (or "Enrich Career Profile")
- Calls `/api/contacts/[id]/enrich-career` (career-focused enrichment)
- Shows:
  - Career timeline (all previous roles)
  - Current role tenure (how long at current company)
  - Career signals (recent job change, promotion, etc.)
  - Company positioning (simple: big/small, industry, growth stage)
  - **Inferred signals:** "What they're looking for" (career momentum, stability, etc.)
- **Saves to Contact only** - no separate Company records
- **No fake scores** - focus on real career data

**What it extracts:**
- Employment history (from Apollo)
- Tenure at current company
- Career progression signals
- Company context (simple metadata, not full Company record)

---

### Step 4: Update Contact Model

**File:** `prisma/schema.prisma`

**Add fields:**
```prisma
model Contact {
  // ... existing fields ...
  
  // Simple company metadata (MVP1)
  companyName      String?
  companyIndustry  String?
  companySize      String?  // Or enum: CompanySize?
  positionType     String?
}
```

**Migration:**
- Add columns to Contact table
- No breaking changes (all nullable)

---

## Career-Focused Enrichment (Contact Detail Page)

**What we extract:**
1. **Career Timeline**
   - All previous roles (from Apollo employment_history)
   - Dates, companies, titles
   - Store as JSON on Contact: `careerTimeline`

2. **Current Role Context**
   - How long at current company (`currentTenureYears`)
   - Total years experience (`totalYearsExperience`)
   - Number of job changes (`numberOfJobChanges`)
   - Average tenure (`averageTenureMonths`)

3. **Career Signals** (inferred)
   - Recent job change? (`recentJobChange: boolean`)
   - Recent promotion? (`recentPromotion: boolean`)
   - Career progression? (`careerProgression: 'upward' | 'lateral' | 'downward'`)
   - **"What they're looking for"** inference:
     - If recent job change → "Recently moved, likely settled"
     - If long tenure + promotion → "Growth-focused, loyal"
     - If many job changes → "Opportunity-seeker"
     - If lateral moves → "Stability-focused"

4. **Company Context** (simple, on Contact)
   - Company name, industry, size (already have from basic save)
   - Company growth stage (if available from Apollo)
   - **No separate Company record needed**

**What we DON'T do:**
- ❌ Create Company records
- ❌ Fake intelligence scores (seniorityScore, buyingPowerScore, etc.)
- ❌ Complex company financials
- ❌ Company intelligence scores

**What we DO:**
- ✅ Real career data (timeline, tenure, progression)
- ✅ Inferred career signals (what they might be looking for)
- ✅ Simple company context (just metadata on Contact)

## Company Size Inference

**Simple logic:**
```typescript
function inferCompanySize(apolloData: any): 'small' | 'medium' | 'large' | null {
  const headcount = apolloData.person?.organization?.employees;
  if (!headcount) return null;
  
  if (headcount < 50) return 'small';
  if (headcount < 500) return 'medium';
  return 'large';
}
```

**No need for:**
- Exact headcount
- Revenue amounts
- Funding details
- Complex company intelligence

---

## Position Type Extraction

**Simple logic:**
```typescript
function extractPositionType(title: string | null): string | null {
  if (!title) return null;
  const lower = title.toLowerCase();
  
  if (lower.includes('vp') || lower.includes('vice president')) return 'VP';
  if (lower.includes('director')) return 'Director';
  if (lower.includes('manager')) return 'Manager';
  if (lower.includes('senior') || lower.includes('sr')) return 'Senior';
  if (lower.includes('lead') || lower.includes('principal')) return 'Lead';
  return 'Individual Contributor';
}
```

---

## Benefits

1. **Simpler flow** - Just get contact, save, done
2. **Faster saves** - No company creation/update logic
3. **Clearer language** - "Get Contact" not "Enrich"
4. **Better UX** - Save → See contact → Enrich if needed
5. **MVP1 focused** - Basic company metadata, not full company records
6. **Easier queries** - Can filter by companySize, positionType directly on Contact
7. **Future-proof** - Can add Company records later (MVP2) without breaking existing contacts

---

## Migration Path

### Phase 1: Add Fields (No Breaking Changes)
- Add `companyName`, `companyIndustry`, `companySize`, `positionType` to Contact
- All nullable, no migration issues
- Existing contacts unaffected

### Phase 2: Update LinkedIn Page
- Simplify to just "Get Contact"
- Save with basic metadata
- Remove company creation logic

### Phase 3: Move Full Enrichment
- Add enrichment button to contact detail page
- Full enrichment creates Company records (MVP2 feature)

---

## What We're NOT Doing (MVP1)

- ❌ Creating Company records (ever - save to Contact only)
- ❌ Storing funding amounts, revenue, headcount
- ❌ Fake intelligence scores (seniorityScore, buyingPowerScore, etc.)
- ❌ Complex company relationship management
- ❌ Company domain uniqueness handling
- ❌ Company enrichment during contact save
- ❌ Complex company intelligence scoring

---

## What We ARE Doing (MVP1)

- ✅ Simple contact save with basic info
- ✅ Basic company metadata on Contact (name, industry, size, position)
- ✅ Clear language: "Get Contact" not "Enrich"
- ✅ Fast, simple save flow
- ✅ Career-focused enrichment on contact detail page:
  - Career timeline (all previous roles)
  - Current role tenure
  - Career signals (what they're looking for)
  - Simple company context (no separate Company records)
- ✅ Real data only - no fake scores

---

## Files to Create/Modify

### New Files
- `app/api/contacts/linkedin/save/route.ts` - Simple save route
- `app/api/contacts/[id]/enrich-career/route.ts` - Career-focused enrichment (no Company records)

### Modify Files
- `app/(authenticated)/contacts/linkedin/page.jsx` - Simplify to "Get Contact"
- `app/(authenticated)/contacts/[id]/page.jsx` - Add "Get Full Career History" button
- `prisma/schema.prisma` - Add company metadata fields + career fields to Contact
- `lib/apollo.ts` - Add simple extraction functions (inferCompanySize, extractPositionType, extractCareerSignals)

### Remove/Deprecate
- `app/api/contacts/enrich/save/route.ts` - Replace with career-focused route
- Company creation logic (save to Contact only)
- Intelligence scoring (fake scores - remove)

---

## Career Signal Inference Logic

**"What They're Looking For" Inference:**

```typescript
function inferWhatTheyreLookingFor(contact: Contact): string | null {
  // Recent job change (< 6 months)
  if (contact.recentJobChange && contact.currentTenureYears < 0.5) {
    return "stability"; // Just moved, likely settled
  }
  
  // Long tenure + promotion
  if (contact.currentTenureYears > 3 && contact.recentPromotion) {
    return "growth"; // Growing within company
  }
  
  // Many job changes
  if (contact.numberOfJobChanges > 5) {
    return "opportunity"; // Always looking for next thing
  }
  
  // Short average tenure
  if (contact.averageTenureMonths < 18) {
    return "opportunity"; // Moves frequently
  }
  
  // Long average tenure
  if (contact.averageTenureMonths > 36) {
    return "stability"; // Stays put
  }
  
  // Upward career progression
  if (contact.careerProgression === "upward") {
    return "growth"; // Climbing ladder
  }
  
  return null; // Can't infer
}
```

**Career Momentum:**

```typescript
function inferCareerMomentum(contact: Contact): "high" | "medium" | "low" | null {
  let score = 0;
  
  if (contact.recentPromotion) score += 2;
  if (contact.recentJobChange) score += 1;
  if (contact.careerProgression === "upward") score += 2;
  if (contact.careerProgression === "lateral") score += 1;
  if (contact.currentTenureYears < 2) score += 1; // Recent move
  
  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  if (score > 0) return "low";
  return null;
}
```

---

## Next Steps

1. ✅ Document plan (this file)
2. ⏳ Add Contact model fields (company + career fields)
3. ⏳ Create simple LinkedIn save route
4. ⏳ Simplify LinkedIn page UI
5. ⏳ Create career-focused enrichment route (`/api/contacts/[id]/enrich-career`)
6. ⏳ Add "Get Full Career History" button to contact detail page
7. ⏳ Add career signal inference logic
8. ⏳ Test basic flow: Get contact → Save → View → Get Career History

