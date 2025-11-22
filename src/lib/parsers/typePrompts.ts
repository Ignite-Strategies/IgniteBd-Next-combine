import { z } from 'zod';

/**
 * Universal Parser Type Prompts
 * Extensible architecture for adding new parser types
 */

// BD Product Definition Schema (matches BD Product model)
export const productDefinitionSchema = z.object({
  name: z.string().min(1, 'Product/Service Name is required').max(255),
  category: z.string().max(100).optional().nullable(),
  valueProp: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  price: z.number().min(0).optional().nullable(),
  priceCurrency: z.enum(['USD', 'EUR', 'GBP', 'CAD']).optional().nullable(),
  pricingModel: z.enum(['one-time', 'recurring', 'usage-based', 'freemium', 'custom']).optional().nullable(),
  targetedTo: z.string().optional().nullable(), // Persona ID
  targetMarketSize: z.enum(['enterprise', 'mid-market', 'small-business', 'startup', 'individual']).optional().nullable(),
  salesCycleLength: z.enum(['immediate', 'short', 'medium', 'long', 'very-long']).optional().nullable(),
  deliveryTimeline: z.string().max(100).optional().nullable(),
  features: z.string().optional().nullable(),
  competitiveAdvantages: z.string().optional().nullable(),
});

export type ProductDefinitionParsed = z.infer<typeof productDefinitionSchema>;

export type UniversalParserType =
  | 'product_definition'
  | 'ecosystem_map'
  | 'event_selection'
  | 'blog'
  | 'generic';

export interface ParserConfig {
  schema: z.ZodSchema<any>;
  systemPrompt: string;
  fieldDescriptions?: Record<string, string>;
}

export const PARSER_PROMPTS: Record<UniversalParserType, ParserConfig | null> = {
  product_definition: {
    schema: productDefinitionSchema,
    systemPrompt: `You are an extraction engine for product/service definitions.

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

Return ONLY valid JSON matching the schema. No markdown, no explanations, just JSON.`,
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

