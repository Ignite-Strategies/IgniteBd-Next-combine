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
   - **Normalizes data** (trim strings, convert numbers, handle null/undefined)
   - Validates response with Zod schema
   - **Stores result in Redis** with `inputId` (24 hour TTL)
   - Returns parsed data + explanation + `inputId`
   - `getParserResult(inputId)`: Retrieve stored result from Redis

3. **typePrompts Mapping** (`src/lib/parsers/typePrompts.ts`)
   - Extensible configuration for all parser types
   - Schema definitions (Zod)
   - System prompts for GPT
   - Field descriptions
   - Example input/output
   - Temperature and output format config
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
- Implements Field Mapping Contract
- Non-breaking: additive feature, doesn't modify existing form behavior

## ParserConfig Contract

Every parser type must provide a complete `ParserConfig`:

```typescript
export type ParserConfig = {
  schema: ZodSchema<any>;              // Required: Zod schema for validation
  systemPrompt: string;                 // Required: GPT system prompt
  fieldDescriptions: Record<string, string>; // Required: Field descriptions for GPT
  exampleInput?: string;                // Optional: Example raw input
  exampleOutput?: Record<string, any>;  // Optional: Example parsed output
  temperature?: number;                  // Optional: GPT temperature (default: 0.3)
  outputFormat?: "json_object";         // Optional: Output format (default: "json_object")
};
```

**All fields except `exampleInput` and `exampleOutput` are required.**

Example:
```typescript
product_definition: {
  schema: productDefinitionSchema,
  systemPrompt: `You are an extraction engine...`,
  fieldDescriptions: {
    name: 'Product/Service Name',
    valueProp: 'Value Proposition',
    // ... all fields
  },
  exampleInput: `Our Business Development Platform...`,
  exampleOutput: { name: 'Business Development Platform', ... },
  temperature: 0.3,
  outputFormat: 'json_object',
}
```

## Data Normalization Policy

### Normalization — GPT Responsibilities

GPT is responsible for:
- Extracting meaning from raw text
- Mapping data to the correct fields
- Inferring missing fields from context (when appropriate)
- Returning strictly valid JSON matching the schema

### Normalization — Server Responsibilities

The server action (`universalParse`) must:
1. **Trim all strings** - Remove leading/trailing whitespace
2. **Convert numbers to numeric** - Ensure numbers are actual numbers, not strings
3. **Convert numeric strings to numbers** - "2000" → 2000
4. **Convert undefined → null** - Consistent null handling
5. **Ensure arrays are always arrays** - Never allow string representation of arrays
6. **Strip unknown keys** - Only keep keys defined in schema
7. **Validate with Zod** - After normalization, validate structure
8. **Store normalized version in Redis** - Store the validated, normalized data

Implementation in `normalizeParsedData()`:
```typescript
function normalizeParsedData(data: any): any {
  // Trim strings
  // Convert numeric strings to numbers
  // Handle undefined → null
  // Ensure arrays are arrays
  // Recursively normalize nested objects
}
```

### Normalization — Zod Responsibilities

Zod must:
1. **Validate types after normalization** - Ensure final structure is correct
2. **Reject structurally invalid data** - Type mismatches, invalid enums, etc.
3. **Fill defaults for missing optional fields** - Use `.optional()` and `.nullable()`
4. **Guarantee the structure injected into the form is safe** - Type-safe output
5. **Coerce types** - Use `z.coerce.number()` for numeric strings
6. **Handle unions** - Support `z.union([z.string(), z.array(z.string())])` for flexible types

**Critical Rule**: Parser should NEVER reject data because a field is missing. All fields must be optional.

## Field Mapping Contract

### Field Mapping Contract for Apply-to-Form

When `parsedResult` is returned:
- `parsedResult: Record<string, any>`

The mapping rules must be:

