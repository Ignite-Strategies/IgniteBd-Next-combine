'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useOwner } from '@/hooks/useOwner';
import { SIDEBAR_ITEMS } from '@/lib/navigation/sidebarItems';
import { tierAllows } from '@/lib/navigation/tierUtils';

function Sidebar() {
  const pathname = usePathname();
  const { owner } = useOwner();

  // Get user's tier - default to 'foundation' if not set
  const tier = owner?.tier || 'foundation';

  // Filter sidebar items by tier
  const visibleItems = useMemo(() => {
    return SIDEBAR_ITEMS.filter((item) => tierAllows(tier, item.minTier));
  }, [tier]);

  // Group items by their group property for display
  const groupedItems = useMemo(() => {
    const groups = {};
    const ungrouped = [];

    visibleItems.forEach((item) => {
      if (item.group) {
        if (!groups[item.group]) {
          groups[item.group] = [];
        }
        groups[item.group].push(item);
      } else {
        ungrouped.push(item);
      }
    });

    return { groups, ungrouped };
  }, [visibleItems]);

  const isActive = (path, exact = false) => {
    if (exact) {
      return pathname === path;
    }
    if (pathname === path) return true;
    if (pathname?.startsWith(path + '/')) return true;
    return false;
  };

  // Get dashboard item (always show first)
  const dashboardItem = visibleItems.find((item) => item.key === 'dashboard');

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
        {dashboardItem && (
          <div>
            <ul className="space-y-1">
              <li>
                {(() => {
                  const Icon = dashboardItem.icon;
                  const active = isActive(dashboardItem.href);
                  return (
                    <Link
                      href={dashboardItem.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? 'border border-red-200 bg-red-50 text-red-700'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{dashboardItem.label}</span>
                    </Link>
                  );
                })()}
              </li>
            </ul>
          </div>
        )}

        {/* Grouped Items */}
        {Object.entries(groupedItems.groups).map(([groupName, items]) => {
          // Find hub path for this group (first item's href or group-specific)
          const hubPath = items[0]?.href;
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
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          active
                            ? 'border border-red-200 bg-red-50 text-red-700'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        {/* Ungrouped Items (like Settings) */}
        {groupedItems.ungrouped.length > 0 && (
          <div>
            <ul className="space-y-1">
              {groupedItems.ungrouped.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? 'border border-red-200 bg-red-50 text-red-700'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
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
