/**
 * Product Tiers
 * 
 * Tiers are bundles of layers that define what a user can access.
 * This is the product capability model.
 */

import { ProductLayer } from './layers';

export type ProductTier = 'foundation' | 'growth' | 'scale';

export const TIER_LAYERS: Record<ProductTier, ProductLayer[]> = {
  foundation: ['core'],
  growth: ['core', 'attract'],
  scale: ['core', 'attract', 'activate'],
};

