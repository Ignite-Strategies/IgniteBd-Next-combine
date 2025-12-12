# Persona Architecture - Complete Model & API Reference

## Overview

**Personas** are CompanyHQ-scoped templates representing ideal customer archetypes. They are NOT individual contacts - they are reusable profiles that many contacts can match to.

**Purpose**: 
- Match contacts to personas automatically
- Score product fit using persona data
- Guide BD Intelligence with rich context
- Link products to personas for targeted recommendations

---

## Prisma Database Model

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
  subIndustries   String[]    // Optional - Array of sub-industries
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
  
  // Relations
  companyHQ       CompanyHQ   @relation(fields: [companyHQId], references: [id], onDelete: Cascade)
  productFit      ProductFit? // One-to-one: Product fit analysis
  bdIntel         BdIntel?    // One-to-one: BD Intelligence scores
  product         Product?    @relation(fields: [productId], references: [id])
  productId       String?     // Optional - Linked product
  bdosScores      BDOSScore[] // BDOS Intelligence scores

  @@map("personas")
}
```

### Related Models

#### ProductFit (One-to-One)
```prisma
model ProductFit {
  id                 String   @id @default(cuid())
  personaId          String   @unique
  productId          String
  valuePropToThem    String   // How the product helps this persona
  alignmentReasoning String   // Why this product fits this persona
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  persona            Persona  @relation(fields: [personaId], references: [id], onDelete: Cascade)
  product            Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@map("product_fits")
}
```

#### BdIntel (One-to-One)
```prisma
model BdIntel {
  id                    String   @id @default(cuid())
  personaId             String   @unique
  fitScore              Int      // 0-100
  painAlignmentScore    Int      // 0-100
  workflowFitScore      Int      // 0-100
  urgencyScore          Int      // 0-100
  adoptionBarrierScore  Int      // 0-100
  risks                 Json?    // Array of risks
  opportunities         Json?    // Array of opportunities
  recommendedTalkTrack  String?
  recommendedSequence   String?
  recommendedLeadSource String?
  finalSummary          String?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  persona               Persona  @relation(fields: [personaId], references: [id], onDelete: Cascade)

  @@map("bd_intels")
}
```

---

## API Endpoints

### 1. Unified Persona Generation (NEW - RECOMMENDED)
**POST** `/api/personas/generate-unified`

**Purpose**: Generate Persona, ProductFit, and BdIntel in a single OpenAI call. This replaces the previous 3-step pipeline.

**Body**:
```json
{
  "redisKey": "preview:123:abc", // or "apollo:enriched:https://linkedin.com/...",
  "companyHQId": "company_hq_123",
  "mode": "hydrate" | "save", // "hydrate" = return data only, "save" = persist to DB
  "notes": "Optional freeform human notes" // optional
}
```

**Response (mode: "hydrate")**:
```json
{
  "success": true,
  "persona": {
    "personName": "Enterprise CMO",
    "title": "Chief Marketing Officer",
    // ... all persona fields
  },
  "productFit": {
    "targetProductId": "product_456",
    "valuePropToThem": "...",
    "alignmentReasoning": "..."
  },
  "bdIntel": {
    "fitScore": 85,
    "painAlignmentScore": 90,
    // ... all BD intelligence fields
  },
  "mode": "hydrate"
}
```

**Response (mode: "save")**:
```json
{
  "success": true,
  "persona": {
    "id": "persona_123",
    // ... saved persona with relations
  },
  "productFit": {
    "id": "product_fit_123",
    // ... saved product fit
  },
  "bdIntel": {
    "id": "bd_intel_123",
    // ... saved BD intelligence
  },
  "mode": "save"
}
```

**Implementation**: `src/lib/services/EnrichmentToPersonaService.ts` + `src/app/api/personas/generate-unified/route.ts`

**How It Works**:
1. Fetches Apollo data from Redis (handles both `preview:` and `apollo:enriched:` keys)
2. Fetches CompanyHQ record for context
3. Fetches all products for tenant
4. Builds unified prompt that generates all three models
5. Calls OpenAI once (GPT-4o)
6. Parses and normalizes response
7. If `mode: "save"`, persists all three to database

**Benefits**:
- ✅ Single API call instead of 3
- ✅ Faster (one OpenAI call vs three)
- ✅ More consistent (all models generated from same context)
- ✅ Lower cost (one API call vs three)
- ✅ Atomic operation (all or nothing)

---

### 2. List Personas
**GET** `/api/personas`

**Query Parameters**:
- `companyHQId` (required) - Tenant identifier
- `productId` (optional) - Filter personas by product

**Response**:
```json
[
  {
    "id": "persona_123",
    "personName": "Solo Biz Owner",
    "title": "Sole Proprietor",
    "industry": "Professional Services",
    "painPoints": ["Wears all hats", "No time for BD"],
    "productFit": {
      "product": {
        "id": "product_456",
        "name": "Business Development Platform",
        "valueProp": "..."
      }
    },
    "bdIntel": {
      "fitScore": 85,
      "painAlignmentScore": 90
    }
  }
]
```

**Implementation**: `src/app/api/personas/route.js`

---

### 2. Create/Update Persona
**POST** `/api/personas`

**Body**:
```json
{
  "id": "persona_123", // Optional - if provided, updates existing persona
  "personName": "Solo Biz Owner",
  "title": "Sole Proprietor",
  "headline": "Independent business owner",
  "seniority": "Owner",
  "industry": "Professional Services",
  "subIndustries": ["Consulting", "Coaching"],
  "company": null,
  "companySize": "1-10",
  "annualRevenue": "$100K-$500K",
  "location": "United States",
  "description": "Full persona description...",
  "whatTheyWant": "A business development system that works while they focus on delivery",
  "painPoints": ["Wears all hats", "No time for BD", "Can't scale"],
  "risks": ["Burnout", "Revenue volatility"],
  "decisionDrivers": ["Time savings", "Revenue growth"],
  "buyerTriggers": ["Overwhelmed", "Revenue plateau"],
  "companyHQId": "company_hq_123"
}
```

**Response**:
```json
{
  "personaId": "persona_123",
  "persona": {
    "id": "persona_123",
    "personName": "Solo Biz Owner",
    // ... full persona object with relations
  }
}
```

**Implementation**: `src/app/api/personas/route.js`

**Notes**:
- Array fields (`painPoints`, `risks`, etc.) can be sent as arrays or strings (auto-normalized)
- If `id` is provided, updates existing persona; otherwise creates new one
- `personName` and `title` are required

---

### 3. Get Persona by ID
**GET** `/api/personas/[personaId]`

**Query Parameters**:
- `companyHQId` (optional) - For tenant validation

**Response**:
```json
{
  "id": "persona_123",
  "personName": "Solo Biz Owner",
  "title": "Sole Proprietor",
  // ... all persona fields
  "productFit": {
    "product": {
      "id": "product_456",
      "name": "Business Development Platform",
      "valueProp": "...",
      "description": "...",
      "price": 5000,
      "priceCurrency": "USD"
    },
    "valuePropToThem": "...",
    "alignmentReasoning": "..."
  },
  "bdIntel": {
    "fitScore": 85,
    "painAlignmentScore": 90,
    // ... all BD intelligence fields
  },
  "companyHQ": {
    "id": "company_hq_123",
    "companyName": "Ignite BD"
  }
}
```

**Implementation**: `src/app/api/personas/[personaId]/route.js`

---

### 4. Generate Persona from Enriched Contact
**POST** `/api/personas/generate`

**Purpose**: Generate a persona from Apollo-enriched contact data stored in Redis

**Body**:
```json
{
  "redisKey": "apollo:enriched:https://linkedin.com/in/...",
  "companyHQId": "company_hq_123"
}
```

**Process**:
1. Fetches enriched Apollo data from Redis
2. Sends to OpenAI GPT-4o with structured prompt
3. Parses JSON response into persona fields
4. Creates persona in database

**Response**:
```json
{
  "success": true,
  "persona": {
    "id": "persona_123",
    "personName": "Enterprise CMO",
    "title": "Chief Marketing Officer",
    // ... all generated fields
  }
}
```

**Implementation**: `src/app/api/personas/generate/route.ts`

**OpenAI Model**: `gpt-4o` (configurable via `OPENAI_MODEL` env var)

---

### 5. Generate Persona from Description
**POST** `/api/personas/generate-from-description`

**Purpose**: Generate a persona from free-form text description

**Body**:
```json
{
  "description": "A solo business owner who wears all hats and needs help with business development",
  "companyHQId": "company_hq_123"
}
```

**Process**:
1. Fetches company context (companyHQ) for better generation
2. Sends description + company context to OpenAI
3. Returns generated persona data (NOT saved to DB - use POST `/api/personas` to save)

**Response**:
```json
{
  "success": true,
  "persona": {
    "personName": "Solo Biz Owner",
    "title": "Sole Proprietor",
    // ... all generated fields
  },
  "companyHQId": "company_hq_123"
}
```

**Implementation**: `src/app/api/personas/generate-from-description/route.ts`

**Note**: This endpoint does NOT save to database - it only generates the persona structure. Use POST `/api/personas` to persist.

---

### 6. Generate Product Fit
**POST** `/api/personas/[personaId]/product-fit`

**Purpose**: Match persona to best-fitting product using OpenAI

**Process**:
1. Fetches persona and all products for tenant
2. Sends to OpenAI to match persona to best product
3. Creates/updates ProductFit record

**Response**:
```json
{
  "success": true,
  "productFit": {
    "id": "product_fit_123",
    "personaId": "persona_123",
    "productId": "product_456",
    "valuePropToThem": "Handles outreach, relationship building, and pipeline management so they can focus on delivery",
    "alignmentReasoning": "Addresses their core pain point of not having time for BD while providing the system they want"
  }
}
```

**Implementation**: `src/app/api/personas/[personaId]/product-fit/route.ts`

**Requires**: Persona must exist

---

### 7. Generate BD Intelligence
**POST** `/api/personas/[personaId]/bd-intel`

**Purpose**: Generate business development intelligence from persona + product fit

**Process**:
1. Fetches persona with productFit
2. Requires productFit to exist (returns 400 if not found)
3. Sends persona + product data to OpenAI
4. Creates/updates BdIntel record with scores and recommendations

**Response**:
```json
{
  "success": true,
  "bdIntel": {
    "id": "bd_intel_123",
    "personaId": "persona_123",
    "fitScore": 85,
    "painAlignmentScore": 90,
    "workflowFitScore": 80,
    "urgencyScore": 75,
    "adoptionBarrierScore": 60,
    "risks": ["Budget constraints", "Time to implement"],
    "opportunities": ["High pain alignment", "Clear value prop"],
    "recommendedTalkTrack": "Focus on time savings and revenue growth...",
    "recommendedSequence": "Email → LinkedIn → Call",
    "recommendedLeadSource": "LinkedIn",
    "finalSummary": "Strong fit - high pain alignment and clear value proposition"
  }
}
```

**Implementation**: `src/app/api/personas/[personaId]/bd-intel/route.ts`

**Requires**: 
- Persona must exist
- ProductFit must exist (generate product-fit first)

---

## Complete Persona Pipeline Flow

### NEW UNIFIED FLOW (Recommended)

**Single Unified Generation**:
```
POST /api/personas/generate-unified
{
  redisKey: "preview:123:abc",
  companyHQId: "company_hq_123",
  mode: "save"
}
↓
Fetch Apollo data from Redis
Fetch CompanyHQ
Fetch Products
↓
Single OpenAI call (GPT-4o)
↓
Generate: Persona + ProductFit + BdIntel
↓
Save all three to database
```

### OLD 3-STEP FLOW (Deprecated - Still Available)

**Stage 1: Contact Enrichment (Apollo)**
```
LinkedIn URL → Apollo API → Redis (enriched data)
```

**Stage 2: Persona Generation**
```
POST /api/personas/generate
Redis enriched data → OpenAI GPT-4o → Persona created in DB
```

**Stage 3: Product Fit Matching**
```
POST /api/personas/[personaId]/product-fit
Persona + Products → OpenAI GPT-4o → ProductFit created
```

**Stage 4: BD Intelligence**
```
POST /api/personas/[personaId]/bd-intel
Persona + ProductFit → OpenAI GPT-4o → BdIntel created
```

**Note**: The old 3-step flow is still available for backward compatibility, but the unified endpoint is recommended for new integrations.

---

## Field Reference

### Identity Fields
- `personName` (String, required) - Name of persona (e.g., "Solo Biz Owner")
- `title` (String, required) - Role/Title (e.g., "Sole Proprietor")
- `headline` (String, optional) - Short tagline/headline
- `seniority` (String, optional) - Seniority level (e.g., "C-Level", "Director")

### Industry & Company Fields
- `industry` (String, optional) - Primary industry
- `subIndustries` (String[], optional) - Array of related industries
- `company` (String, optional) - Specific company name
- `companySize` (String, optional) - Company size (e.g., "1-10", "11-50")
- `annualRevenue` (String, optional) - Revenue range
- `location` (String, optional) - Geographic location

### Behavioral Fields (Arrays)
- `painPoints` (String[]) - Array of pain points
- `risks` (String[]) - Array of risks they face
- `decisionDrivers` (String[]) - What drives their decisions
- `buyerTriggers` (String[]) - What triggers them to buy

### Descriptive Fields
- `description` (String, optional) - Full persona description
- `whatTheyWant` (String, optional) - What they're looking for

---

## Authentication

All endpoints require Firebase authentication via `verifyFirebaseToken()` except:
- **GET** `/api/personas` - Uses optional auth (`optionallyVerifyFirebaseToken()`)

---

## Error Handling

All endpoints return consistent error format:
```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details (in development)"
}
```

**Status Codes**:
- `200` - Success
- `201` - Created
- `400` - Bad Request (missing/invalid parameters)
- `401` - Unauthorized
- `403` - Forbidden (tenant mismatch)
- `404` - Not Found
- `500` - Internal Server Error

---

## Integration Points

### 1. Contact Matching
- **Service**: `src/lib/services/BusinessIntelligenceScoringService.js`
- **Function**: `findMatchingPersona(contactId, companyHQId, options)`
- **Algorithm**: Role/Title (3pts) + Industry (2pts) + Goals/Pain Points (1pt)
- **Threshold**: Minimum 20% confidence

### 2. BD Intelligence Scoring
- **Service**: `src/lib/services/BusinessIntelligenceScoringService.js`
- **Function**: `calculateFitScore(contactId, productId, personaId)`
- **Uses**: Persona `goals` and `painPoints` for scoring

### 3. Product Linking
- Products can target personas via `Product.targetedTo` field
- Enables filtering products by target persona
- Used in proposal builder

---

## Current State

✅ **Persona Model**: Complete Prisma schema  
✅ **CRUD APIs**: Create, Read, Update personas  
✅ **Unified Generation API**: Generate Persona + ProductFit + BdIntel in one call (NEW)  
✅ **Legacy Generation APIs**: Generate from enriched contact or description (still available)  
✅ **Product Fit API**: Match persona to products (standalone)  
✅ **BD Intelligence API**: Generate BD intelligence scores (standalone)  
✅ **Persona Builder UI**: `/personas/builder`  
✅ **Contact Matching**: Automatic persona matching for contacts  
✅ **Product Linking**: Products can target personas

**Recommended**: Use `/api/personas/generate-unified` for new integrations. The 3-step pipeline is still available for backward compatibility.  

---

## Future Enhancements

1. **Persist Persona Assignments**
   - Add `personaId` field to Contact model
   - Store matches in database
   - Allow manual override

2. **Semantic Matching**
   - Use OpenAI embeddings for semantic similarity
   - More accurate than keyword matching

3. **Match Analytics**
   - Track match accuracy over time
   - Show match history per contact

4. **Manual Persona Assignment**
   - UI to manually assign personas to contacts
   - Bulk persona assignment

5. **Persona Parser**
   - Add persona to Universal Parser system
   - Extract persona data from raw text

