# Universal Parser System Architecture

## Overview

The Universal Parser System is a scalable, extensible architecture for extracting structured data from raw text using GPT and validating with Zod schemas. Version 1 supports Product Definition parsing, with architecture designed to easily extend to other content types.

## Architecture

### Components

1. **UniversalParserModal** (`src/components/parsers/UniversalParserModal.tsx`)
   - Reusable modal UI component
   - Parser type selection dropdown
   - Raw text and human context textareas
   - Parse button with loading state
   - Preview panel showing extracted fields
   - "Apply to Form" button

2. **universalParser Server Action** (`src/lib/actions/universalParser.ts`)
   - Main entry point: `universalParse()`
   - Loads parser config based on type
   - Builds GPT prompt with raw text + context
   - Calls OpenAI API
   - Validates response with Zod schema
   - Returns parsed data + explanation

3. **typePrompts Mapping** (`src/lib/parsers/typePrompts.ts`)
   - Extensible configuration for all parser types
   - Schema definitions (Zod)
   - System prompts for GPT
   - Field descriptions
   - Easy to add new types: just fill in the mapping

### Integration

**BD Product Definition Page** (`src/app/(authenticated)/products/builder/page.jsx`)
- "AI Parser" button in header
- Opens UniversalParserModal
- `handleParserApply()` maps parsed fields to form using `setValue()`
- Non-breaking: additive feature, doesn't modify existing form behavior

## Data Flow

```
User clicks "AI Parser" button
  ↓
UniversalParserModal opens
  ↓
User selects parser type, pastes raw text, adds context (optional)
  ↓
User clicks "Parse"
  ↓
universalParse() server action:
  - Loads parser config (schema + prompt)
  - Builds GPT prompt
  - Calls OpenAI API
  - Validates with Zod
  ↓
Preview shown in modal
  ↓
User clicks "Apply to Form"
  ↓
handleParserApply() maps fields to form
  ↓
Form fields populated with parsed data
```

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

1. User pastes raw text:
```
Our Business Development Platform helps professional services firms
systematically grow revenue through Attract → Engage → Nurture methodology.
Pricing: $2,000/month recurring. Target: Small businesses (10-99 employees).
Sales cycle: Medium (1-3 months). Delivery: 2-4 weeks setup.
```

2. User adds context (optional):
```
Focus on the value proposition and competitive advantages.
```

3. Parser extracts:
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

4. User reviews preview, clicks "Apply to Form"

5. Form fields automatically populated

## Benefits

- **Time Saving**: Extract structured data from unstructured text
- **Consistency**: Zod validation ensures data quality
- **Extensible**: Easy to add new parser types
- **Non-Breaking**: Additive feature, doesn't modify existing flows
- **User Control**: Preview before applying, optional context
- **Type Safe**: Full TypeScript support

## Future Enhancements

- Batch parsing (multiple items at once)
- Parser history / saved prompts
- Custom schema definitions
- Integration with WorkItem flows
- Multi-language support
- Confidence scores for extracted fields

