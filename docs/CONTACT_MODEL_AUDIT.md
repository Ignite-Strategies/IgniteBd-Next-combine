# Contact Model Audit: Structured Outreach Inference Support

**Date:** February 11, 2026  
**Purpose:** Determine whether Contact entity supports structured outreach inference without GPT dependency

---

## 1. Current Contact Schema Summary

### Core Identity Fields
- `id` (String, @id)
- `crmId` (String) - Links to company_hqs
- `firstName`, `lastName`, `fullName`, `goesBy` (String?)
- `email` (String?, indexed)
- `phone` (String?)
- `firebaseUid` (String?, unique)

### Professional Information
- `title` (String?)
- `seniority` (String?)
- `department` (String?)
- `jobRole` (String?)
- `positionType` (String?) - "VP", "Director", "Manager", etc.
- `linkedinUrl` (String?)

### Company Context
- `companyName` (String?)
- `companyDomain` (String?, indexed)
- `companyId` (String?, indexed) - FK to companies
- `companyIndustry` (String?)
- `companySize` (String?)
- `contactCompanyId` (String?) - FK to companies

### Location
- `city`, `state`, `country` (String?)
- `timezone` (String?)

### Relationship Context
- `howMet` (String?) - Free-text field
- `role` (String, default: "contact") - Indexed
- `ownerId` (String?, indexed) - FK to owners

### Notes & Metadata
- `notes` (String?) - **Free-text blob on Contact**
- `profileSummary` (String?)
- `enrichmentSource` (String?)
- `enrichmentFetchedAt` (DateTime?)
- `enrichmentPayload` (Json?)

### Career Signals
- `careerMomentum` (String?) - "high" | "medium" | "low"
- `careerProgression` (String?)
- `careerTimeline` (Json?)
- `recentJobChange` (Boolean?)
- `recentPromotion` (Boolean?)
- `numberOfJobChanges` (Int?)
- `currentRoleStartDate` (DateTime?)
- `currentTenureYears` (Float?)
- `averageTenureMonths` (Float?)
- `avgTenureYears` (Float?)
- `tenureYears` (Int?)
- `totalExperienceYears` (Float?)
- `totalYearsExperience` (Float?)
- `whatTheyreLookingFor` (String?) - Inferred: "growth", "stability", "opportunity"

### Buying Power & Decision Making
- `budgetAuthority` (Boolean?)
- `decisionMaker` (Boolean?)
- `gatekeeper` (Boolean?)
- `influencer` (Boolean?)
- `buyingPowerScore` (Int?)
- `rolePowerScore` (Int?)
- `seniorityScore` (Int?)

### Buying Readiness & Triggers
- `buyerLikelihoodScore` (Int?)
- `readinessToBuyScore` (Int?)
- `urgencyScore` (Int?)
- `buyingTriggers` (String[])

### Goals & Pain Points
- `goals` (String[])
- `painPoints` (String[])

### Enums Currently Used
- `buyingReadiness` (BuyingReadiness enum)
  - NOT_READY
  - READY_NO_MONEY
  - READY_WITH_MONEY
- `buyerPerson` (BuyerPerson enum)
  - BUSINESS_OWNER
  - DIRECTOR_VP
  - PRODUCT_USER

### Relations
- `company_hqs_company_hqs_contactOwnerIdTocontacts` → company_hqs[] (many-to-many)
- `consultant_deliverables` → consultant_deliverables[]
- `companies` → companies? (one-to-many)
- `contact_lists` → contact_lists? (many-to-one)
- `company_hqs_contacts_crmIdTocompany_hqs` → company_hqs (many-to-one)
- `invoices` → invoices[]
- `invite_tokens` → invite_tokens[]
- `pipelines` → pipelines? (one-to-one)
- `proposals` → proposals[]
- `work_packages_workPackages_workPackageClientIdTocontacts` → work_packages[]
- `work_packages_workPackages_workPackageMemberIdTocontacts` → work_packages[]
- `contact_analyses` → contact_analyses? (one-to-one)

---

## 2. Gap Analysis: Required Fields for Structured Outreach

### ✅ Fields That Exist (or Close Proxies)

| Required Field | Current Status | Notes |
|---------------|---------------|-------|
| `buyer_power` | ✅ **EXISTS** | `buyingPowerScore` (Int) + `buyerPerson` (enum) |
| `role` | ✅ **EXISTS** | `role` (String, default: "contact") + `title` + `positionType` |

### ❌ Fields That Do NOT Exist

| Required Field | Status | Impact |
|---------------|--------|--------|
| `persona_type` | ❌ **MISSING** | Cannot categorize contact by persona archetype |
| `prior_relationship` | ❌ **MISSING** | Cannot determine relationship warmth (cold/warm/established) |
| `approached_before` | ❌ **MISSING** | Cannot track if contact has been contacted previously |
| `last_outreach_date` | ❌ **MISSING** | Cannot determine recency of outreach |
| `outreach_status` | ❌ **MISSING** | Cannot track current outreach state |

### ⚠️ Partial/Inferred Fields

| Field | Current State | Gap |
|-------|--------------|-----|
| Relationship context | `howMet` (free-text) | No structured enum for relationship type |
| Outreach history | `email_activities` model exists but no direct relation | Can query but not easily accessible |

---

## 3. Notes Storage Analysis

**Current Implementation:**
- Notes are stored as **free-text blob** directly on Contact model (`notes` String? field)
- No separate Note model exists
- No JSON metadata structure for notes
- No external sync field for notes

**Implications:**
- ✅ Simple to query (single field)
- ❌ No structured note types or categories
- ❌ No note timestamps or history
- ❌ No note-to-outreach linkage

---

## 4. Outreach Tracking Analysis

