# Product Model - Exact Schema for GPT Parser

## Prisma Database Model (Source of Truth)

```prisma
model Product {
  id                    String       @id @default(cuid())
  companyHQId           String       // Required - set by server, not from parser
  name                  String       // Required - Product/service name
  description           String?      // Optional - Full description
  valueProp             String?      // Optional - Value proposition
  price                 Float?       // Optional - Price in base currency
  priceCurrency         String?      @default("USD") // Optional - Currency code (USD, EUR, GBP, CAD)
  pricingModel          String?      // Optional - one-time, recurring, usage-based, freemium, custom
  category              String?      // Optional - Category or type of product/service
  deliveryTimeline      String?      // Optional - How long it takes to deliver
  targetMarketSize      String?      // Optional - enterprise, mid-market, small-business, startup, individual
  salesCycleLength      String?      // Optional - immediate, short, medium, long, very-long
  features              String?      // Optional - Key features (free text)
  competitiveAdvantages String?      // Optional - Competitive advantages (free text)
  targetedTo            String?      // Optional - Persona ID that this product is targeted to
  createdAt             DateTime     @default(now()) // Auto-set by server
  updatedAt             DateTime     @updatedAt      // Auto-set by server
  companyHQ             CompanyHQ    @relation(fields: [companyHQId], references: [id], onDelete: Cascade)
  personas              Persona[]
  productFits           ProductFit[]

  @@map("products")
}
```

## Parser Zod Schema (What GPT Returns)

**File**: `src/lib/parsers/typePrompts.ts`

```typescript
export const productDefinitionSchema = z.object({
  name: z.string().max(255).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  valueProp: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  price: z.coerce.number().min(0).optional().nullable(),
  priceCurrency: z.enum(['USD', 'EUR', 'GBP', 'CAD']).optional().nullable(),
  pricingModel: z.enum(['one-time', 'recurring', 'usage-based', 'freemium', 'custom']).optional().nullable(),
  targetedTo: z.string().optional().nullable(),
  targetMarketSize: z.enum(['enterprise', 'mid-market', 'small-business', 'startup', 'individual']).optional().nullable(),
  salesCycleLength: z.enum(['immediate', 'short', 'medium', 'long', 'very-long']).optional().nullable(),
  deliveryTimeline: z.string().max(100).optional().nullable(),
  features: z.union([z.string(), z.array(z.string())]).optional().nullable(),
  competitiveAdvantages: z.union([z.string(), z.array(z.string())]).optional().nullable(),
});
```

## Exact JSON Structure GPT Must Return

**IMPORTANT**: GPT must return **ONLY** this JSON structure. No markdown, no explanations, just pure JSON.

```json
{
  "name": "string (max 255 chars) | null",
  "category": "string (max 100 chars) | null",
  "valueProp": "string | null",
  "description": "string | null",
  "price": "number (>= 0) | null",
  "priceCurrency": "USD | EUR | GBP | CAD | null",
  "pricingModel": "one-time | recurring | usage-based | freemium | custom | null",
  "targetedTo": "string (Persona ID) | null",
  "targetMarketSize": "enterprise | mid-market | small-business | startup | individual | null",
  "salesCycleLength": "immediate | short | medium | long | very-long | null",
  "deliveryTimeline": "string (max 100 chars) | null",
  "features": "string | string[] | null",
  "competitiveAdvantages": "string | string[] | null"
}
```

## Field-by-Field Specification

### 1. `name` (String, max 255, optional)
- **Database**: `String` (required in DB, but parser can return null)
- **Parser**: `z.string().max(255).optional().nullable()`
- **Example**: `"Business Development Platform"`
- **Rules**: 
  - Extract the product/service name
  - If not found, return `null`
  - Max 255 characters

### 2. `category` (String, max 100, optional)
- **Database**: `String?`
- **Parser**: `z.string().max(100).optional().nullable()`
- **Example**: `"Software"`, `"Consulting"`, `"Training"`
- **Rules**: Type or category of product/service

### 3. `valueProp` (String, optional)
- **Database**: `String?`
- **Parser**: `z.string().optional().nullable()`
- **Example**: `"Systematically grow revenue through Attract → Engage → Nurture methodology"`
- **Rules**: Core value proposition - what specific outcome or benefit does this deliver?

### 4. `description` (String, optional)
- **Database**: `String?`
- **Parser**: `z.string().optional().nullable()`
- **Example**: `"A comprehensive platform that helps professional services firms grow revenue through systematic BD processes."`
- **Rules**: Full description with details about features, use cases, experience

### 5. `price` (Number >= 0, optional)
- **Database**: `Float?`
- **Parser**: `z.coerce.number().min(0).optional().nullable()`
- **Example**: `2000` (not `"2000"` - must be number)
- **Rules**: 
  - Must be a **number**, not a string
  - If price is mentioned as "$2,000" or "2000 USD", extract as `2000`
  - If not mentioned, return `null`
  - Coercion: string numbers like `"2000"` will be converted to `2000`

