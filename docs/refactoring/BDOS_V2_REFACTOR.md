# BDOS v2 Refactor - Implementation Summary

## Overview

This document summarizes the complete refactor of BD Intelligence to BDOS v2 (Six-Pillar Model) with Enrichment Intelligence Layer.

## What Was Implemented

### 1. ✅ Prisma Schema Updates

**Contact Model** - Added intelligence fields:
- `seniorityScore` (Int?, 0-100)
- `buyingPowerScore` (Int?, 0-100)
- `urgencyScore` (Int?, 0-100)

**Company Model** - Added intelligence fields:
- `companyHealthScore` (Int?, 0-100)
- `headcount` (Int?)
- `growthRate` (Float?)
- Note: `revenue` and `yearsInBusiness` already existed

**New BDOSScore Model**:
- Stores each BD Intelligence run
- Fields: `id`, `contactId`, `productId`, `personaId`, `totalScore`, `personaFit`, `productFit`, `companyReadiness`, `buyingPower`, `seniority`, `urgency`, `rationale`, `rawResponse`, `createdAt`
- Relations: Contact, Product, Persona

### 2. ✅ Enrichment Extraction Layer

**File**: `src/lib/intelligence/EnrichmentParserService.ts`

**Functions**:
- `extractSeniorityScore(apollo)`: Extracts seniority score (0-100) from Apollo payload
- `extractBuyingPowerScore(apollo)`: Extracts buying power score (0-100)
- `extractUrgencyScore(apollo)`: Extracts urgency score (0-100)
- `extractCompanyIntelligence(apollo)`: Extracts company intelligence (health score, headcount, revenue, growth rate)

**Scoring Logic**:
- **Seniority**: Based on title/seniority level (C-level: 90-100, VP: 70-89, Director: 50-69, Manager: 30-49, IC: 0-29)
- **Buying Power**: Based on title authority (0-60), company size (0-25), revenue (0-15)
- **Urgency**: Based on recent job changes, company growth, funding events
- **Company Health**: Based on headcount, revenue, growth rate, funding events

### 3. ✅ Calculation Layer

**ContactIntelligenceService.ts**:
- `computeContactIntelligence(contact)`: Returns `{ seniority, buyingPower, urgency }` from stored scores

**CompanyIntelligenceService.ts**:
- `computeCompanyReadiness(company)`: Returns `companyHealthScore` from stored field

### 4. ✅ BDOS v2 Intelligence Engine

**File**: `src/lib/intelligence/BDOSScoringService.ts`

**Function**: `calculateBDOSScore(contactId, productId, personaId?)`

**Six Pillars** (0-100 each):
1. **personaFit**: How well contact matches target persona
2. **productFit**: How well product matches contact's needs
3. **companyReadiness**: Company health and growth indicators
4. **buyingPower**: Contact's authority and company budget capacity
5. **seniority**: Contact's seniority level and decision-making influence
6. **urgency**: How urgent the contact's need is

**Weighted Final Score**:
```
finalScore = 
  personaFit * 0.20 +
  productFit * 0.20 +
  companyReadiness * 0.20 +
  buyingPower * 0.15 +
  seniority * 0.10 +
  urgency * 0.15
```

**Process**:
1. Fetch contact, product, company, persona data
2. Get intelligence scores from Contact and Company models
3. Calculate persona fit and product fit
4. Call OpenAI with BDOS prompts
5. Store BDOSScore record in database
6. Return final score with rationale

### 5. ✅ OpenAI Prompt Builder

**File**: `src/lib/intelligence/BDOSPromptBuilder.ts`

**Functions**:
- `buildBDOSSystemPrompt()`: Returns system prompt for BDOS v2
- `buildBDOSUserPrompt(data)`: Builds user prompt with contact, product, persona, and intelligence data

**System Prompt**: Instructs GPT to validate scores, combine using BDOS weighting, output final score, and provide rationale.

**User Prompt**: Includes extracted persona fit, product definition, contact roles, enrichment data, and parsed intelligence scores.

