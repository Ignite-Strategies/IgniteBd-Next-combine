import { z } from 'zod';

/**
 * Universal Parser Type Prompts
 * Extensible architecture for adding new parser types
 */

// BD Product Definition Schema (matches BD Product model)
// Zod Schema Rules: All fields must be optional (parser should NEVER reject data because a field is missing)
// Zod should coerce: numbers, stringified numbers, arrays
// Zod should define the FINAL shape of the parsed object
export const productDefinitionSchema = z.object({
  name: z.string().max(255).optional().nullable(), // Optional - parser never rejects missing name
  category: z.string().max(100).optional().nullable(),
  valueProp: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  price: z.coerce.number().min(0).optional().nullable(), // Coerce string numbers to numbers
  priceCurrency: z.enum(['USD', 'EUR', 'GBP', 'CAD']).optional().nullable(),
  pricingModel: z.enum(['one-time', 'recurring', 'usage-based', 'freemium', 'custom']).optional().nullable(),
  targetedTo: z.string().optional().nullable(), // Persona ID
  targetMarketSize: z.enum(['enterprise', 'mid-market', 'small-business', 'startup', 'individual']).optional().nullable(),
  salesCycleLength: z.enum(['immediate', 'short', 'medium', 'long', 'very-long']).optional().nullable(),
  deliveryTimeline: z.string().max(100).optional().nullable(),
  features: z.union([z.string(), z.array(z.string())]).optional().nullable(), // Can be string or array, coerced
  competitiveAdvantages: z.union([z.string(), z.array(z.string())]).optional().nullable(), // Can be string or array, coerced
});

export type ProductDefinitionParsed = z.infer<typeof productDefinitionSchema>;

export type UniversalParserType =
  | 'product_definition'
  | 'ecosystem_map'
  | 'event_selection'
  | 'blog'
  | 'generic';

export type ParserConfig = {
  schema: z.ZodSchema<any>;
  systemPrompt: string;
  fieldDescriptions: Record<string, string>;
  exampleInput?: string;
  exampleOutput?: Record<string, any>;
  temperature?: number;
  outputFormat?: 'json_object';
};

export const PARSER_PROMPTS: Record<UniversalParserType, ParserConfig | null> = {
  product_definition: {
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
    fieldDescriptions: {
      name: 'Product/Service Name',
      category: 'Category or type',
      valueProp: 'Value Proposition',
      description: 'Full Description',
      price: 'Price Amount',
      priceCurrency: 'Currency',
      pricingModel: 'Pricing Model',
      targetMarketSize: 'Target Market Size',
      salesCycleLength: 'Sales Cycle Length',
      deliveryTimeline: 'Delivery Timeline',
      features: 'Key Features',
      competitiveAdvantages: 'Competitive Advantages',
    },
    exampleInput: `Our Business Development Platform helps professional services firms
systematically grow revenue through Attract → Engage → Nurture methodology.
Pricing: $2,000/month recurring. Target: Small businesses (10-99 employees).
Sales cycle: Medium (1-3 months). Delivery: 2-4 weeks setup.`,
    exampleOutput: {
      name: 'Business Development Platform',
      valueProp: 'Systematically grow revenue through Attract → Engage → Nurture methodology',
      pricingModel: 'recurring',
      price: 2000,
      priceCurrency: 'USD',
      targetMarketSize: 'small-business',
      salesCycleLength: 'medium',
      deliveryTimeline: '2-4 weeks setup',
    },
    temperature: 0,
    outputFormat: 'json_object',
  },
  ecosystem_map: null, // To be filled in v2
  event_selection: null, // To be filled in v2
  blog: null, // To be filled in v2
  generic: null, // To be filled in v2
};

/**
 * Get parser config for a given type
 */
export function getParserConfig(type: UniversalParserType): ParserConfig {
  const config = PARSER_PROMPTS[type];
  if (!config) {
    throw new Error(`Parser type "${type}" is not yet implemented`);
  }
  return config;
}

