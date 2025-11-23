# Persona Build System

## Premise

**Personas** represent the ideal customer profiles that your business wants to target. They are archetypal representations of your target buyers, capturing their characteristics, pain points, goals, and decision-making patterns.

**Purpose**: Build detailed personas that define who you're selling to, so the system can:
- **Match contacts to personas** automatically based on role, industry, and behavioral signals
- **Score product fit** using persona data (goals, pain points) to determine how well your products match a contact's needs
- **Guide BD Intelligence** by providing rich context about what your target customers want and need
- **Link products to personas** to understand which offerings are best suited for which customer types

**Key Principle**: Personas are **CompanyHQ-scoped templates** (like Products) that represent your ideal customer archetypes. They are NOT individual contacts - they are reusable profiles that many contacts can match to.

## What It Does

### Core Functionality

1. **Persona Definition**
   - Capture detailed buyer profiles: role, industry, company size, location
   - Document behavioral attributes: goals, pain points, risks, decision drivers, buyer triggers
   - Define what they want and why they buy

2. **Automatic Contact Matching**
   - **Persona Mapper** automatically matches contacts to personas based on:
     - Role/Title matching (weighted: 3 points)
     - Industry matching (weighted: 2 points)
     - Goals/Pain Points keyword matching (weighted: 1 point)
   - Returns confidence scores (0-100%)
   - Only matches if confidence ≥ 20% (configurable threshold)

3. **BD Intelligence Integration**
   - Persona data enriches fit score calculations
   - Uses persona `goals` and `painPoints` when available (falls back to contact notes)
   - Provides structured context for GPT-based scoring

4. **Product-Persona Linking**
   - Products can be linked to personas via `targetedTo` field
   - `ProductFit` model stores value proposition alignment for persona-product pairs
   - Enables targeted product recommendations

## How It Maps to Models

### Prisma Database Model (Source of Truth)

**Location**: `prisma/schema.prisma`

```prisma
model Persona {
  id              String      @id @default(cuid())
  companyHQId     String      // Required - tenant scoping
  personName      String      @default("") // Persona name (e.g., "Solo Biz Owner")
  title           String      // Required - Role/Title (e.g., "Sole Proprietor")
  headline        String?     // Optional - Short headline
  seniority       String?     // Optional - Seniority level
  industry        String?     // Optional - Primary industry
  subIndustries   String[]     // Optional - Array of sub-industries
  company         String?     // Optional - Company name (if specific)
  companySize     String?     // Optional - Company size
  annualRevenue   String?     // Optional - Revenue range
  location        String?     // Optional - Geographic location
  description     String?     // Optional - Full persona description
  whatTheyWant    String?     // Optional - What they're looking for
  painPoints      String[]    // Optional - Array of pain points
  risks           String[]    // Optional - Array of risks they face
  decisionDrivers String[]    // Optional - What drives their decisions
  buyerTriggers   String[]    // Optional - What triggers them to buy
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  companyHQ       CompanyHQ   @relation(fields: [companyHQId], references: [id], onDelete: Cascade)
  productFit      ProductFit? // One-to-one: Product fit analysis
  bdIntel         BdIntel?    // One-to-one: BD Intelligence scores
  product         Product?    @relation(fields: [productId], references: [id])
  productId       String?     // Optional - Linked product

  @@map("personas")
}
```

### Field Categories

#### Identity Fields
- `personName`: Name of the persona (e.g., "Solo Biz Owner", "Enterprise CMO")
- `title`: Role/Title (required) - Used for matching contacts
- `headline`: Short tagline/headline
- `seniority`: Seniority level (e.g., "C-Level", "Director", "Manager")

#### Industry & Company Fields
- `industry`: Primary industry (used for matching)
- `subIndustries[]`: Array of related industries
- `company`: Specific company name (if persona is company-specific)
- `companySize`: Company size (e.g., "1-10", "11-50", "51-200")
- `annualRevenue`: Revenue range
- `location`: Geographic location

#### Behavioral Fields (Arrays)
- `painPoints[]`: Array of pain points they experience
- `risks[]`: Array of risks they face
- `decisionDrivers[]`: What drives their purchase decisions
- `buyerTriggers[]`: What triggers them to buy

#### Descriptive Fields
- `description`: Full persona description
- `whatTheyWant`: What they're looking for in a solution

### Relationships

#### 1. ProductFit (One-to-One)
```prisma
model ProductFit {
  id                 String   @id @default(cuid())
  personaId          String   @unique
  productId          String
  valuePropToThem    String   // How the product helps this persona
  alignmentReasoning String   // Why this product fits this persona
  persona            Persona  @relation(fields: [personaId], references: [id], onDelete: Cascade)
  product            Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
}
```

**Purpose**: Stores the value proposition and alignment reasoning for a specific persona-product pair.

