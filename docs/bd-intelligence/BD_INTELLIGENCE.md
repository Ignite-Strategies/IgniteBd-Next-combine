# BD Intelligence - Complete Reference

## Overview

**BD Intelligence** is an AI-powered scoring system that evaluates how well a business offer (Product) matches a contact's current situation. It uses OpenAI GPT to analyze multiple dimensions of fit and returns a 0-100 Fit Score with detailed breakdown.

**Premise**: Not all contacts are created equal. BD Intelligence helps you identify which contacts are most likely to benefit from your products, making your outreach more targeted and effective.

## Core Functionality

### What It Does

1. **Evaluates Product-Contact Fit**: Analyzes how well a product matches a contact's needs, pain points, and situation
2. **Auto-Matches Personas**: Automatically finds the best matching persona for a contact (if not provided)
3. **Multi-Dimensional Scoring**: Breaks down fit into 5 key dimensions (0-20 each, total 0-100)
4. **AI-Powered Analysis**: Uses OpenAI GPT-4o to reason about fit objectively
5. **Actionable Insights**: Provides summary explanation and confidence scores

### Key Components

- **Service**: `src/lib/services/BusinessIntelligenceScoringService.js`
- **API**: `POST /api/business-intelligence/fit-score`
- **UI**: `/bd-intelligence` page
- **Integration**: Used in outreach targeting, proposal selection, product recommendations

## Scoring Dimensions

BD Intelligence calculates fit across **5 dimensions**, each scored 0-20:

### 1. Point of Need (0-20)
**Question**: How directly does the contact need this offer?

**Scoring Anchors**:
- **0-5**: Weak/irrelevant - Contact doesn't need this
- **6-10**: Partial - Some relevance, but not urgent
- **11-15**: Moderate - Clear need exists
- **16-20**: Strong - Direct, urgent need

**Factors Considered**:
- Contact's role and responsibilities
- Current situation (pipeline stage)
- Explicit needs mentioned in notes
- Persona goals and desired outcomes

### 2. Pain Alignment (0-20)
**Question**: How well does the offer relieve known pain points?

**Scoring Anchors**:
- **0-5**: Weak/irrelevant - Doesn't address their pains
- **6-10**: Partial - Addresses some pains
- **11-15**: Moderate - Addresses key pains
- **16-20**: Strong - Directly solves major pain points

**Factors Considered**:
- Contact's pain points (from persona or notes)
- Product's value proposition
- Product's competitive advantages
- How product addresses specific challenges

### 3. Willingness to Pay (0-20)
**Question**: Likelihood of allocating budget at this stage?

**Scoring Anchors**:
- **0-5**: Weak/irrelevant - No budget or not ready
- **6-10**: Partial - Some budget sensitivity
- **11-15**: Moderate - Budget available
- **16-20**: Strong - High willingness to invest

**Factors Considered**:
- Pipeline stage (early vs. contract stage)
- Budget sensitivity inference
- Product price vs. contact's situation
- Company size and revenue indicators

### 4. Impact Potential (0-20)
**Question**: Magnitude of improvement if adopted?

**Scoring Anchors**:
- **0-5**: Weak/irrelevant - Minimal impact
- **6-10**: Partial - Some improvement
- **11-15**: Moderate - Significant improvement
- **16-20**: Strong - Transformational impact

**Factors Considered**:
- Product's value proposition
- Contact's goals and desired outcomes
- Potential ROI and business impact
- How product addresses core challenges

### 5. Context Fit (0-20)
**Question**: Alignment with role, metrics, and pipeline stage?

**Scoring Anchors**:
- **0-5**: Weak/irrelevant - Poor fit
- **6-10**: Partial - Some alignment
- **11-15**: Moderate - Good alignment
- **16-20**: Strong - Perfect alignment

**Factors Considered**:
- Contact's role and title
- Organization type and industry
- Pipeline stage and context
- Overall situational fit

### Total Score (0-100)
**Formula**: `total_score = point_of_need + pain_alignment + willingness_to_pay + impact_potential + context_fit`

**Interpretation**:
- **80-100**: Excellent fit - High priority target
- **60-79**: Good fit - Strong candidate
- **40-59**: Moderate fit - Consider if other factors align
- **0-39**: Weak fit - Low priority

## Calculation Method

### Step 1: Data Fetching

**Location**: `calculateFitScore()` in `BusinessIntelligenceScoringService.js`

