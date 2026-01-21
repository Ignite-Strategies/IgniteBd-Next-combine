'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  TrendingUp,
  UserCircle,
  Package,
  Users,
  MessageSquare,
  GitBranch,
  Building2,
  FileText,
  Calendar,
  Settings,
  FileCode,
} from 'lucide-react';

function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Get companyHQId from URL params first, then localStorage fallback
  const [companyHQId, setCompanyHQId] = useState('');
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Try URL params first
    const urlCompanyHQId = searchParams?.get('companyHQId') || '';
    if (urlCompanyHQId) {
      setCompanyHQId(urlCompanyHQId);
      return;
    }
    
    // Fallback to localStorage
    const stored = localStorage.getItem('companyHQId') || localStorage.getItem('companyId');
    if (stored) {
      setCompanyHQId(stored);
    }
  }, [searchParams]);
  
  // Helper to add companyHQId to href if available
  const getHref = (href) => {
    if (companyHQId && !href.includes('companyHQId=')) {
      const separator = href.includes('?') ? '&' : '?';
      return `${href}${separator}companyHQId=${companyHQId}`;
    }
    return href;
  };

  const isActive = (path) => {
    if (pathname === path) return true;
    if (pathname?.startsWith(path + '/')) return true;
    return false;
  };

  // Dashboard link (always first)
  const dashboardItem = {
    key: 'dashboard',
    label: 'Growth Dashboard',
    href: '/growth-dashboard',
    icon: TrendingUp,
  };

  // Navigation groups
  const navigationGroups = [
    {
      name: 'Growth Ops',
      items: [
        { key: 'personas', label: 'Personas', href: '/personas', icon: UserCircle },
        { key: 'products', label: 'Products', href: '/products', icon: Package },
      ],
    },
    {
      name: 'Engage',
      items: [
        { key: 'people', label: 'People', href: '/people', icon: Users },
        { key: 'outreach', label: 'Outreach', href: '/outreach', icon: MessageSquare },
        { key: 'templates', label: 'Templates', href: '/templates', icon: FileCode },
        { key: 'pipelines', label: 'Pipeline', href: '/pipelines', icon: GitBranch },
        { key: 'companies', label: 'Company Hub', href: '/companies', icon: Building2 },
        { key: 'meetings', label: 'Meetings', href: '/meetings', icon: Calendar },
      ],
    },
    {
      name: 'Attract',
      items: [
        { key: 'content', label: 'Content', href: '/content', icon: FileText },
        { key: 'events', label: 'Events', href: '/events', icon: Calendar },
      ],
    },
    {
      name: 'Settings',
      items: [
        { key: 'settings', label: 'Settings', href: '/settings', icon: Settings },
      ],
    },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-[calc(100vh-3.5rem)] fixed left-0 top-14 overflow-y-auto z-30">
      <div className="p-4 border-b border-gray-200">
        <Link href={getHref("/growth-dashboard")} className="flex items-center gap-3">
          <span className="text-2xl">🔥</span>
          <span className="text-lg font-semibold text-gray-900">
            Ignite BD
          </span>
        </Link>
      </div>

      <nav className="p-4 space-y-6">
        {/* Dashboard Link - Always first */}
        <div>
          <ul className="space-y-1">
            <li>
              {(() => {
                const Icon = dashboardItem.icon;
                const active = isActive(dashboardItem.href);
                return (
                  <Link
                    href={getHref(dashboardItem.href)}
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

        {/* Navigation Groups */}
        {navigationGroups.map((group) => (
          <div key={group.name}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              {group.name}
            </h3>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.key}>
                    <Link
                      href={getHref(item.href)}
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
        ))}
      </nav>
    </div>
  );
}

export default Sidebar;
