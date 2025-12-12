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

  systemPrompt: `You are an extraction engine for product/service definitions.

Your task is to extract structured product information from raw text and return it as JSON matching the exact schema provided.

Field meanings:
- name: Product or service name (required)
- category: Type of product/service (e.g., Software, Consulting, Training). 
  If not explicitly stated, infer the closest reasonable category using ONLY the facts in the text (e.g., templates + CRM setup = "service").
- valueProp: Core value proposition - what specific outcome or benefit does this deliver?
- description: Full description with details about features, use cases, experience. 
  If a literal description is not stated, generate ONE sentence summarizing the product based ONLY on facts in the text.
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
1. Extract only facts from the raw text - do not invent new information
2. DESCRIPTION: If no explicit description exists, create ONE factual summary sentence using only raw text content.
3. CATEGORY: If not stated, infer the simplest accurate category using only the text (e.g., "service").
4. If a field is not mentioned, return null
5. Price should be a number (not a string)
6. Features and competitiveAdvantages can be formatted as bullet points or paragraphs
7. Follow the exact enum values for select fields
8. If human context is provided, use it to guide interpretation but don't invent data
9. Return strictly valid JSON matching the schema structure

Return ONLY valid JSON matching the schema. No markdown, no explanations, just JSON.`,

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

