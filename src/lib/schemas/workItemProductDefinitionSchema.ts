import { z } from 'zod';

/**
 * Zod schema for WorkItem Product Definition
 * Replicates BD Product Definition fields but for WorkItem context
 */
export const workItemProductDefinitionSchema = z.object({
  // Basic Information
  name: z.string().min(1, 'Product/Service Name is required').max(255),
  category: z.string().max(100).optional(),
  valueProp: z.string().optional(),
  description: z.string().optional(),

  // Pricing
  price: z.number().min(0).optional().nullable(),
  priceCurrency: z.enum(['USD', 'EUR', 'GBP', 'CAD']).optional().nullable(),
  pricingModel: z.enum(['one-time', 'recurring', 'usage-based', 'freemium', 'custom']).optional().nullable(),

  // Targeting & Market
  targetedTo: z.string().optional().nullable(), // Persona ID
  targetMarketSize: z.enum(['enterprise', 'mid-market', 'small-business', 'startup', 'individual']).optional().nullable(),
  salesCycleLength: z.enum(['immediate', 'short', 'medium', 'long', 'very-long']).optional().nullable(),

  // Details
  deliveryTimeline: z.string().max(100).optional(),
  features: z.string().optional(),
  competitiveAdvantages: z.string().optional(),
});

export type WorkItemProductDefinitionFormData = z.infer<typeof workItemProductDefinitionSchema>;