#### 2. BdIntel (One-to-One)
```prisma
model BdIntel {
  id                    String   @id @default(cuid())
  personaId             String   @unique
  fitScore              Int      // 0-100
  painAlignmentScore    Int      // 0-100
  workflowFitScore      Int      // 0-100
  persona               Persona  @relation(fields: [personaId], references: [id], onDelete: Cascade)
}
```

**Purpose**: Stores BD Intelligence scores calculated for this persona.

#### 3. Product (Many-to-One)
- `productId`: Optional link to a Product
- `Product.targetedTo`: Can reference a Persona ID
- Enables bidirectional linking between Products and Personas

## How It's Used

### 1. Persona Builder UI

**Location**: `/personas/builder`

- Create and edit personas
- Form fields map to Prisma model:
  - `personaName` → `personName`
  - `role` → `title`
  - `painPoints` → `painPoints[]` (stored as text, split into array)
  - `goals` → `whatTheyWant` (or stored in description)
  - `whatTheyWant` → `whatTheyWant`

**Note**: Form uses simple text fields; arrays are handled server-side.

### 2. Persona Mapper Service

**Location**: `src/lib/services/BusinessIntelligenceScoringService.js`

**Function**: `findMatchingPersona(contactId, companyHQId, options)`

**Matching Algorithm**:
```javascript
// Scoring weights:
// - Role/Title: 3 points (exact), 2 points (partial), 1 point (keyword)
// - Industry: 2 points (exact), 1 point (partial)
// - Notes/Goals: 1 point (keyword matching)
// Max score: 6 points
// Confidence = (score / 6) * 100
```

**Process**:
1. Fetch contact with company data
2. Fetch all personas for tenant (`companyHQId`)
3. Score each persona:
   - **Role/Title matching**: Compare `contact.title` vs `persona.title`
   - **Industry matching**: Compare `contact.contactCompany.industry` vs `persona.industry`
   - **Goals/Pain Points matching**: Keyword matching in `contact.notes` vs `persona.goals` + `persona.painPoints`
4. Calculate confidence (0-100%)
5. Return best match if confidence ≥ 20%

**Returns**:
```javascript
{
  personaId: string | null,
  confidence: number, // 0-100
  bestMatch: {
    id: string,
    name: string,
    role: string,
    industry: string
  },
  matchDetails: Array<{
    personaId: string,
    personaName: string,
    score: number,
    reasons: string[]
  }>
}
```

### 3. BD Intelligence Scoring

**Location**: `src/lib/services/BusinessIntelligenceScoringService.js`

**Function**: `calculateFitScore(contactId, productId, personaId)`

**How Persona Data is Used**:
1. **If `personaId` provided**: Use persona's `goals` and `painPoints` for scoring
2. **If no `personaId`**: Auto-match persona using `findMatchingPersona()`
3. **Fallback**: Use `contact.notes` if no persona data available

**Scoring Dimensions** (0-100 each):
- **Point of Need**: How urgent is their need?
- **Pain Alignment**: How well does product address their pain points?
- **Willingness to Pay**: Budget sensitivity
- **Impact Potential**: How much value will they get?
- **Context Fit**: Overall fit considering all factors

**Persona Enrichment**:
- Persona `goals` → Used in GPT prompt for scoring
- Persona `painPoints` → Used to evaluate pain alignment
- Persona `whatTheyWant` → Used to assess fit

### 4. BD Intelligence API

**Endpoint**: `POST /api/business-intelligence/fit-score`

**Request**:
```json
{
  "contactId": "contact_123",
  "productId": "product_456",
  "personaId": "persona_789" // Optional - auto-matched if not provided
}
```

**Response**:
```json
{
  "success": true,
  "contactId": "contact_123",
  "productId": "product_456",
  "personaId": "persona_789",
  "personaMatch": {
    "confidence": 75,
    "bestMatch": {
      "id": "persona_789",
      "name": "Solo Biz Owner",
      "role": "Sole Proprietor",
      "industry": "Professional Services"
    }
  },
  "scores": {
    "pointOfNeed": 85,
    "painAlignment": 90,
    "willingnessToPay": 70,
    "impactPotential": 80,
    "contextFit": 75
  },
  "summary": "Strong fit - high pain alignment..."
}
```

### 5. BD Intelligence UI

**Location**: `/bd-intelligence`

**Displays**:
- Matched persona name, role, industry
- Match confidence percentage
- Visual indicator of persona match
- Persona ID for reference
- Fit scores breakdown

## Ties to Product

### 1. Product → Persona Linking

**Product Model**:
```prisma
model Product {
  // ...
  targetedTo String? // Persona ID that this product targets
  personas   Persona[] // Many-to-many via targetedTo
}
```

**Usage**:
- Products can specify which persona they target via `targetedTo` field
- Enables filtering products by target persona
- Used in proposal builder to show relevant products

### 2. ProductFit Model