Fetches all required data in parallel:
```javascript
const [contact, product, pipeline, persona] = await Promise.all([
  prisma.contact.findUnique({
    where: { id: contactId },
    include: {
      contactCompany: {
        select: {
          companyName: true,
          industry: true,
        },
      },
    },
  }),
  prisma.product.findUnique({
    where: { id: productId },
  }),
  prisma.pipeline.findUnique({
    where: { contactId },
  }),
  personaId
    ? prisma.persona.findUnique({
        where: { id: personaId },
      })
    : null,
]);
```

### Step 2: Data Mapping

Maps database fields to prompt template:

**Contact Data**:
- `contactName`: `goesBy` || `firstName + lastName` || 'Unknown'
- `contactRole`: `title` || 'Not specified'
- `contactOrg`: `contactCompany.companyName` || 'Not specified'
- `contactGoals`: `persona.goals` || `contact.notes` || 'Not specified'
- `contactPainPoints`: `persona.painPoints` || 'Not specified'
- `contactDesiredOutcome`: `persona.desiredOutcome` || 'Not specified'
- `contactValuePropToPersona`: `persona.valuePropToPersona` || 'Not specified'
- `contactNotes`: `contact.notes` || 'None'

**Product Data**:
- `offerTitle`: `product.name`
- `offerValueProp`: `product.valueProp` || `product.description` || 'Not specified'
- `offerPrice`: Formatted as `"USD 1,234.56"` or 'Not specified'

**Pipeline Data**:
- `pipelineName`: `pipeline.pipeline` || 'Not specified'
- `stageName`: `pipeline.stage` || 'Not specified'
- `budgetSensitivity`: Inferred from pipeline stage (see `inferBudgetSensitivity()`)

### Step 3: Budget Sensitivity Inference

**Function**: `inferBudgetSensitivity(stage, pipeline)`

**Logic**:
```javascript
// Early stages = lower budget sensitivity
if (['interest', 'meeting', 'proposal'].includes(stage.toLowerCase())) {
  return 'Low - Early stage';
}

// Contract stages = higher budget sensitivity
if (['contract', 'contract-signed', 'kickoff', 'work-started'].includes(stage.toLowerCase())) {
  return 'High - Contract stage';
}

// Client pipeline = higher budget sensitivity
if (pipeline.toLowerCase() === 'client') {
  return 'High - Existing client';
}

return 'Moderate';
```

### Step 4: OpenAI Prompt Construction

**System Prompt**:
```
You are a Business Intelligence Logic Scorer.

Your job is to evaluate how well a business offer matches a contact's current situation.

You will reason objectively and output a structured JSON object with numeric scores (0–100 total) and a summary.

Each dimension scores 0–20:

1. Point of Need — how directly the contact needs this offer.
2. Pain Alignment — how well the offer relieves known pains.
3. Willingness to Pay — likelihood of allocating budget at this stage.
4. Impact Potential — magnitude of improvement if adopted.
5. Context Fit — alignment with role, metrics, and pipeline stage.

Use these anchors:
0–5 = weak / irrelevant  
6–10 = partial  
11–15 = moderate  
16–20 = strong  

Compute total_score = sum(all five) and return JSON with keys:
{ point_of_need, pain_alignment, willingness_to_pay, impact_potential, context_fit, total_score, summary }

You must return valid JSON only. All scores must be integers between 0-20. The total_score must be the sum of all five dimension scores.
```

**User Prompt**:
```
Offer:
Title: ${product.name}
Value Prop: ${product.valueProp || product.description || 'Not specified'}
Price: ${offerPrice}

Contact:
Name: ${contactName}
Role: ${contactRole}
Organization: ${contactOrg}
Goals: ${contactGoals}
Pain Points: ${contactPainPoints}
Desired Outcome: ${contactDesiredOutcome}
Value Prop to Persona: ${contactValuePropToPersona}
Budget Sensitivity: ${budgetSensitivity}
Pipeline: ${pipelineName}
Stage: ${stageName}
Notes: ${contactNotes}

Evaluate the fit and return ONLY a valid JSON object with these exact keys:
{
  "point_of_need": <0-20>,
  "pain_alignment": <0-20>,
  "willingness_to_pay": <0-20>,
  "impact_potential": <0-20>,
  "context_fit": <0-20>,
  "total_score": <sum of all five>,
  "summary": "<brief explanation>"
}
```

### Step 5: OpenAI API Call

