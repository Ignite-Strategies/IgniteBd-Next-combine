# Persona OpenAI Prompting Documentation

**Date:** 2025-12-30  
**Service:** `PersonaMinimalPromptService`  
**Purpose:** Document exactly how we prompt OpenAI to generate minimal personas

---

## Overview

We use a two-prompt system:
1. **System Prompt**: Sets the AI's role and behavior constraints
2. **User Prompt**: Provides context and specific task instructions

---

## System Prompt

```
You are a deterministic business persona generator. You MUST strictly follow all formatting and content rules. If any rule conflicts, prioritize JSON correctness and rule compliance over writing quality. Return only valid JSON. Never include markdown code blocks, explanations, or any text outside the JSON object.
```

**Key Points:**
- Emphasizes determinism and rule-following
- Prioritizes JSON correctness over writing quality
- Explicitly forbids markdown code blocks or explanations
- Must return ONLY valid JSON

---

## User Prompt Structure

### 1. Context Sections

The user prompt includes:

#### Company Context (CRM)
```
=== COMPANY CONTEXT (CRM) ===
Company Name: [companyHQ.companyName]
Industry: [companyHQ.companyIndustry || 'Not specified']
What We Do: [companyHQ.whatYouDo || 'Not specified']
```

#### Contact Information (if available)
```
=== CONTACT INFORMATION ===
Name: [contact.firstName + contact.lastName || 'Not specified']
Title: [contact.title || 'Not specified']
Company: [contactCompany?.companyName || contact.companyName || 'Not specified']
Industry: [contactCompany?.industry || contact.companyIndustry || 'Not specified']
```

