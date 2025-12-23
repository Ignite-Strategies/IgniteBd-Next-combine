'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useOwner } from '@/hooks/useOwner';
import { resolveEnabledFeatures } from '@/lib/product/resolveFeatures';
import { ProductTier } from '@/lib/product/tiers';
import { Settings } from 'lucide-react';

function Sidebar() {
  const pathname = usePathname();
  const { owner } = useOwner();

  // Get user's tier - default to 'foundation' if not set
  // TODO: Add tier field to Owner model and hydrate it
  const tier: ProductTier = (owner?.tier as ProductTier) || 'foundation';

  // Resolve enabled features based on tier
  const enabledFeatures = useMemo(() => {
    return resolveEnabledFeatures(tier);
  }, [tier]);

  // Group features by their group property for display
  const groupedFeatures = useMemo(() => {
    const groups: Record<string, typeof enabledFeatures> = {};
    const ungrouped: typeof enabledFeatures = [];

    enabledFeatures.forEach((feature) => {
      if (feature.group) {
        if (!groups[feature.group]) {
          groups[feature.group] = [];
        }
        groups[feature.group].push(feature);
      } else {
        ungrouped.push(feature);
      }
    });

    return { groups, ungrouped };
  }, [enabledFeatures]);

  const isActive = (path: string, exact = false) => {
    if (exact) {
      return pathname === path;
    }
    if (pathname === path) return true;
    if (pathname?.startsWith(path + '/')) return true;
    return false;
  };

  // Get dashboard feature (always show first)
  const dashboardFeature = enabledFeatures.find((f) => f.key === 'dashboard');

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-[calc(100vh-3.5rem)] fixed left-0 top-14 overflow-y-auto z-30">
      <div className="p-4 border-b border-gray-200">
        <Link href="/growth-dashboard" className="flex items-center gap-3">
          <span className="text-2xl">🔥</span>
          <span className="text-lg font-semibold text-gray-900">
            Ignite BD
          </span>
        </Link>
      </div>

      <nav className="p-4 space-y-6">
        {/* Dashboard Link - Always first if enabled */}
        {dashboardFeature && (
          <div>
            <ul className="space-y-1">
              <li>
                {(() => {
                  const Icon = dashboardFeature.icon;
                  const active = isActive(dashboardFeature.route);
                  return (
                    <Link
                      href={dashboardFeature.route}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? 'border border-red-200 bg-red-50 text-red-700'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{dashboardFeature.label}</span>
                    </Link>
                  );
                })()}
              </li>
            </ul>
          </div>
        )}

        {/* Grouped Features */}
        {Object.entries(groupedFeatures.groups).map(([groupName, features]) => {
          // Find hub path for this group (first feature's route or group-specific)
          const hubPath = features[0]?.route;
          const hubActive = hubPath ? isActive(hubPath) : false;

          return (
            <div key={groupName}>
              {hubPath ? (
                <Link
                  href={hubPath}
                  className={`mb-3 block text-xs font-semibold uppercase tracking-wider transition-colors ${
                    hubActive
                      ? 'text-red-600 hover:text-red-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {groupName}
                </Link>
              ) : (
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {groupName}
                </h3>
              )}
              <ul className="space-y-1">
                {features.map((feature) => {
                  const Icon = feature.icon;
                  const active = isActive(feature.route);
                  return (
                    <li key={feature.key}>
                      <Link
                        href={feature.route}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          active
                            ? 'border border-red-200 bg-red-50 text-red-700'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{feature.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        {/* Ungrouped Features (like Settings) */}
        {groupedFeatures.ungrouped.length > 0 && (
          <div>
            <ul className="space-y-1">
              {groupedFeatures.ungrouped.map((feature) => {
                const Icon = feature.icon;
                const active = isActive(feature.route);
                return (
                  <li key={feature.key}>
                    <Link
                      href={feature.route}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? 'border border-red-200 bg-red-50 text-red-700'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{feature.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </nav>
    </div>
  );
}

export default Sidebar;