### 6. `priceCurrency` (Enum, optional)
- **Database**: `String?` (default: "USD")
- **Parser**: `z.enum(['USD', 'EUR', 'GBP', 'CAD']).optional().nullable()`
- **Example**: `"USD"`, `"EUR"`
- **Rules**: 
  - Must be one of: `USD`, `EUR`, `GBP`, `CAD`
  - If price is mentioned but currency isn't, default to `"USD"`
  - If no price mentioned, return `null`

### 7. `pricingModel` (Enum, optional)
- **Database**: `String?`
- **Parser**: `z.enum(['one-time', 'recurring', 'usage-based', 'freemium', 'custom']).optional().nullable()`
- **Example**: `"recurring"`, `"one-time"`
- **Rules**: 
  - Must be one of: `one-time`, `recurring`, `usage-based`, `freemium`, `custom`
  - Map common terms:
    - "monthly", "subscription", "per month" → `"recurring"`
    - "one-time", "single payment" → `"one-time"`
    - "per use", "pay-as-you-go" → `"usage-based"`
    - "free tier", "freemium" → `"freemium"`
    - Other → `"custom"`

### 8. `targetedTo` (String, optional)
- **Database**: `String?` (Persona ID)
- **Parser**: `z.string().optional().nullable()`
- **Example**: `"clx123abc"` (Persona ID)
- **Rules**: 
  - This is a **Persona ID**, not a persona name
  - If a persona is mentioned by name, return `null` (server will handle lookup)
  - If a Persona ID is explicitly mentioned, return it
  - Usually `null` from parser

### 9. `targetMarketSize` (Enum, optional)
- **Database**: `String?`
- **Parser**: `z.enum(['enterprise', 'mid-market', 'small-business', 'startup', 'individual']).optional().nullable()`
- **Example**: `"small-business"`, `"enterprise"`
- **Rules**: 
  - Must be one of: `enterprise`, `mid-market`, `small-business`, `startup`, `individual`
  - Map common terms:
    - "enterprise", "large companies", "Fortune 500" → `"enterprise"`
    - "mid-market", "medium businesses" → `"mid-market"`
    - "small business", "SMB", "10-99 employees" → `"small-business"`
    - "startup", "early-stage" → `"startup"`
    - "individual", "consumer" → `"individual"`

### 10. `salesCycleLength` (Enum, optional)
- **Database**: `String?`
- **Parser**: `z.enum(['immediate', 'short', 'medium', 'long', 'very-long']).optional().nullable()`
- **Example**: `"medium"`, `"short"`
- **Rules**: 
  - Must be one of: `immediate`, `short`, `medium`, `long`, `very-long`
  - Map common terms:
    - "instant", "immediate" → `"immediate"`
    - "1-2 weeks", "quick" → `"short"`
    - "1-3 months", "moderate" → `"medium"`
    - "3-6 months" → `"long"`
    - "6+ months", "extended" → `"very-long"`

### 11. `deliveryTimeline` (String, max 100, optional)
- **Database**: `String?`
- **Parser**: `z.string().max(100).optional().nullable()`
- **Example**: `"2-4 weeks setup"`, `"3 months"`
- **Rules**: 
  - How long it takes to deliver
  - Free text, max 100 characters
  - Examples: "2-4 weeks", "3 months", "1 week implementation"

### 12. `features` (String or Array, optional)
- **Database**: `String?` (stored as text)
- **Parser**: `z.union([z.string(), z.array(z.string())]).optional().nullable()`
- **Example (string)**: `"Feature 1, Feature 2, Feature 3"`
- **Example (array)**: `["Feature 1", "Feature 2", "Feature 3"]`
- **Rules**: 
  - Can be returned as a **string** (comma-separated, newline-separated, or paragraph)
  - Can be returned as an **array of strings** (each feature is a separate string)
  - Server will normalize: arrays → joined with newlines, strings → kept as-is
  - Database stores as single string field

### 13. `competitiveAdvantages` (String or Array, optional)
- **Database**: `String?` (stored as text)
- **Parser**: `z.union([z.string(), z.array(z.string())]).optional().nullable()`
- **Example (string)**: `"Unique methodology, Proven track record"`
- **Example (array)**: `["Unique methodology", "Proven track record"]`
- **Rules**: 
  - Same as `features` - can be string or array
  - What makes this unique or better than alternatives
  - Server normalizes before storing

## GPT Prompt Instructions (Current)

**Current system prompt** (from `typePrompts.ts`):