**Data Priority:**
- Uses `contactCompany` (Contact's Company record) if available
- Falls back to `contact.companyName` if no Company record
- Uses `contactCompany.industry` if available, otherwise `contact.companyIndustry`

---

### 2. Task Definition

```
=== YOUR TASK ===
Generate a minimal persona with just the essentials:
1. **personName**: A clear identifier/archetype (e.g., "Compliance Manager", "Deputy Counsel", "Operations Director")
   - Should be a role archetype, NOT the actual person's name
   - Should reflect their function/role type
2. **title**: Their job title/role (e.g., "Deputy Counsel", "Compliance Manager at X Firm")
   - Can be more specific than personName
   - Should reflect their actual or inferred title
3. **company**: Company name or company type/archetype (e.g., "X Firm", "Mid-size Asset Manager", "B2B SaaS Company")
   - Use actual company name if available, otherwise infer type
4. **coreGoal**: Their main goal/north star
   - MUST be exactly ONE sentence
   - NO bullet points, NO semicolons
   - Maximum ~25 words
   - Should be a single, clear statement of their primary objective
   - Should be role/industry-appropriate
   - Should be actionable and specific
```

---

### 3. Output Format Specification

```
=== OUTPUT FORMAT ===
CRITICAL: Return ONLY valid JSON in this exact format:
{
  "personName": "string (role archetype, e.g., 'Compliance Manager')",
  "title": "string (job title/role, e.g., 'Deputy Counsel')",
  "company": "string (company name or type, e.g., 'X Firm')",
  "coreGoal": "string (one sentence describing their main goal/north star)"
}
```

---

### 4. Priority Rules

```
=== PRIORITY RULES (CRITICAL) ===
1. **Data Precedence**: If real contact or company data is provided, it MUST be used exactly as provided
   - NEVER replace provided factual data with inferred data
   - NEVER use archetyping when real data exists
   - Inference or archetyping is allowed ONLY when data is missing or incomplete
   - Example: If contact title is "Deputy Counsel", use "Deputy Counsel" - do NOT infer "Legal Manager"

2. **personName Semantics (CRITICAL)**:
   - personName MUST be a role archetype label (e.g., "Compliance Manager", "Operations Director")
   - NEVER use a real person's name (e.g., "John Smith" is INVALID)
   - NEVER imply a specific individual
   - Always return a role/archetype label that represents the function, not the person
```

---

### 5. Requirements

```
=== REQUIREMENTS ===
1. **personName**: Must be a role archetype label, NEVER the actual contact's name or any individual identifier
2. **title**: MUST use the contact's actual title if provided in context. Only infer if title is missing or "Not specified"
3. **company**: MUST use the actual company name from context if provided. Only infer company type if company name is missing or "Not specified"
4. **coreGoal**: 
   - MUST be exactly ONE sentence
   - NO bullet points
   - NO semicolons
   - Maximum ~25 words
   - Specific to their role and industry context
5. **All fields required**: Every field must have a non-empty string value
6. **Be specific**: Avoid generic placeholders - use the context to infer realistic values when data is missing
```

---

### 6. Examples

```
=== EXAMPLES ===

If contact is "John Smith, Deputy Counsel at X Firm":
{
  "personName": "Compliance Manager",
  "title": "Deputy Counsel",
  "company": "X Firm",
  "coreGoal": "Ensure regulatory compliance while minimizing operational overhead and legal risk."
}

If contact is "Jane Doe, Operations Director at TechCorp":
{
  "personName": "Operations Director",
  "title": "Operations Director",
  "company": "TechCorp",
  "coreGoal": "Streamline operational processes to improve efficiency and reduce costs while maintaining quality standards."
}
```

---

## OpenAI API Call Configuration

```typescript
const completion = await openai.chat.completions.create({
  model: process.env.OPENAI_MODEL || 'gpt-4o',
  temperature: 0.7,
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ],
  response_format: { type: 'json_object' },
});
```

**Key Settings:**
- **Model**: `gpt-4o` (default) or from `OPENAI_MODEL` env var
- **Temperature**: `0.7` (balanced creativity/consistency)
- **Response Format**: `{ type: 'json_object' }` - Forces JSON output
- **Messages**: System prompt + user prompt

---

## Data Flow

### Input Data (from PersonaPromptPrepService)

```typescript
{
  contact: {
    // Full Contact record from database
    firstName: string,
    lastName: string,
    title: string,
    companyName: string,
    companyIndustry: string,
    // ... all other Contact fields
  },
  contactCompany: {
    // Full Company record (if contactCompanyId exists)
    companyName: string,
    industry: string,
    // ... all other Company fields
  } | null,
  companyHQ: {
    // Full CompanyHQ record (CRM context)
    companyName: string,
    companyIndustry: string,
    whatYouDo: string,
    // ... all other CompanyHQ fields
  }
}
```

### Prompt Construction

1. **Extract contact info**:
   - Full name: `contact.firstName + contact.lastName`
   - Title: `contact.title`
   - Company: `contactCompany?.companyName || contact.companyName`
   - Industry: `contactCompany?.industry || contact.companyIndustry`

2. **Extract companyHQ info**:
   - Company Name: `companyHQ.companyName`
   - Industry: `companyHQ.companyIndustry`
   - What We Do: `companyHQ.whatYouDo`

3. **Build context sections** with `===` headers for clarity

4. **Include all rules, requirements, and examples**

### Expected Output

```json
{
  "personName": "Compliance Manager",
  "title": "Deputy Counsel",
  "company": "X Firm",
  "coreGoal": "Ensure regulatory compliance while minimizing operational overhead and legal risk."
}
```

---

## Critical Rules Summary

1. **Factual Data First**: Always use real data when available
2. **personName is Archetype**: Never use real person's name
3. **coreGoal is One Sentence**: No bullets, semicolons, max ~25 words
4. **JSON Only**: No markdown, no explanations
5. **All Fields Required**: Every field must be non-empty string

---

## Prompt Engineering Principles

1. **Explicit > Implicit**: Every rule is stated clearly
2. **Examples > Instructions**: Concrete examples show expected output
3. **Constraints > Suggestions**: "MUST" and "NEVER" language
4. **Structure > Flexibility**: Clear sections with `===` headers
5. **Determinism > Creativity**: Prioritize consistency over novelty

---

## Response Parsing

The response is parsed by `PersonaParsingService.parse()`:

1. **JSON.parse()** - Strict parsing, no markdown extraction
2. **Field validation** - Checks each required field exists and is a string
3. **Trim values** - All strings are trimmed
4. **Error on failure** - Throws descriptive errors if validation fails

---

## Notes

- The prompt is designed to be **deterministic** - same input should produce similar output
- **Temperature 0.7** allows some variation while maintaining consistency
- **response_format: json_object** forces JSON output (OpenAI feature)
- All data comes from **full database records** - no reshaping or inference in the service layer

