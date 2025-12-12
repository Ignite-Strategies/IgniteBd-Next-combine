import { z } from 'zod';
import type { ParserConfig } from '../parserConfigs';

// Placeholder schema - to be implemented in v2
export const blogSchema = z.object({});

export const parserConfig: ParserConfig = {
  name: 'blog',
  schema: blogSchema,

  systemPrompt: `You are a structured data extraction engine.

Your job is to analyze unstructured text about blog content and extract factual information into a strict JSON object.

Do NOT infer or hallucinate any details not explicitly stated in the text.
If a field is not mentioned clearly, return null.

Return ONLY JSON. No markdown, no explanations, no commentary.`,

  buildUserPrompt: (raw: string, context: string | null) => `Extract the blog content fields from the following raw text.

RAW TEXT:
${raw}

HUMAN CONTEXT (optional):
${context ?? 'None'}

Return ONLY the JSON object following the schema provided in the system prompt.`,

  normalize: (parsed: any) => {
    // Basic normalization: trim strings, convert undefined to null
    const normalized: any = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value === undefined) {
        normalized[key] = null;
      } else if (value === null) {
        normalized[key] = null;
      } else if (typeof value === 'string') {
        normalized[key] = value.trim();
      } else {
        normalized[key] = value;
      }
    }
    return normalized;
  },
};

