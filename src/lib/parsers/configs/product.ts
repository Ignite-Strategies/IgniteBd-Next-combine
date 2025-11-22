import { z } from 'zod';
import type { ParserConfig } from '../parserConfigs';

// Product Definition Schema (matches BD Product model)
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

export const parserConfig: ParserConfig = {
  name: 'product_definition',
  schema: productDefinitionSchema,

  systemPrompt: `You are a structured data extraction engine.

Your job is to analyze unstructured text about a product or service and extract factual information into a strict JSON object that matches the exact Product schema defined below.

Do NOT infer or hallucinate any details not explicitly stated in the text.
If a field is not mentioned clearly, return null.
If human context is provided, you may use it to guide interpretation but DO NOT invent new facts.

You MUST return strictly valid JSON following this exact structure:

{
  "name": string | null,
  "category": string | null,
  "valueProp": string | null,
  "description": string | null,
  "price": number | null,
  "priceCurrency": "USD" | "EUR" | "GBP" | "CAD" | null,
  "pricingModel": "one-time" | "recurring" | "usage-based" | "freemium" | "custom" | null,
  "targetedTo": string | null,
  "targetMarketSize": "enterprise" | "mid-market" | "small-business" | "startup" | "individual" | null,
  "salesCycleLength": "immediate" | "short" | "medium" | "long" | "very-long" | null,
  "deliveryTimeline": string | null,
  "features": string | string[] | null,
  "competitiveAdvantages": string | string[] | null
}

Return ONLY JSON. No markdown, no explanations, no commentary.`,

  buildUserPrompt: (raw: string, context: string | null) => `Extract the product definition fields from the following raw text.

RAW TEXT:
${raw}

HUMAN CONTEXT (optional):
${context ?? 'None'}

Return ONLY the JSON object following the schema provided in the system prompt.`,

  normalize: (parsed: any) => {
    const normalized: any = {};

    // Trim all strings
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

    // Product-specific normalization
    return {
      ...normalized,
      // Ensure price is a number
      price: normalized.price != null ? Number(normalized.price) : null,
      // Normalize features: array or split string
      features: Array.isArray(normalized.features)
        ? normalized.features
        : normalized.features
          ? normalized.features.split(/[\n,]+/).map((i: string) => i.trim()).filter(Boolean)
          : null,
      // Normalize competitiveAdvantages: array or split string
      competitiveAdvantages: Array.isArray(normalized.competitiveAdvantages)
        ? normalized.competitiveAdvantages
        : normalized.competitiveAdvantages
          ? normalized.competitiveAdvantages.split(/[\n,]+/).map((i: string) => i.trim()).filter(Boolean)
          : null,
    };
  },
};

// Export type for backward compatibility
export type ProductDefinitionParsed = z.infer<typeof productDefinitionSchema>;