**Configuration**:
- **Model**: `process.env.OPENAI_MODEL || 'gpt-4o'` (default: gpt-4o)
- **Temperature**: `0.7` (balanced creativity/consistency)
- **Response Format**: `{ type: 'json_object' }` (ensures JSON output)

**Code**:
```javascript
const completion = await openai.chat.completions.create({
  model: model,
  temperature: 0.7,
  messages: [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: userPrompt,
    },
  ],
  response_format: { type: 'json_object' },
});
```

### Step 6: Response Parsing & Validation

1. **Extract JSON**: Parse `completion.choices[0].message.content`
2. **Validate Structure**: Check for required keys:
   - `point_of_need`
   - `pain_alignment`
   - `willingness_to_pay`
   - `impact_potential`
   - `context_fit`
   - `total_score`
   - `summary`
3. **Clamp Scores**: Ensure all dimension scores are 0-20
4. **Recalculate Total**: Sum all dimensions to ensure accuracy
5. **Clamp Total**: Ensure total_score is 0-100

### Step 7: Return Result

**Response Structure**:
```javascript
{
  success: true,
  contactId: string,
  productId: string,
  personaId: string | null,
  scores: {
    pointOfNeed: number,        // 0-20
    painAlignment: number,       // 0-20
    willingnessToPay: number,   // 0-20
    impactPotential: number,    // 0-20
    contextFit: number,         // 0-20
    totalScore: number,          // 0-100
  },
  summary: string,              // Brief explanation
  rawResponse: string,          // Original GPT response
}
```

## Persona Matching

### Overview

**Function**: `findMatchingPersona(contactId, companyHQId, options)`

**Purpose**: Automatically finds the best matching persona for a contact based on role, industry, and semantic similarity.

**When Used**:
- If `personaId` is not provided in `calculateFitScore()`
- Called automatically before scoring to enrich contact data

### Matching Algorithm

**Scoring System** (max 6 points):

#### 1. Role/Title Match (3 points max)
- **Exact match**: `contact.title === persona.role || contact.title === persona.title` → **+3 points**
- **Partial match**: Contains/substring match → **+2 points**
- **Keyword match**: Common keywords (CEO, CTO, CFO, Founder, Owner, Director, Manager, Head, Lead, VP, President) → **+1 point**

#### 2. Industry Match (2 points max)
- **Exact match**: `contact.contactCompany.industry === persona.industry` → **+2 points**
- **Partial match**: Contains/substring match → **+1 point**

#### 3. Goals/Pain Points Match (1 point max)
- **Keyword matching**: Extract keywords (length > 4) from `persona.goals + persona.painPoints`
- **Match in notes**: Count matching keywords in `contact.notes`
- **Score**: `Math.min(1, matchingKeywords.length / 3)` → **+1 point max**

### Confidence Calculation

**Formula**:
```javascript
const maxPossibleScore = 6; // 3 (role) + 2 (industry) + 1 (notes)
const confidence = bestScore > 0 
  ? Math.round((bestScore / maxPossibleScore) * 100) 
  : 0;
```

**Threshold**: Minimum 20% confidence required to return a match

**Example**:
- Best score: 4 points
- Confidence: `(4 / 6) * 100 = 67%`
- Result: ✅ Match returned (67% confidence)

### Return Value

**Simple Mode** (`returnDetails: false`):
```javascript
return personaId: string | null
```

**Detailed Mode** (`returnDetails: true`):
```javascript
{
  personaId: string | null,
  confidence: number,        // 0-100
  bestMatch: {
    id: string,
    name: string,
    role: string,
    industry: string,
  } | null,
  matchDetails: Array<{
    personaId: string,
    personaName: string,
    score: number,
    reasons: string[],
  }>,
}
```

## API Endpoints

### POST /api/business-intelligence/fit-score

**Purpose**: Calculate fit score for a contact-product pair

**Authentication**: Firebase token required

**Request Body**:
```json
{
  "contactId": "contact_123",      // Required
  "productId": "product_456",     // Required
  "personaId": "persona_789"       // Optional - auto-matched if not provided
}
```

