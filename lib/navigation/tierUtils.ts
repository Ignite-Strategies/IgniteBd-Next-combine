/**
 * Tier Comparison Utility
 * 
 * Simple utility to check if a user's tier allows access to a feature.
 */

import { ProductTier } from './sidebarItems';

const TIER_ORDER: ProductTier[] = [
  'foundation',
  'growth',
  'scale',
];

/**
 * Checks if user's tier allows access to a feature requiring a minimum tier
 * 
 * @param userTier - The user's current product tier
 * @param requiredTier - The minimum tier required for the feature
 * @returns true if user's tier is equal or higher than required tier
 */
export function tierAllows(
  userTier: ProductTier,
  requiredTier: ProductTier
): boolean {
  return (
    TIER_ORDER.indexOf(userTier) >=
    TIER_ORDER.indexOf(requiredTier)
  );
}

