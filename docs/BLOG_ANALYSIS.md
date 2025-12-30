# Blog Generation Analysis

## How Blog Generation Works

### Input → Output (JSON) → Parser → Frontend → Save

## 1. INPUT

**Endpoint:** `POST /api/workme/blog/ai`

**Request Body:**
```typescript
{
  mode: 'idea' | 'persona',
  idea?: string,        // For idea mode
  topic?: string,       // For persona mode
  targetLength?: string,
  personaId?: string,
  // ... other fields
}
```

## 2. OUTPUT (JSON) - How OpenAI is Instructed

### Critical: Exact JSON Structure Specification

The prompt **explicitly defines** the exact JSON structure OpenAI must return:

```typescript
4. JSON Structure - CRITICAL:
You MUST return JSON matching this exact structure:
{
  "title": "Compelling blog title (ONLY the title, max 100 characters)",
  "subtitle": "Optional subtitle providing context (max 150 characters)",
  "outline": {
    "sections": [
      {
        "heading": "Section heading",
        "bullets": ["bullet point 1", "bullet point 2"]
      }
    ]
  },
  "body": {
    "sections": [
      {
        "heading": "Section heading",
        "content": "First paragraph text here.\n\nSecond paragraph text here.\n\nThird paragraph text here."
      }
    ]
  },
  "summary": "Optional brief summary",
  "cta": "Call to action text"
}
```

### Critical Instructions

1. **Explicit Structure**: Shows the EXACT JSON format with all fields
2. **Field Rules**: Each field has specific rules (max length, format, etc.)
3. **CRITICAL Statement**: "CRITICAL: Return ONLY valid JSON. Do not include markdown code blocks, explanations, or any text outside the JSON object."

### OpenAI Configuration

```typescript
const completion = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'user', content: prompt },
  ],
  response_format: { type: 'json_object' },  // ✅ JSON-only output
  temperature: 0.7,
});
```

## 3. PARSER

### Robust Parsing with Validation

```typescript
let blogDraft: BlogDraft;
try {
  // Clean response text - remove markdown code blocks if present
  let cleanedText = responseText.trim();
  if (cleanedText.startsWith('```json')) {
    cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  cleanedText = cleanedText.trim();
  
  const parsed = JSON.parse(cleanedText);
  
  // Validation and normalization
  blogDraft = {
    title: cleanTitle,          // Validated, trimmed, max length enforced
    subtitle: cleanSubtitle,    // Optional, validated
    outline: parsed.outline || { sections: [] },  // Defaults provided
    body: parsed.body || { sections: [] },        // Defaults provided
    summary: parsed.summary || undefined,
    cta: parsed.cta || undefined,
  };
  
  // Structure validation
  if (!blogDraft.outline.sections || !Array.isArray(blogDraft.outline.sections)) {
    blogDraft.outline.sections = [];
  }
  if (!blogDraft.body.sections || !Array.isArray(blogDraft.body.sections)) {
    blogDraft.body.sections = [];
  }
  
  // Section structure validation
  blogDraft.body.sections = blogDraft.body.sections.map((section: any) => ({
    heading: section.heading || '',
    content: section.content || '',
  }));
} catch (parseError) {
  console.error('Failed to parse OpenAI response:', responseText);
  throw new Error('Invalid JSON response from AI');
}
```

### Key Parser Features

1. **Markdown Cleanup**: Removes ```json or ``` code blocks
2. **Validation**: Ensures required fields exist, provides defaults
3. **Normalization**: Trims strings, enforces max lengths
4. **Structure Validation**: Validates nested objects and arrays
5. **Error Handling**: Catches parse errors and provides helpful error messages

## 4. FRONTEND

**Response Format:**
```typescript
{
  success: true,
  blogDraft: {
    title: string,
    subtitle?: string,
    outline: { sections: [...] },
    body: { sections: [...] },
    summary?: string,
    cta?: string
  }
}
```

The frontend receives a clean, validated `blogDraft` object and displays it in the UI.

## 5. SAVE

Frontend saves the `blogDraft` to the database through the appropriate API endpoint.

---

## Key Takeaways

1. **Explicit JSON Structure**: The prompt shows the EXACT JSON format with all fields
2. **Critical Instructions**: Uses "CRITICAL" and "MUST" to emphasize the format
3. **response_format**: Uses `{ type: 'json_object' }` to force JSON output
4. **Robust Parser**: Handles edge cases (markdown wrapping, missing fields, etc.)
5. **Validation**: Validates structure, types, and constraints before returning to frontend

