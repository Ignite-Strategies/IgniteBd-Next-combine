# Universal Parser System Architecture

## Overview

The Universal Parser System is a scalable, extensible architecture for extracting structured data from raw text using GPT and validating with Zod schemas. Version 1 supports Product Definition parsing, with architecture designed to easily extend to other content types.

**Key Design**: The parser is a **separate UX flow** - users paste raw text/JSON, add human context, submit to OpenAI, preview the result, then apply to the form. All parsed results are stored in Redis with an `inputId` for tracking and retrieval.

## Architecture

### Components

1. **UniversalParserModal** (`src/components/parsers/UniversalParserModal.tsx`)
   - Separate modal UX (not inline form filling)
   - Parser type selection dropdown
   - **Raw Text Input**: Textarea for pasting raw text, JSON, or facts
   - **Human Context Input**: Optional textarea for editor's notes/context
   - **Submit to OpenAI** button (sends raw + context to GPT)
   - Preview panel showing extracted fields as JSON
   - **Apply to Form** button (injects parsed data into form fields)
   - Displays `inputId` (Redis key) for result tracking

2. **universalParser Server Action** (`src/lib/actions/universalParser.ts`)
   - Main entry point: `universalParse()`
   - Loads parser config based on type
   - Builds GPT prompt with raw text + human context
   - Calls OpenAI API
   - Validates response with Zod schema
   - **Stores result in Redis** with `inputId` (24 hour TTL)
   - Returns parsed data + explanation + `inputId`
   - `getParserResult(inputId)`: Retrieve stored result from Redis

3. **typePrompts Mapping** (`src/lib/parsers/typePrompts.ts`)
   - Extensible configuration for all parser types
   - Schema definitions (Zod)
   - System prompts for GPT
   - Field descriptions
   - Easy to add new types: just fill in the mapping

4. **Redis Storage** (`src/lib/redis.ts`)
   - Stores parsed results with key pattern: `parser:{type}:{uuid}`
   - 24 hour TTL
   - Stores: parsed data, explanation, raw text, context, timestamp
   - Enables result retrieval and tracking

### Integration

**BD Product Definition Page** (`src/app/(authenticated)/products/builder/page.jsx`)
- **"Build with AI"** button in header
- Opens UniversalParserModal (separate UX)
- `handleParserApply(parsedResult, inputId)` maps parsed fields to form using `setValue()`
- Non-breaking: additive feature, doesn't modify existing form behavior

## Data Flow

```
User clicks "Build with AI" button
  ↓
UniversalParserModal opens (separate UX)
  ↓
User selects parser type
  ↓
User pastes raw text/JSON into "Raw Text" textarea
  ↓
User optionally adds "Human Context" (editor's notes)
  ↓
User clicks "Submit to OpenAI"
  ↓
universalParse() server action:
  - Loads parser config (schema + prompt)
  - Builds GPT prompt (raw text + human context)
  - Calls OpenAI API
  - Validates with Zod
  - Stores result in Redis with inputId
  ↓
Preview shown in modal:
  - JSON blob of extracted fields
  - Explanation
  - inputId (Redis key)
  ↓
User reviews preview
  ↓
User clicks "Apply to Form"
  ↓
handleParserApply() maps fields to form using setValue()
  ↓
Form fields populated with parsed data
  ↓
Modal closes
```

## Redis Storage

### Storage Pattern

**Key Format**: `parser:{type}:{uuid}`
- Example: `parser:product_definition:abc123-def456-...`

**Stored Data**:
```json
{
  "type": "product_definition",
  "parsed": { ... extracted fields ... },
  "explanation": "Successfully extracted 13 fields...",
  "rawText": "... original raw text ...",
  "context": "... human context ...",
  "companyHqId": "...",
  "parsedAt": "2024-01-15T10:30:00Z"
}
```

**TTL**: 24 hours (86400 seconds)

### Retrieval

Use `getParserResult(inputId)` to retrieve stored results:
```typescript
const result = await getParserResult('parser:product_definition:abc123...');
```

## UX Flow

### Step 1: Open Modal
- User clicks "Build with AI" button
- Modal opens with empty form

### Step 2: Input Raw Data
- User pastes raw text/JSON into "Raw Text" textarea
- Optional: Add human context for guidance

### Step 3: Submit to OpenAI
- User clicks "Submit to OpenAI" button
- Loading state shown
- GPT processes raw text + context
- Result validated with Zod

### Step 4: Preview Result
- Modal shows:
  - Success/error status
  - Explanation
  - **inputId** (Redis key for tracking)
  - **JSON blob** of extracted fields