### 6. ✅ Enrichment Endpoint Update

**File**: `src/app/api/contacts/enrich/route.ts`

**Changes**:
- After Apollo enrichment, runs `EnrichmentParserService` to extract intelligence scores
- Updates Contact with `seniorityScore`, `buyingPowerScore`, `urgencyScore`
- Updates Company with `companyHealthScore`, `headcount`, `revenue`, `growthRate`
- Stores full Apollo response in `enrichmentPayload`

**Flow**:
1. Enrich contact via Apollo
2. Extract intelligence scores from Apollo payload
3. Update Contact with intelligence scores
4. Update Company with intelligence scores (if company exists)
5. Return enriched data + intelligence scores

### 7. ✅ BDOS API Endpoint

**File**: `src/app/api/bdos/score/route.ts`

**Endpoint**: `POST /api/bdos/score`

**Request**:
```json
{
  "contactId": "contact_123",
  "productId": "product_456",
  "personaId": "persona_789" // Optional
}
```

**Response**:
```json
{
  "success": true,
  "contactId": "contact_123",
  "productId": "product_456",
  "personaId": "persona_789",
  "scores": {
    "personaFit": 85,
    "productFit": 90,
    "companyReadiness": 75,
    "buyingPower": 80,
    "seniority": 70,
    "urgency": 65,
    "totalScore": 78
  },
  "rationale": "Strong fit across all dimensions..."
}
```

**Validation**:
- ✅ Contact exists and belongs to user's tenant
- ✅ Product exists and belongs to user's tenant
- ✅ Contact and Product belong to same tenant
- ✅ Persona (if provided) exists and belongs to same tenant
- ✅ Auto-matches persona if not provided

## Migration

**Status**: Schema changes are ready. Migration needs to be run when DATABASE_URL is configured.

**Command**:
```bash
npx prisma migrate dev --name bdos_v2_refactor
```

**What the migration will do**:
1. Add `seniorityScore`, `buyingPowerScore`, `urgencyScore` to `contacts` table
2. Add `companyHealthScore`, `headcount`, `growthRate` to `companies` table
3. Create `bdos_scores` table with all BDOSScore fields and relations

## File Structure

```
src/lib/intelligence/
  ├── EnrichmentParserService.ts      # Extract intelligence from Apollo
  ├── ContactIntelligenceService.ts   # Compute contact intelligence
  ├── CompanyIntelligenceService.ts   # Compute company intelligence
  ├── BDOSPromptBuilder.ts           # Build OpenAI prompts
  └── BDOSScoringService.ts          # Main BDOS scoring engine

src/app/api/
  ├── contacts/enrich/route.ts       # Updated with intelligence extraction
  └── bdos/score/route.ts            # New BDOS scoring endpoint

prisma/schema.prisma                  # Updated with new fields and BDOSScore model
```

## What Was NOT Changed

✅ Existing enrichment endpoint structure  
✅ Existing Contact model fields (only added new ones)  
✅ Existing Product model fields  
✅ Existing Persona model fields  
✅ Existing CompanyHQ tenant scoping  
✅ Email-based deduplication  

## Next Steps

1. **Run Migration**: Execute `npx prisma migrate dev --name bdos_v2_refactor` when DATABASE_URL is configured
2. **Test Enrichment**: Enrich a contact and verify intelligence scores are extracted and stored
3. **Test BDOS Scoring**: Call `/api/bdos/score` with a contact and product to verify scoring works
4. **Update UI**: Update BD Intelligence UI to use new `/api/bdos/score` endpoint (if needed)
5. **Monitor**: Check that BDOSScore records are being created correctly

## Notes

- Intelligence scores are computed during enrichment and stored in Contact/Company models
- BDOS scoring uses stored intelligence scores + computes persona/product fit
- OpenAI is called once per BDOS score calculation to validate and combine scores
- All scores are stored in BDOSScore table for historical tracking
- Persona auto-matching is still supported (from old BusinessIntelligenceScoringService)

