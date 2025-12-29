# Persona Generator Service Refactor Plan

## Core Principle

**Personas are a THINKING TOOL to help clients understand who they're targeting.**

This is NOT:
- ❌ Contact matching
- ❌ Outreach targeting  
- ❌ Complex scoring system
- ❌ Data model for automation

This IS:
- ✅ A starting point for planning
- ✅ A brainstorming tool
- ✅ Help client think through: "Who am I selling to?"

**Keep it SIMPLE. We're way overthinking this.**

### What We Actually Need:
1. **Who is this dude?** - Basic person info (title, role, seniority)
2. **What the company wants** - What they want from US/OUR PRODUCT
3. **Who the company is** - Company info so we can create a cross-section/segment

**That's it.** No complex BD intel scoring. No over-engineered analysis. Just the basics.

### Important Distinction:
- **ProductId as Input**: Service uses productId to generate persona (required context)
- **ProductId as Foreign Key**: Personas table does NOT store productId (use product_fits instead)
- **Why**: One persona might fit multiple products. product_fits table handles the many-to-one relationship.

## Current Problems

1. ❌ **Silent failures** - Persona creation breaks when productId missing, no helpful error
2. ❌ **No product requirement** - Service needs product context but doesn't validate it
3. ❌ **BD Intel is in the wrong place** - It's linked to personas but should be for contacts
   - BD intel is meant for REAL contacts (meeting prep), not hypothetical personas
   - Currently: `bd_intels.personaId` ❌ Wrong
   - Should be: `contact_analyses.contactId` ✅ Correct
   - Recommendation: **MIGRATE to ContactAnalysis** - separate model/service for contacts
   - Personas = Planning tool (hypothetical)
   - Contact Analysis = Real person prep ("How do I speak with this dude?")
4. ❌ **Scattered services** - Multiple services doing similar things
5. ❌ **No edit flow** - Unlike templates, personas don't have edit → save pattern
6. ❌ **Missing error handling** - Page breaks instead of showing helpful errors

## What We Actually Need (FINAL SIMPLE LIST)

**It's a thinking tool. Just help them think through 3 things:**

1. **Who is this person?**
   - `personName` - Name/archetype (e.g., "Enterprise CMO")
   - `title` - Role (e.g., "Chief Marketing Officer")
   - `seniority` - Optional

2. **What do they want?** (from us/our product)
   - `whatTheyWant` - What they want from OUR PRODUCT (main field)
   - `painPoints` - What problems do they have? (helps client think)

3. **What company are they at?** (so client can visualize target segment)
   - `industry` - Industry type
   - `companySize` - Size range
   - `company` - Company type/archetype

**That's it. Simple fields. Easy to display. Helps client think through targeting.**

**Total: 7-8 fields. No more.**

**Note on Blending:**
- Original had `core_goals` (general) + `value_prop` (what we provide)
- We're keeping `coreGoals` for general context
- `whatTheyWant` becomes product-specific (because prompt includes product context)
- This way we get both: general goals + product-specific wants

## Current Services Audit

### 1. EnrichmentToPersonaService
**Location**: `lib/services/EnrichmentToPersonaService.ts`

**What it does**:
- Takes enriched contact data (Apollo/Redis)
- Fetches CompanyHQ
- Calls OpenAI to generate persona JSON
- Saves persona to DB (if mode: "save")
- Does NOT create product_fits
- Does NOT require productId

**Return JSON Structure**:
```typescript
{
  personName: string
  title: string
  headline: string | null
  seniority: string | null
  industry: string | null
  subIndustries: string[]
  company: string | null
  companySize: string | null
  annualRevenue: string | null
  location: string | null
  description: string | null
  whatTheyWant: string | null  // ⚠️ This is what they want from us
  painPoints: string[]
  risks: string[]
  decisionDrivers: string[]
  buyerTriggers: string[]
}
```

**Model in DB**: `personas` table matches this structure

**Issues**:
- No productId in generation
- No product context in prompt
- No product fit analysis
- Returns data but doesn't ensure productId

### 2. PersonaGenerationService (OLD)
**Location**: `lib/services/PersonaGenerationService.js`

**What it does**:
- Older service
- Takes companyHQId and optional productId
- Different JSON structure:
  ```javascript
  {
    persona_name: string
    ideal_roles: string[]
    core_goals: string[]
    pain_points: string[]
    value_prop: string
    impact_statement: string
  }
  ```
- Returns different structure than current schema

**Status**: ❌ OUTDATED - uses old schema fields

### 3. Product Fit Endpoint
**Location**: `app/api/personas/[personaId]/product-fit/route.ts`

**What it does**:
- Takes personaId
- Fetches all products for tenant
- Calls OpenAI to match persona → best product
- Creates/updates `product_fits` table
- Returns:
  ```typescript
  {
    id: string
    personaId: string
    productId: string
    valuePropToThem: string
    alignmentReasoning: string
  }
  ```

