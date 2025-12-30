# Persona Minimal Service - Deep Dive Analysis

## Overview
This document analyzes the PersonaMinimalService architecture and how it matches the TemplateAIGeneratorService pattern for consistency.

## Architecture Flow

### 1. **PersonaPromptPrepService** (`lib/services/PersonaPromptPrepService.ts`)
**Purpose**: Fetches required data from database
- Fetches `contact` by `contactId` from Prisma
- Fetches `companyHQ` by `companyHQId` from Prisma
- Returns structured `PreparedData` object
- Handles errors gracefully

**Input**:
```typescript
{
  contactId: string;
  companyHQId: string;
}
```

**Output**:
```typescript
{
  success: boolean;
  data?: {
    contact: {
      firstName?: string;
      lastName?: string;
      title?: string;
      companyName?: string;
      companyIndustry?: string;
    } | null;
    companyHQ: {
      companyName: string;
      companyIndustry?: string;
      whatYouDo?: string;
    };
  };
  error?: string;
}
```

### 2. **PersonaMinimalPromptService** (`lib/services/PersonaMinimalPromptService.ts`)
**Purpose**: Builds explicit AI prompts matching TemplateAIGeneratorService pattern

#### System Prompt
```
You are a deterministic business persona generator. You MUST strictly follow all formatting and content rules. If any rule conflicts, prioritize JSON correctness and rule compliance over writing quality. Return only valid JSON. Never include markdown code blocks, explanations, or any text outside the JSON object.
```

**Key Characteristics**:
- ✅ Deterministic and strict (matches template service)
- ✅ Prioritizes JSON correctness
- ✅ Explicit about no markdown/explanations

#### User Prompt Structure
```
=== COMPANY CONTEXT ===
[Company details]

=== CONTACT INFORMATION === (if available)
[Contact details]

=== YOUR TASK ===
[Clear task description]

=== OUTPUT FORMAT ===
[Explicit JSON schema]

=== REQUIREMENTS ===
[Detailed field requirements]

=== EXAMPLES ===
[Concrete examples]
```

**Key Characteristics**:
- ✅ Explicit section headers (matches template service)
- ✅ Clear output format specification
- ✅ Detailed requirements per field
- ✅ Concrete examples
- ✅ Multiple "CRITICAL" markers for important rules

#### Expected JSON Response
```json
{
  "personName": "string (role archetype, e.g., 'Compliance Manager')",
  "title": "string (job title/role, e.g., 'Deputy Counsel')",
  "company": "string (company name or type, e.g., 'X Firm')",
  "coreGoal": "string (one sentence describing their main goal/north star)"
}
```

**Field Specifications**:

1. **personName**:
   - Must be a role archetype
   - NEVER use actual contact's name
   - Should reflect function/role type
   - Example: "Compliance Manager", "Operations Director"

2. **title**:
   - Job title/role
   - Can be more specific than personName
   - Should reflect actual or inferred title
   - Example: "Deputy Counsel", "Operations Director at TechCorp"

3. **company**:
   - Company name or company type/archetype
   - Use actual name if available, otherwise infer type
   - Example: "X Firm", "Mid-size Asset Manager"

4. **coreGoal**:
   - Main goal/north star (one sentence)
   - Role/industry-appropriate
   - Actionable and specific
   - Example: "Ensure regulatory compliance while minimizing operational overhead and legal risk."

### 3. **PersonaParsingService** (`lib/services/PersonaParsingService.ts`)
**Purpose**: Parses and validates OpenAI response

**Validation Pattern** (matches TemplateAIGeneratorService):
```typescript
// 1. Parse JSON (with markdown fallback)
// 2. Validate each required field exists and is correct type
// 3. Trim all string values
// 4. Return validated object
```

**Validation Checks**:
- ✅ `personName` exists and is string
- ✅ `title` exists and is string
- ✅ `company` exists and is string
- ✅ `coreGoal` exists and is string
- ✅ All values trimmed

### 4. **API Route** (`app/api/personas/generate-minimal/route.ts`)
**Flow**:
1. Authenticate (verifyFirebaseToken)
2. Validate input (contactId, companyHQId required)
3. **Prep**: Fetch data from DB
4. **Prompt**: Build prompts
5. **Generate**: Call OpenAI with `response_format: { type: 'json_object' }`
6. **Parse**: Validate and parse response
7. Return persona

**OpenAI Configuration**:
```typescript
{
  model: 'gpt-4o' (or from env),
  temperature: 0.7,
  response_format: { type: 'json_object' }, // CRITICAL: Forces JSON
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]
}
```

## Comparison with TemplateAIGeneratorService

| Aspect | TemplateAIGeneratorService | PersonaMinimalPromptService | Match |
|--------|---------------------------|----------------------------|-------|
| System Prompt | Deterministic, JSON-focused | Deterministic, JSON-focused | ✅ |
| User Prompt Structure | Explicit sections with `===` | Explicit sections with `===` | ✅ |
| Output Format Spec | Explicit JSON schema in prompt | Explicit JSON schema in prompt | ✅ |
| Examples | Concrete examples provided | Concrete examples provided | ✅ |
| Response Format | `{ type: 'json_object' }` | `{ type: 'json_object' }` | ✅ |
| Validation | Field-by-field validation | Field-by-field validation | ✅ |
| Error Handling | Markdown fallback parsing | Markdown fallback parsing | ✅ |
| Temperature | 0.7 | 0.7 | ✅ |
| Model | gpt-4o | gpt-4o (or env) | ✅ |

## Key Improvements Made

1. **Explicit System Prompt**: Changed from generic "expert" to deterministic generator with strict rules
2. **Structured User Prompt**: Added explicit sections matching template service pattern
3. **Detailed Field Specs**: Each field has clear requirements and examples
4. **Validation**: Added field-by-field validation matching template service
5. **Error Messages**: Specific error messages for each validation failure
6. **Response Format**: Explicitly using `json_object` format (already was, but now documented)

## Expected Model Behavior

With `response_format: { type: 'json_object' }`, the model is **guaranteed** to return valid JSON. The prompt structure ensures:

1. **Deterministic Output**: System prompt prioritizes correctness over creativity
2. **Structured Response**: Explicit JSON schema in user prompt
3. **Field Completeness**: Requirements section ensures all fields are populated
4. **Type Safety**: Validation ensures all fields are strings

## Testing Checklist

- [ ] Contact with all fields populated
- [ ] Contact with missing fields (firstName, lastName, etc.)
- [ ] Contact with no company information
- [ ] CompanyHQ with all fields
- [ ] CompanyHQ with missing fields
- [ ] OpenAI returns valid JSON
- [ ] OpenAI returns nested JSON (persona wrapper)
- [ ] OpenAI returns flat JSON
- [ ] OpenAI wraps in markdown (fallback parsing)
- [ ] Validation catches missing fields
- [ ] Validation catches wrong types
- [ ] All string values are trimmed

## Next Steps

1. ✅ Service architecture matches template pattern
2. ✅ Prompts are explicit and deterministic
3. ✅ Validation matches template service
4. ⏳ Test with various contact/company combinations
5. ⏳ Monitor OpenAI response quality
6. ⏳ Adjust temperature if needed (currently 0.7)

