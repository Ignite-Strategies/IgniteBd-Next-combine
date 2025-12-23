'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users,
  MessageSquare,
  List,
  GitBranch,
  Building2,
  Settings,
  UserCircle,
  Package,
  Brain,
  Network,
} from 'lucide-react';

// Home link - CRM Dashboard
const homeLink = {
  name: 'CRM Dashboard',
  path: '/crmdashboard',
  icon: Users,
};

// CRM navigation: Engage items + Growth Ops (but NOT BD Roadmap)
const navigationGroups = [
  {
    name: 'Growth Ops',
    items: [
      { name: 'Personas', path: '/personas', icon: UserCircle },
      { name: 'Products', path: '/products', icon: Package },
      { name: 'BD Intelligence', path: '/bd-intelligence', icon: Brain },
      { name: 'Ecosystem Intelligence', path: '/ecosystem/associations', icon: Network },
    ],
  },
  {
    name: 'Engage',
    hubPath: '/people',
    items: [
      { name: 'People', path: '/people', icon: Users },
      { name: 'Lists', path: '/people/lists', icon: List },
      { name: 'Outreach', path: '/outreach', icon: MessageSquare },
      { name: 'Pipeline', path: '/pipelines/roadmap', icon: GitBranch },
      { name: 'Company Hub', path: '/companies', icon: Building2 },
    ],
  },
  {
    name: 'Settings',
    items: [
      { name: 'Settings', path: '/settings', icon: Settings },
    ],
  },
];

function CRMSidebar() {
  const pathname = usePathname();

  const isActive = (path, exact = false) => {
    if (exact) {
      return pathname === path;
    }
    if (pathname === path) return true;
    if (pathname.startsWith(path + '/')) return true;
    return false;
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-[calc(100vh-3.5rem)] fixed left-0 top-14 overflow-y-auto z-40">
      <div className="p-4 border-b border-gray-200">
        <Link href="/crmdashboard" className="flex items-center gap-3">
          <span className="text-2xl">🔥</span>
          <span className="text-lg font-semibold text-gray-900">
            Ignite BD
          </span>
        </Link>
      </div>

      <nav className="p-4 space-y-6">
        {/* Home Link - CRM Dashboard */}
        <div>
          <ul className="space-y-1">
            <li>
              {(() => {
                const HomeIcon = homeLink.icon;
                const active = isActive(homeLink.path);
                return (
                  <Link
                    href={homeLink.path}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'border border-red-200 bg-red-50 text-red-700'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <HomeIcon className="h-5 w-5" />
                    <span>{homeLink.name}</span>
                  </Link>
                );
              })()}
            </li>
          </ul>
        </div>

        {/* Navigation Groups */}
        {navigationGroups.map((group) => {
          const hubActive = group.hubPath ? isActive(group.hubPath) : false;
          return (
            <div key={group.name}>
              {group.hubPath ? (
                <Link
                  href={group.hubPath}
                  className={`mb-3 block text-xs font-semibold uppercase tracking-wider transition-colors ${
                    hubActive
                      ? 'text-red-600 hover:text-red-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {group.name}
                </Link>
              ) : (
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {group.name}
                </h3>
              )}
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path, item.exact);
                  return (
                    <li key={item.path}>
                      <Link
                        href={item.path}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          active
                            ? 'border border-red-200 bg-red-50 text-red-700'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </div>
  );
}

export default CRMSidebar;