**Response** (Success):
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
    "pointOfNeed": 18,
    "painAlignment": 17,
    "willingnessToPay": 15,
    "impactPotential": 16,
    "contextFit": 14,
    "totalScore": 80
  },
  "summary": "Strong fit - high pain alignment and clear need. Contact is in early pipeline stage but shows strong willingness to invest."
}
```

**Response** (Error):
```json
{
  "success": false,
  "error": "Contact not found"
}
```

**Validation**:
- ✅ Contact exists and belongs to user's tenant
- ✅ Product exists and belongs to user's tenant
- ✅ Contact and Product belong to same tenant
- ✅ Persona (if provided) exists and belongs to same tenant

**Auto-Matching**:
- If `personaId` not provided, calls `findMatchingPersona()` automatically
- Uses matched persona's data for scoring
- Returns `personaMatch` details in response

### GET /api/business-intelligence/fit-score

**Purpose**: Calculate fit score via query parameters (same as POST)

**Authentication**: Firebase token required

**Query Parameters**:
- `contactId` (required)
- `productId` (required)

**Response**: Same as POST endpoint

**Note**: Always auto-matches persona (no `personaId` parameter in GET)

## UI Components

### BD Intelligence Page

**Location**: `/bd-intelligence`

**File**: `src/app/(authenticated)/bd-intelligence/page.jsx`

**Features**:
1. **Product Selection**: Dropdown of all products for tenant
2. **Contact Selection**: Dropdown of all contacts for tenant
3. **Calculate Score Button**: Triggers fit score calculation
4. **Score Display**: Shows total score (0-100) with color coding:
   - **Green** (80-100): Excellent fit
   - **Yellow** (60-79): Good fit
   - **Orange** (40-59): Moderate fit
   - **Red** (0-39): Weak fit
5. **Dimension Breakdown**: Shows all 5 dimension scores
6. **Persona Match Display**: Shows matched persona with confidence score
7. **Summary**: GPT-generated explanation
8. **Go Target CTA**: Navigate to outreach with contact/product context

**Color Coding**:
```javascript
// Score colors
if (score >= 80) return 'text-green-600';    // Excellent
if (score >= 60) return 'text-yellow-600';   // Good
if (score >= 40) return 'text-orange-600';   // Moderate
return 'text-red-600';                       // Weak
```

## Data Flow

### Complete Flow Diagram

```
[User selects Contact + Product]
        ↓
[POST /api/business-intelligence/fit-score]
        ↓
[Validate Contact & Product exist + same tenant]
        ↓
[If personaId not provided]
  → [findMatchingPersona()]
  → [Match by role, industry, notes]
  → [Return best match with confidence]
        ↓
[calculateFitScore()]
        ↓
[Fetch Contact, Product, Pipeline, Persona]
        ↓
[Map fields to prompt template]
        ↓
[Infer budget sensitivity from pipeline]
        ↓
[Build OpenAI prompts]
        ↓
[Call OpenAI GPT-4o]
        ↓
[Parse & validate JSON response]
        ↓
[Clamp scores to 0-20, recalculate total]
        ↓
[Return fit score result]
        ↓
