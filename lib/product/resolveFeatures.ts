/**
 * Feature Resolution
 * 
 * Resolves which features are enabled for a given tier.
 * This is the ONLY logic that determines feature access.
 * 
 * User → Tier → Enabled Layers → Features
 */

import { FEATURE_REGISTRY, FeatureDefinition } from './features';
import { TIER_LAYERS } from './tiers';
import { ProductTier } from './tiers';

/**
 * Resolves enabled features for a user based on their tier
 * 
 * @param tier - The user's product tier
 * @returns Array of enabled feature definitions
 */
export function resolveEnabledFeatures(tier: ProductTier): FeatureDefinition[] {
  const allowedLayers = TIER_LAYERS[tier];

  return FEATURE_REGISTRY.filter((feature) =>
    allowedLayers.includes(feature.layer)
  );
}

/**
 * Checks if a specific feature is enabled for a tier
 * 
 * @param tier - The user's product tier
 * @param featureKey - The feature key to check
 * @returns true if feature is enabled
 */
export function isFeatureEnabled(
  tier: ProductTier,
  featureKey: string
): boolean {
  const enabledFeatures = resolveEnabledFeatures(tier);
  return enabledFeatures.some((feature) => feature.key === featureKey);
}

/**
 * Gets a feature definition by key
 * 
 * @param featureKey - The feature key
 * @returns Feature definition or undefined
 */
export function getFeature(featureKey: string): FeatureDefinition | undefined {
  return FEATURE_REGISTRY.find((feature) => feature.key === featureKey);
}