**Purpose**: Stores the value proposition and alignment reasoning for persona-product pairs.

**Fields**:
- `valuePropToThem`: How the product helps this specific persona
- `alignmentReasoning`: Why this product fits this persona

**Usage**:
- Created when linking a persona to a product
- Stores persona-specific value propositions
- Used in BD Intelligence to explain product fit

### 3. BD Intelligence Flow

**Complete Flow**:
1. **Contact** → Auto-match to **Persona** (if not provided)
2. **Persona** → Provides goals, pain points for scoring
3. **Product** → May be linked to **Persona** via `targetedTo`
4. **ProductFit** → Stores persona-product alignment (if exists)
5. **BD Intelligence** → Calculates fit score using:
   - Contact data
   - Persona data (goals, pain points)
   - Product data (value prop, features)
   - ProductFit data (if exists)

### 4. Example: Solo Biz Owner Persona

**Persona**:
```json
{
  "personName": "Solo Biz Owner",
  "title": "Sole Proprietor",
  "industry": "Professional Services",
  "painPoints": [
    "Wears all hats (operations, sales, marketing, delivery)",
    "No time for business development",
    "Can't scale because they're doing everything"
  ],
  "whatTheyWant": "A business development system that works while they focus on delivery"
}
```

**Product** (Business Development Platform):
```json
{
  "name": "Business Development Platform",
  "targetedTo": "persona_solo_biz_owner_id",
  "valueProp": "Systematically grow revenue through Attract → Engage → Nurture methodology"
}
```

**ProductFit**:
```json
{
  "personaId": "persona_solo_biz_owner_id",
  "productId": "product_bd_platform_id",
  "valuePropToThem": "Handles outreach, relationship building, and pipeline management so they can focus on delivery",
  "alignmentReasoning": "Addresses their core pain point of not having time for BD while providing the system they want"
}
```

**BD Intelligence Result**:
- High pain alignment (90/100) - product directly addresses persona pain points
- High impact potential (85/100) - solves their scaling problem
- Moderate willingness to pay (70/100) - solo owners are budget-conscious

## Data Flow

```
[User Creates Persona]
        ↓
[Persona Stored in DB]
        ↓
[Contact Added/Updated]
        ↓
[Persona Mapper Runs]
        ↓
[Match Found?] → Yes → [Persona Linked to Contact]
        ↓                    ↓
        No              [BD Intelligence Scoring]
        ↓                    ↓
[No Persona Match]    [Uses Persona Goals/Pain Points]
        ↓                    ↓
[BD Intelligence]      [Fit Score Calculated]
        ↓                    ↓
[Uses Contact Notes]   [ProductFit Checked]
        ↓                    ↓
[Fit Score Calculated] [Result Returned]
```

## Key Design Decisions

### 1. Personas Are Templates, Not Contacts

- Personas are **CompanyHQ-scoped** (tenant-level)
- They represent **ideal customer archetypes**
- Many contacts can match to the same persona
- Contacts are **instances**, personas are **templates**

### 2. Array Fields for Behavioral Data

- `painPoints[]`, `risks[]`, `decisionDrivers[]`, `buyerTriggers[]` are arrays
- Allows structured storage of multiple items
- Enables better matching and scoring
- Form UI uses textarea (split on newlines server-side)

### 3. Optional Persona in BD Intelligence

- Persona is **optional** in fit score calculation
- Falls back to `contact.notes` if no persona
- Auto-matching ensures personas are used when available
- Manual override via `personaId` parameter

### 4. Confidence Threshold

- Minimum 20% confidence for persona matching
- Prevents low-quality matches
- Configurable threshold (can be adjusted)
- Returns `null` if below threshold

## Future Enhancements

1. **Persist Persona Assignments**
   - Add `personaId` field to Contact model
   - Store matches in database
   - Allow manual override
   - Track match history

2. **Semantic Matching**
   - Use OpenAI embeddings for semantic similarity
   - Match on goals/pain points using embeddings
   - More accurate than keyword matching

3. **Match Analytics**
   - Track match accuracy over time
   - A/B test different matching algorithms
   - Show match history per contact

4. **Manual Persona Assignment**
   - UI to manually assign personas to contacts
   - Override automatic matching
   - Bulk persona assignment

5. **Persona Parser**
   - Add persona to Universal Parser system
   - Extract persona data from raw text
   - Auto-populate persona fields

## Current State

✅ **Persona Model**: Complete Prisma schema with all fields  
✅ **Persona Builder**: UI for creating/editing personas  
✅ **Persona Mapper**: Enhanced matching with confidence scoring  
✅ **BD Intelligence**: Integrated persona data for scoring  
✅ **Product Linking**: Products can target specific personas  
✅ **ProductFit**: Stores persona-product alignment  

The persona system is production-ready and actively used in BD Intelligence scoring and product targeting.

