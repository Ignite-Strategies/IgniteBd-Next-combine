/**
 * Product Layers Registry
 * 
 * Defines the foundational layers of the product.
 * Layers are building blocks that compose into tiers.
 */

export type ProductLayer = 'core' | 'attract' | 'activate';

export const LAYER_REGISTRY: Record<ProductLayer, string[]> = {
  core: [
    'dashboard',
    'crm',
    'contacts',
    'clients',
    'content',
    'personas', // Personas are core - they're the foundation of relationship tracking
  ],
  attract: [
    'events',
    'event-intel',
    'persona-matching',
  ],
  activate: [
    'outreach',
    'campaigns',
    'automation',
  ],
};

