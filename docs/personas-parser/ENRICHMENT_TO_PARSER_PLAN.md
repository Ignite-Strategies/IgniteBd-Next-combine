# Enrichment → Parser Flow - Holistic Plan

## Current State Assessment

### ✅ What Exists (Enrichment System)

#### 1. **Enrichment API** (`/api/enrich/enrich`)
- **Input**: LinkedIn URL
- **Process**: 
  - Calls Apollo `/people/enrich` (deep lookup)
  - Normalizes Apollo response
  - Stores in Redis with key: `apollo:enriched:{linkedinUrl}`
  - TTL: 7 days
- **Output**: 
  - `enrichedProfile`: Normalized contact data
  - `rawApolloResponse`: Full Apollo JSON
  - `redisKey`: Redis key for retrieval
- **Status**: ✅ Working, stores in Redis only (no DB writes)

#### 2. **Enrichment Preview API** (`/api/enrich/preview`)
- **Input**: LinkedIn URL
- **Process**: Calls Apollo `/people/match` (light lookup, no emails/phones)
- **Output**: Preview data (name, title, company, avatar)
- **Status**: ✅ Working

#### 3. **Enrichment UI** (`/contacts/enrich/linkedin`)
- **Features**:
  - LinkedIn URL input
  - Preview button (light lookup)
  - Enrich button (deep lookup)
  - Shows enriched profile
  - Shows raw Apollo JSON
  - Displays Redis key
- **Status**: ✅ Working, standalone page

#### 4. **Redis Storage** (`src/lib/redis.ts`)
- **Functions**:
  - `storeEnrichedContact(linkedinUrl, data, ttl)` - Store enriched data
  - `getEnrichedContact(keyOrLinkedInUrl)` - Retrieve enriched data
  - `listEnrichedContacts()` - List all keys
  - `deleteEnrichedContact(linkedinUrl)` - Delete data
- **Key Format**: `apollo:enriched:{linkedinUrl}`
- **TTL**: 7 days (configurable)
- **Status**: ✅ Working

#### 5. **Apollo Helper** (`src/lib/apollo.ts`)
- **Functions**:
  - `lookupPerson({ linkedinUrl, email })` - Light lookup (preview)
  - `enrichPerson({ linkedinUrl, email })` - Deep enrichment
  - `normalizeApolloResponse(apolloData)` - Normalize to our format
- **Status**: ✅ Working

#### 6. **Persona Generation API** (`/api/personas/generate`)
- **Input**: `redisKey`, `companyHQId`
- **Process**:
  - Gets enriched data from Redis
  - Sends raw Apollo JSON to OpenAI
  - Generates persona JSON
  - **SAVES to database** (creates Persona record)
- **Status**: ✅ Working, but **SAVES directly to DB** (not what we want)

### ❌ What's Missing

1. **Persona Parser Config** - No persona parser in Universal Parser system
2. **Enrichment Modal/UX** - No reusable enrichment component
3. **Enrichment → Parser Bridge** - No way to take enriched data and parse it
4. **"Build from Enrichment" Button** - No button on persona builder
5. **Hydrate-Only Flow** - Current `/api/personas/generate` saves to DB, we need hydrate-only

## Proposed Architecture

### Flow Diagram

```
[Persona Builder Page]
        ↓
[User clicks "Build from Enrichment" button]
        ↓
[EnrichmentModal opens]
        ↓
[User enters LinkedIn URL]
        ↓
[Preview button] → Apollo LOOKUP → Preview shown
        ↓
[Enrich button] → Apollo ENRICH → Enriched data stored in Redis
        ↓
[Enriched data displayed] + [Redis key stored]
        ↓
[User clicks "Parse to Persona" button]
        ↓
[Universal Parser called with type="persona_definition"]
        ↓
[Parser receives enriched data as "raw" input]
        ↓
[GPT extracts persona fields from enriched data]
        ↓
[Parsed result returned + stored in Redis (parser:{type}:{uuid})]
        ↓
[Preview shown in modal]
        ↓
[User clicks "Apply to Form"]
        ↓
[handlePersonaApply() hydrates form fields]
        ↓
[Modal closes]
        ↓
[User reviews and clicks "Save" to persist]
```

### Components Needed

#### 1. **Persona Parser Config** (`src/lib/parsers/configs/persona.ts`)
- **Schema**: Zod schema matching Persona model
- **System Prompt**: Extract persona from enriched Apollo data
- **User Prompt Builder**: Format enriched data as input
- **Normalize Function**: Handle arrays, trim strings, etc.

