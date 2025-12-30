# AI Generation for Template Analysis

## Current Flow: Input → Output (JSON) → Parser → Frontend → Save

## 1. INPUT

Three different endpoints accept input:

### A. `/api/templates/generate-ai`
**Request:**
```javascript
{
  title?: string,
  subject?: string,
  body?: string,
  templateId?: string,
  ownerId: string
}
```

### B. `/api/template/generate-quick`
**Request:**
```javascript
{
  idea: string,
  ownerId: string
}
```

### C. `/api/template/generate-relationship-aware`
**Request:**
```javascript
{
  relationship: string,
  typeOfPerson: string,
  whyReachingOut: string,
  whatWantFromThem?: string,
  timeSinceConnected?: string,
  timeHorizon?: string,
  knowledgeOfBusiness: boolean,
  myBusinessDescription?: string,
  desiredOutcome?: string,
  contextNotes?: string,
  ownerId: string
}
```

## 2. OUTPUT (JSON) - How OpenAI is Currently Instructed

### ❌ PROBLEM: Inconsistent JSON Format Specifications

#### Endpoint A: `/api/templates/generate-ai`
**Prompt says:**
```
=== OUTPUT FORMAT ===
Return ONLY valid JSON in this exact format:
{
  "title": "Simple descriptive title that infers variables",
  "subject": "Simple subject line WITHOUT variables (e.g., 'Reaching Out', 'Reconnecting', 'Collaboration in 2026')",
  "body": "Email body content with {{variables}} like {{firstName}}, {{companyName}}, etc."
}
```
✅ **GOOD**: Uses `body` (matches template model)

#### Endpoint B: `/api/template/generate-quick`
**Prompt says:**
```
Return ONLY valid JSON in this exact format:
{
  "title": "Simple descriptive title that infers variables (e.g., 'Collaboration Outreach to Old Colleague')",
  "content": "The email template with {{variableName}} tags",  ❌ WRONG FIELD NAME
  "subject": "Simple, human subject line WITHOUT variables (e.g., 'Reaching Out', 'Reconnecting', 'Collaboration in 2026')",
  "inferred": { ... },  ❌ EXTRA FIELDS
  "suggestedVariables": ["firstName", "companyName", etc.]  ❌ EXTRA FIELDS
}
```
❌ **BAD**: Uses `content` instead of `body`, includes extra fields

#### Endpoint C: `/api/template/generate-relationship-aware`
**Prompt says:**
```
Return ONLY valid JSON in this exact format:
{
  "title": "Simple descriptive title that infers variables (e.g., 'Collaboration Outreach to Old Colleague')",
  "subject": "Simple subject line WITHOUT variables (e.g., 'Reaching Out', 'Reconnecting', 'Collaboration in 2026')",
  "content": "The email body template with {{variableName}} tags for dynamic content",  ❌ WRONG FIELD NAME
  "suggestedVariables": ["firstName", "companyName", etc.]  ❌ EXTRA FIELDS
}
```
❌ **BAD**: Uses `content` instead of `body`, includes extra fields

### OpenAI Configuration (All Endpoints)
```javascript
const completion = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    {
      role: 'system',
      content: 'You are a helpful assistant that creates email templates with variable tags. Return only valid JSON.',
    },
    {
      role: 'user',
      content: prompt,
    },
  ],
  response_format: { type: 'json_object' },  // ✅ JSON-only output
  temperature: 0.7,
});
```

## 3. PARSER

### Current Parser Logic (Inconsistent)

#### Endpoint A: `/api/templates/generate-ai`
```javascript
// Uses normalizeTemplateResponse from lib/templateNormalizer.js
normalized = normalizeTemplateResponse(parsed);

// Returns:
{
  success: true,
  title: normalized.title,
  subject: normalized.subject,
  body: normalized.body,  // ✅ Correct field name
  template: normalized.body,  // Backward compatibility
  variables: allVariables,
}
```

#### Endpoint B: `/api/template/generate-quick`
```javascript
// Expects parsed.content (from prompt)
let templateContent = parsed.content;  // ❌ Wrong field name in prompt

// Returns:
{
  success: true,
  template: templateContent,  // ❌ Field name mismatch
  title: title,
  subject: subject,
  inferred: parsed.inferred || {},
  variables: allVariables,
}
```