```
You are an extraction engine for product/service definitions.

Your task is to extract structured product information from raw text and return it as JSON matching the exact schema provided.

Field meanings:
- name: Product or service name (required)
- category: Type of product/service (e.g., Software, Consulting, Training)
- valueProp: Core value proposition - what specific outcome or benefit does this deliver?
- description: Full description with details about features, use cases, experience
- price: Numeric price amount (if mentioned)
- priceCurrency: Currency code (USD, EUR, GBP, CAD) - default to USD if price mentioned
- pricingModel: How it's priced (one-time, recurring, usage-based, freemium, custom)
- targetedTo: Persona ID if mentioned (leave null)
- targetMarketSize: Target company size (enterprise, mid-market, small-business, startup, individual)
- salesCycleLength: Typical sales cycle (immediate, short, medium, long, very-long)
- deliveryTimeline: How long to deliver (e.g., "2-4 weeks", "3 months")
- features: Key features and capabilities (bullet points or list)
- competitiveAdvantages: What makes this unique or better than alternatives

Rules:
1. Extract only facts from the raw text - do not invent information
2. If a field is not mentioned, return null or empty string
3. For optional fields, only include if there's clear evidence in the text
4. Price should be a number (not a string)
5. Features and competitiveAdvantages can be formatted as bullet points or paragraphs
6. Follow the exact enum values for select fields
7. If human context is provided, use it to guide interpretation but don't invent data
8. Return strictly valid JSON matching the schema structure

Return ONLY valid JSON matching the schema. No markdown, no explanations, just JSON.
```

## Example Input → Output

### Input Text:
```
Our Business Development Platform helps professional services firms
systematically grow revenue through Attract → Engage → Nurture methodology.
Pricing: $2,000/month recurring. Target: Small businesses (10-99 employees).
Sales cycle: Medium (1-3 months). Delivery: 2-4 weeks setup.
```

### Expected GPT Output:
```json
{
  "name": "Business Development Platform",
  "valueProp": "Systematically grow revenue through Attract → Engage → Nurture methodology",
  "pricingModel": "recurring",
  "price": 2000,
  "priceCurrency": "USD",
  "targetMarketSize": "small-business",
  "salesCycleLength": "medium",
  "deliveryTimeline": "2-4 weeks setup",
  "description": null,
  "category": null,
  "targetedTo": null,
  "features": null,
  "competitiveAdvantages": null
}
```

## Database → Form Mapping

When parser result is applied to form (`products/builder/page.jsx`):

| Parser Field | Form Field | Transformation |
|-------------|------------|----------------|
| `name` | `name` | Direct (string) |
| `category` | `category` | Direct (string) |
| `valueProp` | `valueProp` | Direct (string) |
| `description` | `description` | Direct (string) |
| `price` | `price` | `number.toString()` (form expects string) |
| `priceCurrency` | `priceCurrency` | Direct (string enum) |
| `pricingModel` | `pricingModel` | Direct (string enum) |
| `targetedTo` | `targetedTo` | Direct (string - Persona ID) |
| `targetMarketSize` | `targetMarketSize` | Direct (string enum) |
| `salesCycleLength` | `salesCycleLength` | Direct (string enum) |
| `deliveryTimeline` | `deliveryTimeline` | Direct (string) |
| `features` | `features` | Array → `array.join('\n')`, String → direct |
| `competitiveAdvantages` | `competitiveAdvantages` | Array → `array.join('\n')`, String → direct |

## Key Constraints

1. **All fields are optional** - Parser should NEVER reject data because a field is missing
2. **Price must be number** - Not a string, use `z.coerce.number()` for coercion
3. **Enums are strict** - Must match exact values, no variations
4. **Features/Advantages flexible** - Can be string or array, server normalizes
5. **Max lengths enforced** - `name` (255), `category` (100), `deliveryTimeline` (100)
6. **Null handling** - If field not found, return `null` (not empty string, not omitted)
7. **JSON only** - GPT must return pure JSON, no markdown formatting

## Server-Side Normalization

After GPT returns data, server normalizes:

1. **Trim strings**: All string values are trimmed
2. **Convert numbers**: Numeric strings → numbers (e.g., `"2000"` → `2000`)
3. **Convert undefined → null**: Ensure consistent null handling
4. **Normalize arrays**: Features/advantages arrays → joined with newlines for storage
5. **Strip unknown keys**: Only keep keys that exist in schema

## Validation Flow

1. **GPT returns JSON** → Raw parsed data
2. **Server normalizes** → Trim, coerce, convert types
3. **Zod validates** → Schema validation (all fields optional, so never rejects)
4. **Form applies** → Field mapping contract applies parsed data to form
5. **User saves** → Form data saved to database

## Notes

- **`companyHQId`**: Set by server, never from parser
- **`id`**: Auto-generated by database, never from parser
- **`createdAt`/`updatedAt`**: Auto-set by database, never from parser
- **`targetedTo`**: Usually `null` from parser (Persona ID lookup happens elsewhere)
- **Features/Advantages**: Stored as text in DB, but parser can return array for better structure