#### 2. **EnrichmentModal Component** (`src/components/enrichment/EnrichmentModal.tsx`)
- **Props**:
  - `isOpen: boolean`
  - `onClose: () => void`
  - `onApply: (parsedResult, inputId) => void` - Apply parsed data to form
  - `companyHqId: string`
- **Features**:
  - LinkedIn URL input
  - Preview button (light lookup)
  - Enrich button (deep lookup)
  - Shows enriched profile
  - "Parse to Persona" button (calls Universal Parser)
  - Preview parsed result
  - "Apply to Form" button
- **State**:
  - `linkedinUrl: string`
  - `preview: NormalizedContactData | null`
  - `enriched: NormalizedContactData | null`
  - `rawApolloResponse: any | null`
  - `redisKey: string | null`
  - `isEnriching: boolean`
  - `parseResult: UniversalParseResult | null`
  - `isParsing: boolean`

#### 3. **Persona Builder Integration**
- **Add Button**: "Build from Enrichment" button in header
- **Add Handler**: `handleEnrichmentApply(parsedResult, inputId)` - Maps parsed data to form
- **Field Mapping**: Similar to product parser field mapping

#### 4. **Universal Parser Enhancement**
- **Support Enriched Data**: Parser should accept enriched Apollo JSON as "raw" input
- **Persona Type**: Add `persona_definition` to `UniversalParserType`
- **Register Config**: Add persona config to `PARSER_CONFIGS`

## Data Flow Details

### Step 1: Enrichment
```typescript
// User enters LinkedIn URL
linkedinUrl = "https://linkedin.com/in/john-doe"

// Call enrichment API
POST /api/enrich/enrich
{ linkedinUrl }

// Response
{
  success: true,
  enrichedProfile: {
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    title: "CEO",
    companyName: "Example Corp",
    // ... more fields
  },
  rawApolloResponse: { /* full Apollo JSON */ },
  redisKey: "apollo:enriched:https://linkedin.com/in/john-doe"
}
```

### Step 2: Parse Enriched Data
```typescript
// Call Universal Parser with enriched data
universalParse({
  raw: JSON.stringify(rawApolloResponse), // Full Apollo JSON as string
  context: null, // Optional human context
  type: "persona_definition",
  companyHqId: "xxx"
})

// Parser extracts persona fields from Apollo JSON
// Returns parsed persona data
{
  success: true,
  parsed: {
    personName: "John Doe",
    title: "CEO",
    industry: "Technology",
    painPoints: ["...", "..."],
    // ... all persona fields
  },
  inputId: "parser:persona_definition:uuid"
}
```

### Step 3: Apply to Form
```typescript
// Map parsed result to form fields
handleEnrichmentApply(parsedResult, inputId) {
  setValue('personaName', parsedResult.personName ?? '');
  setValue('role', parsedResult.title ?? '');
  setValue('painPoints', Array.isArray(parsedResult.painPoints) 
    ? parsedResult.painPoints.join('\n') 
    : parsedResult.painPoints ?? '');
  // ... map all fields
}
```

## Implementation Checklist

### Phase 1: Documentation & Planning ✅
- [x] Document current enrichment system
- [x] Document proposed architecture
- [x] Create flow diagrams
- [x] Define data contracts

### Phase 2: Persona Parser Config
- [ ] Create `src/lib/parsers/configs/persona.ts`
- [ ] Define Zod schema matching Persona model
- [ ] Write system prompt for extracting persona from Apollo data
- [ ] Write user prompt builder (formats Apollo JSON)
- [ ] Write normalize function (handles arrays, strings)
- [ ] Register in `parserConfigs.ts`

### Phase 3: EnrichmentModal Component
- [ ] Create `src/components/enrichment/EnrichmentModal.tsx`
- [ ] Implement LinkedIn URL input
- [ ] Implement preview button (calls `/api/enrich/preview`)
- [ ] Implement enrich button (calls `/api/enrich/enrich`)
- [ ] Display enriched profile
- [ ] Implement "Parse to Persona" button (calls Universal Parser)
- [ ] Display parsed result preview
- [ ] Implement "Apply to Form" button
- [ ] Handle loading states
- [ ] Handle errors

### Phase 4: Persona Builder Integration
- [ ] Add "Build from Enrichment" button to persona builder
- [ ] Add state for modal open/close
- [ ] Implement `handleEnrichmentApply()` function
- [ ] Map parsed fields to form (personName, title, painPoints, etc.)
- [ ] Test form hydration