[Display in UI with color coding]
```

### Integration Points

#### 1. Outreach Targeting
- **Location**: `/outreach` page
- **Usage**: Pre-fills contact and product from BD Intelligence
- **Flow**: BD Intelligence → "Go Target" → Outreach with context

#### 2. Proposal Selection
- **Location**: Proposal builder
- **Usage**: Uses fit score to recommend products
- **Flow**: Contact selected → Calculate fit scores → Show top products

#### 3. Product Recommendations
- **Location**: Contact detail pages
- **Usage**: Shows "Recommended Products" based on fit scores
- **Flow**: Contact viewed → Calculate fit for all products → Show top 3

## Key Design Decisions

### 1. OpenAI-Powered Scoring
**Decision**: Use GPT-4o for multi-dimensional reasoning

**Rationale**:
- Complex evaluation requires understanding context, not just rule-based logic
- GPT can reason about nuanced factors (pain points, goals, situation)
- More accurate than simple keyword matching

**Trade-offs**:
- ✅ More accurate and nuanced
- ✅ Handles free-text fields (goals, pain points, notes)
- ❌ Requires API call (latency, cost)
- ❌ Non-deterministic (temperature 0.7)

### 2. Persona Auto-Matching
**Decision**: Automatically match persona if not provided

**Rationale**:
- Enriches contact data with persona's goals/pain points
- Improves scoring accuracy
- Reduces manual work

**Trade-offs**:
- ✅ Better scoring with persona data
- ✅ Seamless UX (no manual persona selection)
- ❌ Matching may not be perfect (20% threshold)

### 3. Multi-Dimensional Scoring
**Decision**: Break down into 5 dimensions (0-20 each)

**Rationale**:
- Provides actionable insights (not just a number)
- Helps identify why fit is strong/weak
- Enables targeted improvements

**Trade-offs**:
- ✅ More actionable than single score
- ✅ Easier to understand and explain
- ❌ More complex to interpret

### 4. Budget Sensitivity Inference
**Decision**: Infer from pipeline stage (heuristic)

**Rationale**:
- No explicit budget data available
- Pipeline stage correlates with budget readiness
- Simple heuristic works well

**Trade-offs**:
- ✅ Works without explicit budget data
- ✅ Simple and fast
- ❌ May not be accurate for all cases
- ⚠️ Can be enhanced with actual budget data later

### 5. Persona Matching Algorithm
**Decision**: Rule-based scoring (role + industry + keywords)

**Rationale**:
- Fast and deterministic
- No API calls needed
- Good enough for most cases

**Trade-offs**:
- ✅ Fast and cheap
- ✅ Deterministic
- ❌ Less sophisticated than semantic similarity
- ⚠️ Can be enhanced with embeddings later

## Current State

✅ **Service**: `BusinessIntelligenceScoringService.js` - Complete  
✅ **API**: `/api/business-intelligence/fit-score` - POST & GET working  
✅ **UI**: `/bd-intelligence` page - Full functionality  
✅ **Persona Matching**: Auto-matching with confidence scores  
✅ **Integration**: Outreach targeting, proposal selection  
✅ **OpenAI Integration**: GPT-4o with JSON response format  
✅ **Error Handling**: Comprehensive validation and error messages  
✅ **Multi-Tenancy**: Tenant-scoped (CompanyHQ isolation)  

## Future Enhancements

### 1. Caching
- **Current**: Calculates on-demand (calls OpenAI every time)
- **Enhancement**: Cache scores in Redis with TTL
- **Benefit**: Faster responses, lower API costs

### 2. Batch Scoring
- **Current**: One contact-product pair at a time
- **Enhancement**: Batch API for multiple pairs
- **Benefit**: More efficient for bulk operations

### 3. Semantic Persona Matching
- **Current**: Keyword-based matching
- **Enhancement**: Use embeddings for semantic similarity
- **Benefit**: More accurate persona matching

### 4. Historical Tracking
- **Current**: No history of scores
- **Enhancement**: Store scores in database with timestamps
- **Benefit**: Track fit over time, identify trends

### 5. Score Explanations
- **Current**: Summary only
- **Enhancement**: Detailed explanation per dimension
- **Benefit**: More actionable insights

### 6. Budget Data Integration
- **Current**: Inferred from pipeline
- **Enhancement**: Use actual budget data from Company/Contact
- **Benefit**: More accurate willingness-to-pay scoring

## Usage Examples

### Example 1: Calculate Fit Score

```javascript
import { calculateFitScore } from '@/lib/services/BusinessIntelligenceScoringService';

const result = await calculateFitScore(
  'contact_123',
  'product_456',
  'persona_789' // Optional
);

if (result.success) {
  console.log(`Fit Score: ${result.scores.totalScore}/100`);
  console.log(`Point of Need: ${result.scores.pointOfNeed}/20`);
  console.log(`Summary: ${result.summary}`);
}
```

### Example 2: Find Matching Persona

```javascript
import { findMatchingPersona } from '@/lib/services/BusinessIntelligenceScoringService';

const match = await findMatchingPersona(
  'contact_123',
  'companyHQ_456',
  { returnDetails: true }
);

if (match.personaId) {
  console.log(`Matched: ${match.bestMatch.name}`);
  console.log(`Confidence: ${match.confidence}%`);
}
```

### Example 3: API Call

```javascript
const response = await fetch('/api/business-intelligence/fit-score', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${firebaseToken}`,
  },
  body: JSON.stringify({
    contactId: 'contact_123',
    productId: 'product_456',
  }),
});

const data = await response.json();
console.log(`Fit Score: ${data.scores.totalScore}/100`);
```

## Summary

BD Intelligence is a production-ready AI-powered scoring system that evaluates product-contact fit across 5 dimensions. It uses OpenAI GPT-4o for nuanced reasoning, automatically matches personas, and provides actionable insights for targeted outreach.

**Key Features**:
- ✅ Multi-dimensional scoring (0-100)
- ✅ AI-powered analysis (GPT-4o)
- ✅ Auto persona matching
- ✅ Budget sensitivity inference
- ✅ Full API and UI integration
- ✅ Multi-tenant support

The system is actively used in outreach targeting, proposal selection, and product recommendations, helping users identify the best-fit contacts for their products.