1. **If `parsed[key] === null` → skip** (don't set the field)
2. **If `typeof parsed[key] === "number"` → `setValue(name, value.toString())`**
3. **If `Array.isArray(parsed[key])` → `setValue(name, value)`** (keep as array)
4. **If `typeof parsed[key] === "string"` → `setValue(name, value.trim())`**
5. **Unknown keys → ignore silently** (don't break on unexpected fields)
6. **Mapping must never break forms** even if fields are missing

The modal should always pass:
```typescript
onApply(parsedResult, inputId)
```

The parent form injects with a validated mapping layer.

### Example Implementation

```typescript
const handleParserApply = (parsedResult: Record<string, any>, inputId?: string) => {
  // Rule 1: Skip null values
  if (parsedResult.name !== null && parsedResult.name !== undefined) {
    // Rule 4: Trim strings
    setValue('name', typeof parsedResult.name === 'string' 
      ? parsedResult.name.trim() 
      : String(parsedResult.name));
  }
  
  // Rule 2: Convert numbers to strings
  if (parsedResult.price !== null && parsedResult.price !== undefined) {
    if (typeof parsedResult.price === 'number') {
      setValue('price', parsedResult.price.toString());
    } else {
      setValue('price', String(parsedResult.price));
    }
  }
  
  // Rule 3: Keep arrays as arrays
  if (parsedResult.features !== null && parsedResult.features !== undefined) {
    if (Array.isArray(parsedResult.features)) {
      setValue('features', parsedResult.features);
    } else {
      setValue('features', typeof parsedResult.features === 'string' 
        ? parsedResult.features.trim() 
        : String(parsedResult.features));
    }
  }
  
  // Rule 5: Unknown keys are ignored silently
  // Rule 6: Missing fields don't break the form
};
```

## Parser UX Route Contract

### Parser Modal Contract

The parser is a **separate UX flow** that operates independently:

- **Modal opens independently of the form** - Triggered by "Build with AI" button
- **Internally runs full parser UX flow** - Complete workflow within modal
- **Must persist internal state until close** - Raw text, context, parse result all maintained
- **Must return**: `onApply(parsed, inputId)` - Callback with parsed data and inputId

**Decision**: The parser is **modal-only** (not a separate route). The modal encapsulates the entire parser UX flow.

**Contract**:
```typescript
<UniversalParserModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onApply={(parsedResult, inputId) => {
    // Apply to form using Field Mapping Contract
  }}
  defaultType="product_definition"
  companyHqId={companyHqId}
/>
```

## State Flow Diagram

```
[Open Parser UX]
      ↓
[User enters raw text + human context]
      ↓
[Submit to GPT]
      ↓
[Server normalizes + validates + Redis stores]
      ↓
[Preview: parsed JSON + explanation + inputId]
      ↓
[Apply to Form]
      ↓
[Form receives parsedResult]
      ↓
[Modal closes]
```

### Detailed Flow

1. **Open Parser UX**
   - User clicks "Build with AI" button
   - Modal opens with empty state

2. **User enters raw text + human context**
   - User pastes raw text/JSON into textarea
   - User optionally adds human context
   - Parser type selected (default: product_definition)

3. **Submit to GPT**
   - User clicks "Submit to OpenAI"
   - Loading state shown
   - `universalParse()` called with raw + context + type

4. **Server normalizes + validates + Redis stores**
   - GPT processes and returns JSON
   - Server normalizes data (trim, convert types)
   - Zod validates normalized data
   - Result stored in Redis with `inputId`
   - `inputId` format: `parser:{type}:{uuid}`

5. **Preview: parsed JSON + explanation + inputId**
   - Modal shows success/error status
   - JSON blob displayed
   - Explanation shown
   - `inputId` displayed for tracking

6. **Apply to Form**
   - User reviews preview
   - User clicks "Apply to Form"
   - `onApply(parsedResult, inputId)` called
   - Field Mapping Contract applied
   - Form fields populated

7. **Modal closes**
   - State reset
   - Modal dismissed

## inputId Contract

### inputId Format

`inputId` must always follow this format:
```
parser:{type}:{uuid}
```

Examples:
- `parser:product_definition:abc123-def456-ghi789`
- `parser:ecosystem_map:xyz789-abc123-def456`

### inputId Responsibilities

1. **Must be returned by `universalParse`**:
   ```typescript
   return {
     success: true,
     parsed: validationResult.data,
     explanation,
     inputId, // Always included
   };
   ```

2. **Must be passed back to parent with parsedResult**:
   ```typescript
   onApply(parsedResult, inputId)
   ```

3. **Stored in Redis** with this key format
4. **24 hour TTL** - Results expire after 24 hours
5. **Retrievable** via `getParserResult(inputId)`

## Zod Schema Responsibilities

### Zod Schema Rules

1. **All fields must be optional** - Use `.optional()` or `.optional().nullable()`
   - Parser should NEVER reject data because a field is missing
   - Example: `name: z.string().optional().nullable()` (not `.required()`)

2. **Zod should coerce types**:
   - Numbers: `z.coerce.number()` - Converts string numbers to numbers
   - Arrays: `z.array()` or `z.union([z.string(), z.array(z.string())])` - Ensures arrays are arrays
   - Strings: Automatic coercion for most cases

3. **Zod should define the FINAL shape** of the parsed object:
   - The schema is the contract for what gets injected into forms
   - All validation happens against this schema
   - TypeScript types generated from schema

4. **Zod validation errors should return toaster-friendly messages**:
   ```typescript
   if (!validationResult.success) {
     const errorMessages = validationResult.error.errors.map(
       (err) => `${err.path.join('.')}: ${err.message}`
     );
     return {
       success: false,
       error: `Validation failed: ${errorMessages.join('; ')}`,
     };
   }
   ```

### Example Schema

```typescript
export const productDefinitionSchema = z.object({
  name: z.string().max(255).optional().nullable(), // Optional - never rejects
  price: z.coerce.number().min(0).optional().nullable(), // Coerce string to number
  features: z.union([z.string(), z.array(z.string())]).optional().nullable(), // Flexible type
  // ... all fields optional
});
```

## How to Add New Parser Types

### Checklist

To add a new parser type (e.g., `ecosystem_map`):

1. **Create a Zod schema** in `typePrompts.ts`:
   ```typescript
   export const ecosystemMapSchema = z.object({
     // All fields optional
     field1: z.string().optional().nullable(),
     field2: z.coerce.number().optional().nullable(),
     // ...
   });
   ```

2. **Add parser config to `PARSER_PROMPTS`**:
   ```typescript
   ecosystem_map: {
     schema: ecosystemMapSchema,
     systemPrompt: `You are extracting ecosystem map data...`,
     fieldDescriptions: {
       field1: 'Field 1 Description',
       field2: 'Field 2 Description',
     },
     exampleInput: `Example raw input...`,
     exampleOutput: { field1: 'value1', field2: 123 },
     temperature: 0.3,
     outputFormat: 'json_object',
   },
   ```

3. **Add the type to `UniversalParserType`**:
   ```typescript
   export type UniversalParserType =
     | 'product_definition'
     | 'ecosystem_map' // Add here
     | 'event_selection'
     | 'blog'
     | 'generic';
   ```

4. **Add the type to the dropdown in `UniversalParserModal.tsx`**:
   ```typescript
   const PARSER_TYPES = [
     { value: 'product_definition', label: 'Product Definition', available: true },
     { value: 'ecosystem_map', label: 'Ecosystem Map', available: true }, // Add here
     // ...
   ];
   ```

**No other changes** - `universalParser` automatically works with the new type.

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
  - Normalizes response (trim, convert types)
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
handleParserApply() applies Field Mapping Contract
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
  "parsed": { ... normalized, validated fields ... },
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

## Exactly How Apply-to-Form Works

### Step-by-Step Process

1. **User clicks "Apply to Form"** in modal
2. **Modal calls `onApply(parsedResult, inputId)`**
3. **Parent form receives callback**:
   ```typescript
   const handleParserApply = (parsedResult: Record<string, any>, inputId?: string) => {
     // Apply Field Mapping Contract
   };
   ```

4. **Field Mapping Contract applied**:
   - For each key in parsedResult:
     - If null → skip
     - If number → convert to string
     - If array → keep as array
     - If string → trim
     - Unknown keys → ignore

5. **Form fields populated** using `setValue()`:
   ```typescript
   setValue('name', parsedResult.name?.trim() ?? '');
   setValue('price', parsedResult.price?.toString() ?? '');
   setValue('features', Array.isArray(parsedResult.features) 
     ? parsedResult.features 
     : parsedResult.features?.trim() ?? '');
   ```

6. **Form state updated** - User can review and edit
7. **Modal closes** - State reset

### Safety Guarantees

- **Never breaks forms** - Missing fields don't cause errors
- **Type safe** - All values properly converted
- **Null safe** - Null values skipped
- **Unknown key safe** - Extra keys ignored

## Parser Types

### ✅ Implemented (v1)
- **product_definition**: Extracts product/service fields from raw text

### 🔜 Coming Soon (v2+)
- **ecosystem_map**: Extract ecosystem mapping data
- **event_selection**: Extract event information
- **blog**: Extract blog content structure
- **generic**: Generic extraction for custom schemas

## GPT Configuration

- **Model**: `gpt-4o` (configurable via `OPENAI_MODEL` env var)
- **Temperature**: `0.3` (configurable per parser type, default: 0.3)
- **Response Format**: `json_object` (forced JSON output, configurable per type)
- **System Prompt**: Type-specific, includes field descriptions
- **User Prompt**: Raw text + optional human context

## Validation

- **Zod Schema Validation**: All parsed data validated against schema after normalization
- **Type Safety**: TypeScript types generated from Zod schemas
- **Error Handling**: Graceful fallbacks, clear error messages
- **Preview Before Apply**: User sees extracted data before applying
- **User-Friendly Errors**: Zod errors formatted for display in modal

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

5. **Server normalizes and validates**:
   - Trims strings
   - Converts "2000" → 2000 (number)
   - Validates with Zod

6. **Parser extracts and stores in Redis**:
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

7. **Preview shown** with JSON blob and inputId

8. **User clicks "Apply to Form"** → Field Mapping Contract applied → Fields populated → Modal closes

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
- **Normalized Data**: Consistent data structure guaranteed
- **Safe Mapping**: Never breaks forms, handles all edge cases

## Future Enhancements

- Batch parsing (multiple items at once)
- Parser history / saved prompts
- Custom schema definitions
- Integration with WorkItem flows
- Multi-language support
- Confidence scores for extracted fields
- Parser result versioning
- Undo/redo for applied results