### Phase 5: Testing & Refinement
- [ ] Test enrichment flow end-to-end
- [ ] Test parser with various Apollo responses
- [ ] Test form field mapping
- [ ] Verify no database saves (hydrate-only)
- [ ] Test error handling

## Key Design Decisions

### 1. Enrichment Stores in Redis Only
- ✅ **Current**: Enrichment stores in Redis, no DB writes
- ✅ **Keep**: This is correct - enrichment is temporary, parser result is what matters

### 2. Parser Accepts Enriched Data as "Raw"
- **Decision**: Pass `rawApolloResponse` JSON string as `raw` parameter to parser
- **Rationale**: Parser is designed to extract from unstructured data, Apollo JSON is unstructured to the parser
- **Alternative**: Create separate "enriched" parser type (more complex)

### 3. Hydrate-Only, Never Save
- **Decision**: Parser only hydrates form, user must click "Save" to persist
- **Rationale**: Matches product parser pattern, gives user control
- **Current Issue**: `/api/personas/generate` saves directly - needs to be removed or deprecated

### 4. EnrichmentModal vs UniversalParserModal
- **Decision**: Separate modal for enrichment (different UX flow)
- **Rationale**: 
  - Enrichment has preview → enrich → parse → apply flow
  - Universal Parser has raw text → context → parse → apply flow
  - Different enough to warrant separate component

### 5. Redis Key Management
- **Enrichment Key**: `apollo:enriched:{linkedinUrl}` (7 day TTL)
- **Parser Key**: `parser:persona_definition:{uuid}` (24 hour TTL)
- **Decision**: Keep separate - enrichment is source data, parser is extracted data

## Data Contracts

### Enrichment API Response
```typescript
{
  success: boolean;
  enrichedProfile?: NormalizedContactData;
  rawApolloResponse?: ApolloPersonMatchResponse;
  redisKey?: string;
  error?: string;
}
```

### Parser Input (for Persona)
```typescript
{
  raw: string; // JSON.stringify(rawApolloResponse)
  context?: string; // Optional human context
  type: "persona_definition";
  companyHqId: string;
}
```

### Parser Output
```typescript
{
  success: boolean;
  parsed?: {
    personName: string | null;
    title: string | null;
    headline: string | null;
    industry: string | null;
    painPoints: string[] | null;
    // ... all persona fields
  };
  inputId?: string; // parser:persona_definition:uuid
  error?: string;
}
```

### Form Field Mapping
```typescript
// Parsed field → Form field
personName → personaName
title → role (or title?)
headline → headline
industry → industry
painPoints[] → painPoints (join with \n)
whatTheyWant → whatTheyWant
// ... etc
```

## Current Gaps & Questions

### 1. Persona Model Field Mapping
- **Question**: Does `personaName` map to `personName` in form?
- **Question**: Does `title` map to `role` or is there a separate `title` field?
- **Action**: Review persona builder form fields and Prisma model

### 2. Apollo Data Completeness
- **Question**: Does Apollo data have enough info to infer pain points, goals, etc.?
- **Answer**: Probably not - Apollo has basic profile data, GPT will need to infer
- **Action**: Parser prompt should instruct GPT to infer from role, industry, company size

### 3. Existing `/api/personas/generate`
- **Question**: Should we deprecate this or keep it?
- **Decision**: Keep for now, but document that new flow uses Universal Parser
- **Action**: Add deprecation notice or rename to clarify it's the "old way"

### 4. Enrichment UX Location
- **Question**: Should enrichment modal be on persona builder only, or reusable?
- **Decision**: Make it reusable - could be used for product builder too (enrich company → product)
- **Action**: Design as generic component with `onApply` callback

## Next Steps

1. **Review Persona Model** - Confirm field names and types
2. **Create Persona Parser Config** - Add to Universal Parser system
3. **Build EnrichmentModal** - Reusable component for enrichment UX
4. **Add Button to Persona Builder** - Simple "Build from Enrichment" button
5. **Wire Up Flow** - Connect enrichment → parse → apply
6. **Test End-to-End** - Verify hydrate-only behavior

## Success Criteria

✅ User can click "Build from Enrichment" on persona builder  
✅ Enrichment modal opens with LinkedIn URL input  
✅ User can preview and enrich a LinkedIn profile  
✅ Enriched data is stored in Redis  
✅ User can parse enriched data to persona fields  
✅ Parsed data is applied to form (hydrate-only)  
✅ User must click "Save" to persist to database  
✅ No database writes during enrichment or parsing  