**Current State:**
- `email_activities` model exists with `contact_id` field
- **NO direct relation** from Contact → email_activities
- Can query outreach history via `contact_id` join, but not easily accessible
- No `last_outreach_date` field on Contact for quick access
- No `outreach_status` enum to track current state

**Gap:**
- Cannot deterministically select templates without:
  1. Querying email_activities separately
  2. Inferring relationship warmth from free-text `howMet`
  3. Inferring persona type from other fields

---

## 5. Template Selection Support Evaluation

### Current Capabilities ✅
- Can determine buying power via `buyingPowerScore` + `buyerPerson`
- Can determine role via `role` + `title` + `positionType`
- Can determine readiness via `buyingReadiness` enum
- Can determine urgency via `urgencyScore`

### Missing Capabilities ❌
- **Cannot determine relationship type** (cold/warm/established) without GPT inference
- **Cannot determine if previously contacted** without querying email_activities
- **Cannot determine persona archetype** without GPT inference
- **Cannot determine outreach recency** without querying email_activities

### Deterministic Template Selection: **PARTIALLY SUPPORTED**

**Can select templates based on:**
- Buying power (buyingPowerScore, buyerPerson)
- Role (role, title, positionType)
- Readiness (buyingReadiness)
- Urgency (urgencyScore)

**Cannot select templates without GPT/inference for:**
- Relationship warmth (prior_relationship)
- Persona type
- Outreach history (approached_before, last_outreach_date)
- Current outreach status

---

## 6. Recommended Minimal Schema Additions

### Required Enums

```prisma
enum PersonaType {
  DECISION_MAKER
  INFLUENCER
  END_USER
  GATEKEEPER
  CHAMPION
  OTHER
}

enum PriorRelationship {
  COLD        // No prior relationship
  WARM        // Met before, some familiarity
  ESTABLISHED // Strong existing relationship
  DORMANT     // Had relationship, gone quiet
}

enum OutreachStatus {
  NOT_CONTACTED
  INITIAL_OUTREACH
  FOLLOW_UP
  ENGAGED
  RESPONDED
  MEETING_SCHEDULED
  CLOSED_WON
  CLOSED_LOST
  DO_NOT_CONTACT
}
```

### Required Fields on Contact Model

```prisma
model Contact {
  // ... existing fields ...

  // NEW: Persona classification
  persona_type PersonaType?

  // NEW: Relationship context
  prior_relationship PriorRelationship?
  
  approached_before Boolean @default(false)

  // NEW: Outreach tracking
  last_outreach_date DateTime?
  outreach_status OutreachStatus @default(NOT_CONTACTED)

  // ... rest of fields ...
}
```

### Optional: Outreach History Relation

```prisma
model Contact {
  // ... existing fields ...
  
  email_activities email_activities[] @relation("ContactEmailActivities")
}

model email_activities {
  // ... existing fields ...
  contacts Contact? @relation("ContactEmailActivities", fields: [contact_id], references: [id])
}
```

---

## 7. Backward-Compatible Migration Approach

### Phase 1: Add Fields (All Optional)
1. Add enums (no breaking changes)
2. Add fields as optional (`?`) with defaults where appropriate
3. Run migration: `npx prisma migrate dev --name add_outreach_fields`

### Phase 2: Data Population (Optional)
1. Create script to infer `prior_relationship` from `howMet` field
2. Query `email_activities` to populate `last_outreach_date` and `approached_before`
3. Set `outreach_status` based on email activity history
4. Infer `persona_type` from existing `buyerPerson` + `title` + `decisionMaker` fields

### Phase 3: Add Relation (Optional)
1. Add relation from Contact → email_activities
2. Update queries to use relation instead of manual joins

### Migration Safety
- ✅ All new fields are optional
- ✅ No existing data affected
- ✅ Can populate incrementally
- ✅ No breaking changes to existing queries

---

## 8. Summary & Recommendations

### Current State
- **Contact model is rich** with buying power, readiness, and role signals
- **Missing structured relationship context** (prior_relationship, approached_before)
- **Missing outreach tracking fields** (last_outreach_date, outreach_status)
- **Missing persona classification** (persona_type)
- **Notes are free-text** (no structure)

### Minimal Additions Required
1. **3 enums:** PersonaType, PriorRelationship, OutreachStatus
2. **5 fields:** persona_type, prior_relationship, approached_before, last_outreach_date, outreach_status
3. **Optional:** Add relation to email_activities for easier querying

### Template Selection Support
- **With additions:** ✅ **FULLY SUPPORTED** - Can deterministically select templates based on:
  - Persona type
  - Relationship warmth
  - Outreach history
  - Buying power
  - Role
  - Readiness
  - Urgency

- **Without additions:** ⚠️ **PARTIALLY SUPPORTED** - Requires GPT inference for:
  - Relationship warmth
  - Persona type
  - Outreach history

### Next Steps
1. ✅ Review and approve enum definitions
2. ✅ Add fields to schema (all optional)
3. ✅ Create migration
4. ⚠️ Create data population script (optional, can be done incrementally)
5. ⚠️ Update template selection logic to use new fields

---

## Appendix: Related Models

### email_activities
- Tracks email outreach events
- Has `contact_id` but no direct relation to Contact
- Contains: `event`, `subject`, `body`, `createdAt`
- Can be queried to determine outreach history

### contact_analyses
- One-to-one with Contact
- Contains AI-generated analysis: `recommendedTalkTrack`, `recommendedSequence`
- Not suitable for deterministic template selection (requires GPT)

### template_relationship_helpers
- Stores relationship context for templates
- Fields: `relationshipType`, `familiarityLevel`, `whyReachingOut`
- Not linked to Contact (owner-scoped)