### Step 5: Apply to Form
- User reviews preview
- User clicks "Apply to Form"
- Parsed fields injected into form using `setValue()`
- Modal closes

## inputId Tracking

The `inputId` is a unique identifier for each parsing session:
- Format: `parser:{type}:{uuid}`
- Stored in Redis
- Returned in parse result
- Can be used to:
  - Track parsing history
  - Retrieve results later
  - Debug parsing issues
  - Link parsed data to form submissions

## Parser Types

### ✅ Implemented (v1)
- **product_definition**: Extracts product/service fields from raw text

### 🔜 Coming Soon (v2+)
- **ecosystem_map**: Extract ecosystem mapping data
- **event_selection**: Extract event information
- **blog**: Extract blog content structure
- **generic**: Generic extraction for custom schemas

## Adding a New Parser Type

To add a new parser type (e.g., `ecosystem_map`):

1. **Define Zod Schema** in `typePrompts.ts`:
```typescript
export const ecosystemMapSchema = z.object({
  // ... fields
});
```

2. **Add to PARSER_PROMPTS**:
```typescript
ecosystem_map: {
  schema: ecosystemMapSchema,
  systemPrompt: `You are extracting ecosystem map data...`,
  fieldDescriptions: { ... },
},
```

3. **Update PARSER_TYPES** in `UniversalParserModal.tsx`:
```typescript
{ value: 'ecosystem_map', label: 'Ecosystem Map', available: true },
```

That's it! The system automatically handles the rest.

## Field Mapping

The parser extracts data matching the Zod schema. The `handleParserApply()` function maps these fields to form values:

- `name` → `setValue('name', ...)`
- `valueProp` → `setValue('valueProp', ...)`
- `price` → `setValue('price', ...)` (converted to string)
- etc.

All fields are optional - only populated fields are set.

## GPT Configuration

- **Model**: `gpt-4o` (configurable via `OPENAI_MODEL` env var)
- **Temperature**: `0.3` (lower for consistent extraction)
- **Response Format**: `json_object` (forced JSON output)
- **System Prompt**: Type-specific, includes field descriptions
- **User Prompt**: Raw text + optional human context

## Validation

- **Zod Schema Validation**: All parsed data validated against schema
- **Type Safety**: TypeScript types generated from Zod schemas
- **Error Handling**: Graceful fallbacks, clear error messages
- **Preview Before Apply**: User sees extracted data before applying

## Human Context

The "Editor's Notes / Context" field allows users to:
- Guide interpretation ("Focus on pricing model")
- Provide additional context ("This is for enterprise clients")
- Override assumptions ("Price is in CAD, not USD")

The parser uses context to guide extraction but only extracts facts present in raw text.

## Example Usage

1. **User clicks "Build with AI"** → Modal opens

2. **User pastes raw text** into "Raw Text" textarea:
```
Our Business Development Platform helps professional services firms
systematically grow revenue through Attract → Engage → Nurture methodology.
Pricing: $2,000/month recurring. Target: Small businesses (10-99 employees).
Sales cycle: Medium (1-3 months). Delivery: 2-4 weeks setup.
```

3. **User adds human context** (optional):
```
Focus on the value proposition and competitive advantages.
Price is in USD.
```

4. **User clicks "Submit to OpenAI"** → GPT processes

5. **Parser extracts and stores in Redis**:
```json
{
  "name": "Business Development Platform",
  "valueProp": "Systematically grow revenue through Attract → Engage → Nurture methodology",
  "pricingModel": "recurring",
  "price": 2000,
  "priceCurrency": "USD",
  "targetMarketSize": "small-business",
  "salesCycleLength": "medium",
  "deliveryTimeline": "2-4 weeks setup"
}
```

**inputId**: `parser:product_definition:abc123-def456-ghi789`

6. **Preview shown** with JSON blob and inputId

7. **User clicks "Apply to Form"** → Fields populated, modal closes

## Benefits

- **Time Saving**: Extract structured data from unstructured text
- **Consistency**: Zod validation ensures data quality
- **Extensible**: Easy to add new parser types
- **Non-Breaking**: Additive feature, doesn't modify existing flows
- **User Control**: Preview before applying, optional context
- **Type Safe**: Full TypeScript support
- **Redis Storage**: Results stored with inputId for tracking/retrieval
- **Separate UX**: Clean modal flow, not inline form filling
- **JSON Blob Preview**: See exact extracted data before applying

## Future Enhancements

- Batch parsing (multiple items at once)
- Parser history / saved prompts
- Custom schema definitions
- Integration with WorkItem flows
- Multi-language support
- Confidence scores for extracted fields