**Issues**:
- Separate step (not automatic)
- Requires products to exist
- No fallback if no products

### 4. BD Intel Endpoint
**Location**: `app/api/personas/[personaId]/bd-intel/route.ts`

**What it does**:
- Requires product_fits to exist
- Generates complex BD intelligence scores (5 different scores 0-100)
- Creates recommendations (talk track, sequence, lead source)
- Creates `bd_intels` record

**Issues**:
- Way too complex for a thinking tool
- Generates scores nobody needs
- Separate step
- Depends on product_fits existing
- **Recommendation: BLOW IT UP** - personas don't need complex scoring

**What we're doing:**
- Remove BD intel from personas entirely
- Migrate to `contact_analyses` model (linked to contacts, not personas)
- Create `ContactAnalysisService` for real contact meeting prep
- Personas stay simple (thinking tool only)
- Contact Analysis is separate concern (real person prep)

## Template Builder Pattern (Reference)

**Location**: `app/(authenticated)/builder/template/[templateId]/page.jsx`

**Flow**:
1. Generate/Hydrate → Call API, get JSON back
2. User edits → Form fields populated with JSON data
3. Save → User clicks save, sends to API
4. Redirect → To edit view or list

**Key Pattern**:
- Generate endpoint returns JSON (doesn't save)
- User can edit before saving
- Save endpoint persists to DB

## Proposed Architecture

### New PersonaGeneratorService

**Location**: `lib/services/PersonaGeneratorService.ts`

**Purpose**: Single service that orchestrates all persona generation

**Flow**:
```
Input:
- contactId (optional) OR redisKey (optional) OR description (optional)
- companyHQId (required)
- productId (required) OR productDescription (optional fallback)
- mode: "hydrate" | "save"

Process:
1. Validate productId exists OR productDescription provided
2. Fetch product (if productId) OR use description as context
3. Fetch contact/enrichment data (if contactId/redisKey)
4. Fetch CompanyHQ
5. Call OpenAI with:
   - Contact/enrichment data
   - CompanyHQ context
   - Product context (REQUIRED - used for generation, not stored)
6. Generate persona JSON (simple - who, what they want, company)
7. Return JSON (if hydrate) OR save (if save)
   - Just save the persona record
   - No product_fits, no bd_intels (too complex)

Output:
{
  persona: PersonaJSON
  productFit: ProductFitJSON  // Auto-generated
  bdIntel: BdIntelJSON        // Auto-generated
}
```

**Return JSON Structure (FINAL - REFINED)**:
```typescript
interface PersonaGeneratorResult {
  success: boolean
  persona: {
    // WHO IS THIS PERSON (more role info)
    personName: string           // Required
    title: string                // Required
    role: string | null          // Additional role context
    seniority: string | null
    
    // WHAT DO THEY WANT (refactored - more like original)
    coreGoal: string             // Required - Their north star (regardless of our product)
    painPoints: string[]         // Array - What problems do they have?
    needForOurProduct: string    // Required - Need for OUR PRODUCT assessment (inferred - key!)
    potentialPitch: string       // Optional - How we would pitch (inferred)
    
    // WHAT COMPANY ARE THEY AT (standard)
    industry: string | null
    companySize: string | null
    company: string | null       // Company type/archetype
  }
  error?: string
}
```

**Field Structure:**
- **Who**: personName, title, role, seniority
- **What They Want**: coreGoal (north star), painPoints, needForOurProduct (inferred - key!), potentialPitch (inferred)
- **Company**: industry, companySize, company

**Key Fields Explained:**
- `coreGoal` = Their north star/goal regardless of our product (general)
- `needForOurProduct` = What they need from OUR product specifically (inferred - this is the key field!)
- `potentialPitch` = How we'd pitch to them (inferred from pain points + needs)
- `painPoints` = Problems they have (from original - good field)

**Schema Changes Needed:**
- Add: `coreGoal: String`, `needForOurProduct: String`, `potentialPitch: String`, `role: String?`
- Or temporarily repurpose existing fields

**Key Changes**:
1. ✅ **KEEP IT SIMPLE** - Just the basics: who, what they want, company info
2. ✅ ProductId is REQUIRED as **input context** (or productDescription as fallback)
   - Service uses it for generation prompts
   - But persona record doesn't store it
3. ✅ Single service orchestrates generation
4. ✅ Product context included in OpenAI prompt (so we know what they want from OUR product)
5. ✅ "whatTheyWant" is explicitly about OUR PRODUCT
6. ✅ No complex BD intel scoring - we're doing way too much
7. ✅ Company info for cross-section/segmentation

## API Endpoints

### 1. Generate Persona (Hydrate - Returns JSON)
**POST** `/api/personas/generate`

**Body**:
```typescript
{
  contactId?: string
  redisKey?: string
  description?: string
  companyHQId: string
  productId?: string              // Required if productDescription not provided
  productDescription?: string     // Fallback if no products exist yet
  mode: "hydrate"
}
```

**Response**: Returns PersonaGeneratorResult (JSON only, not saved)

### 2. Save Persona (Persist to DB)
**POST** `/api/personas/save`

**Body**:
```typescript
{
  persona: PersonaJSON  // Simple persona data
  companyHQId: string
  // That's it - no productFit, no bdIntel
}
```

**Response**: Returns saved persona with ID

### 3. Update Persona (Edit Existing)
**PUT** `/api/personas/[personaId]`

**Body**: Same as save, but updates existing

## Frontend Flow

### New Persona Builder Page
**Route**: `/personas/builder/[personaId]?contactId=...&productId=...`

**Flow**:
1. **Check Requirements**:
   - If no products exist → Show error: "No products found. [Create Product] or [Enter Product Description]"
   - If no productId in params → Show product selector OR product description input
   
2. **Generate**:
   - Call `/api/personas/generate` with productId
   - Get JSON back
   - Populate form fields

3. **Edit**:
   - User can modify all fields
   - Form shows: persona fields + product fit + BD intel
   - All editable before saving

4. **Save**:
   - Call `/api/personas/save`
   - Redirect to persona detail page

### Product Requirement Handling

**Option A: Redirect to Product Creation**
```
No product → Show error with button "Create Product" 
→ Redirects to /products/builder?returnTo=/personas/builder
→ After product created, returns to persona builder
```

**Option B: Inline Product Description**
```
No product → Show text area "Describe your product/service"
→ User enters description
→ That becomes productDescription in payload
→ Service uses it as context for generation
→ Note: Still need to create actual product later
```

**Recommendation**: Both - Show product selector first, if empty show "Create Product" button + "Or describe product" text area

## Error Handling

### Before Generation:
- ❌ No companyHQId → Error: "Company context required"
- ❌ No productId AND no productDescription → Error: "Product required. [Create Product] or [Describe Product]"
- ⚠️ No products in tenant → Show: "No products found. [Create First Product] or [Use Product Description]"

### During Generation:
- ❌ OpenAI fails → Error with retry option
- ❌ Invalid JSON → Error with details
- ⚠️ Missing optional fields → Warn but continue

### After Generation:
- ✅ Success → Show form with data
- ❌ Save fails → Show error, keep form data

## Implementation Steps

### Phase 1: Service Layer
1. ✅ Create `PersonaGeneratorService.ts`
2. ✅ Add productId requirement
3. ✅ Integrate product context into prompts
4. ✅ Generate all three models in one call
5. ✅ Return unified JSON structure

### Phase 2: API Layer
1. ✅ Create `/api/personas/generate` (hydrate mode)
2. ✅ Create `/api/personas/save` (persist mode)
3. ✅ Update existing endpoints to use new service
4. ✅ Add product validation

### Phase 3: Frontend
1. ✅ Create `/personas/builder/[personaId]` page
2. ✅ Add product requirement check
3. ✅ Add product creation redirect
4. ✅ Add product description fallback
5. ✅ Implement edit → save flow
6. ✅ Add error handling

### Phase 4: Migration
1. ⚠️ Update existing personas to have productId (if possible)
2. ⚠️ Deprecate old endpoints (mark as legacy)
3. ⚠️ Update documentation

## Schema Changes Needed

### No Schema Changes Required!

**Key Insight**: Personas don't need productId as a foreign key. The productId is just context for generation.

```prisma
model personas {
  // NO productId field needed
  product_fits product_fits?  // This is the proper link
}
```

**Why**:
- A persona is about the person/role archetype
- Multiple products might fit the same persona
- `product_fits` table is the proper many-to-one relationship
- Service uses productId as **input context**, not stored on persona

**Current State**:
- `personas.productId` exists but is unused
- Can be removed (breaking change, but it's not being used anyway)
- OR keep it but never set it (legacy field)

**Recommendation**: 
- Remove `personas.productId` and `personas.products` relation
- Use `product_fits` table as the only link between personas and products
- Service accepts productId as input parameter for generation context

## Questions to Answer

1. **Should productId be on personas table or only in product_fits?**
   - ✅ Answer: Only in product_fits. Personas don't store productId.
   - Service uses productId as **input context** for generation
   - product_fits table stores the link between persona and product
   - This allows one persona to fit multiple products (via multiple product_fits records)
   
2. **What if user has no products yet?**
   - Option A: Require product creation first
   - Option B: Allow productDescription as temporary input
   - Option C: Create placeholder product from description

3. **Should we deprecate old PersonaGenerationService?**
   - Yes, but mark as legacy first
   - Keep for backward compatibility temporarily

4. **What about existing personas without products?**
   - Show warning: "Persona missing product link"
   - Allow user to add product via product_fits
   - Don't break page, just show message