#### Endpoint C: `/api/template/generate-relationship-aware`
```javascript
// Expects parsed.content (from prompt)
let templateContent = parsed.content;  // ❌ Wrong field name in prompt

// Returns:
{
  success: true,
  title: title.trim(),
  subject: subject.trim(),
  body: templateContent.trim(),  // ✅ Maps content to body
  template: templateContent.trim(),  // Backward compatibility
  variables: allVariables,
}
```

## 4. FRONTEND

### How Frontend Handles Responses

#### Quick Page (`/templates/create/ai/quick/page.jsx`)
```javascript
if (response.data?.success && response.data?.template) {
  const templateBody = response.data.template || '';  // ❌ Uses 'template' field
  const subject = response.data.subject || 'Reaching Out';
  const title = response.data.title || 'AI Generated Template';
  
  // Navigate with query params
  router.push(`/builder/template/new?title=${title}&subject=${subject}&body=${templateBody}`);
}
```

#### Relationship Page (`/templates/create/ai/relationship/page.jsx`)
```javascript
if (response.data?.success && response.data?.body) {
  const params = new URLSearchParams({
    title: response.data.title || '',
    subject: response.data.subject || '',
    body: response.data.body || response.data.template || '',  // ✅ Uses body
  });
  router.push(`/builder/template/new?${params.toString()}`);
}
```

#### Template Builder (`/builder/template/[templateId]/page.jsx`)
```javascript
// useEffect reads query params
const titleParam = searchParams?.get('title');
const subjectParam = searchParams?.get('subject');
const bodyParam = searchParams?.get('body');

// Sets state
setTitle(titleParam || '');
setSubject(subjectParam || '');
setBody(bodyParam || '');
```

## 5. SAVE

```javascript
const data = {
  companyHQId,
  ownerId,
  title: title.trim(),
  subject: subject.trim(),
  body: body.trim(),  // ✅ Template model uses 'body'
};

await api.post('/api/templates', data);
```

---

## ❌ CURRENT PROBLEMS

1. **Inconsistent Field Names**: 
   - Prompts ask for `content`, but template model uses `body`
   - Frontend sometimes expects `template`, sometimes `body`

2. **Extra Fields in Prompts**:
   - `generate-quick` asks for `inferred` and `suggestedVariables`
   - `generate-relationship-aware` asks for `suggestedVariables`
   - These fields aren't needed if we're just returning `{ title, subject, body }`

3. **Parser Complexity**:
   - Different endpoints parse differently
   - Field name mapping (content → body) adds complexity

4. **Frontend Confusion**:
   - Quick page expects `template` field
   - Relationship page expects `body` field
   - Inconsistency causes bugs

---

## ✅ WHAT WE SHOULD DO (Like Blog Generation)

### Unified JSON Format Specification

All three endpoints should use this EXACT prompt format:

```
=== OUTPUT FORMAT ===
CRITICAL: Return ONLY valid JSON in this exact format:
{
  "title": "Simple descriptive title that infers variables",
  "subject": "Simple subject line WITHOUT variables (e.g., 'Reaching Out', 'Reconnecting', 'Collaboration in 2026')",
  "body": "Email body content with {{variables}} like {{firstName}}, {{companyName}}, etc."
}

CRITICAL: Return ONLY the JSON object. Do not include markdown code blocks, explanations, or any text outside the JSON object.
```

### Unified Parser

All endpoints should parse the same way:
```javascript
const parsed = JSON.parse(responseText);
// Validate
if (!parsed.title || !parsed.subject || !parsed.body) {
  throw new Error('Missing required fields');
}

// Return unified format
return {
  success: true,
  title: parsed.title.trim(),
  subject: parsed.subject.trim(),
  body: parsed.body.trim(),
};
```

### Unified Frontend Response Handling

All pages should expect the same format:
```javascript
if (response.data?.success && response.data?.body) {
  const { title, subject, body } = response.data;
  // Use these fields consistently
}
```

---

## Key Takeaway

**If we're not telling OpenAI specifically how we want the JSON returned, we're going to get junk.**

The blog generation works because:
1. It specifies the EXACT JSON structure in the prompt
2. It uses "CRITICAL" and "MUST" to emphasize the format
3. It uses `response_format: { type: 'json_object' }`
4. It has a robust parser that handles edge cases
5. It validates and normalizes before returning to frontend

Template generation should follow the same pattern with a unified `{ title, subject, body }` format.

