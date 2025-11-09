'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  TrendingUp,
  Users,
  MessageSquare,
  Calendar,
  FileText,
  Map,
  Settings,
  Search,
  BarChart3,
  Building2,
  Mail,
  Target,
  UserCircle,
  CheckCircle,
  Lightbulb,
  FileCheck,
} from 'lucide-react';

const navigationGroups = [
  {
    name: 'Setup',
    items: [
      { name: 'Personas', path: '/personas', icon: UserCircle },
      { name: 'Ecosystem', path: '/setup/ecosystem', icon: Building2 },
    ]
  },
  {
    name: 'Central Command',
    items: [
      { name: 'People', path: '/contacts', icon: Users },
      { name: 'Pipeline', path: '/contacts/deal-pipelines', icon: Target },
    ]
  },
  {
    name: 'Overview',
    items: [
      { name: 'Growth Dashboard', path: '/growth-dashboard', icon: TrendingUp },
      { name: 'BD Roadmap', path: '/roadmap', icon: Map },
      { name: 'Assessment', path: '/assessment', icon: BarChart3 },
    ]
  },
  {
    name: 'Attract',
    items: [
      { name: 'Events', path: '/events', icon: Calendar },
      { name: 'Ads & SEO', path: '/ads', icon: Search },
      { name: 'Content', path: '/content', icon: FileText },
      { name: 'Branding Hub', path: '/branding-hub', icon: UserCircle },
    ]
  },
  {
    name: 'Engage',
    items: [
      { name: 'Outreach', path: '/outreach', icon: MessageSquare },
      { name: 'Meetings', path: '/meetings', icon: Calendar },
      { name: 'Proposals', path: '/proposals', icon: FileCheck },
      { name: 'Close Deals', path: '/close-deals', icon: CheckCircle },
    ]
  },
  {
    name: 'Insights',
    items: [
      { name: 'Insights', path: '/insights', icon: Lightbulb },
    ]
  },
  {
    name: 'Nurture',
    items: [
      { name: 'Newsletters', path: '/email-campaigns', icon: Mail }, // TODO: Create newsletters route (HTML, not campaigns)
      { name: 'Social Media', path: '/content', icon: FileText },
    ]
  },
  {
    name: 'Settings',
    items: [
      { name: 'Settings', path: '/settings', icon: Settings },
    ]
  },
];

function Sidebar() {
  const pathname = usePathname();

  const isActive = (path) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <Link href="/growth-dashboard" className="flex items-center gap-3">
          <span className="text-2xl">🔥</span>
          <span className="text-lg font-semibold text-gray-900">
            Ignite BD
          </span>
        </Link>
      </div>

      <nav className="p-4 space-y-6">
        {navigationGroups.map((group) => (
          <div key={group.name}>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {group.name}
            </h3>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <li key={item.path}>
                    <Link
                      href={item.path}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        active
                          ? 'bg-red-50 text-red-700 border border-red-200'
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
        ))}
      </nav>
    </div>
  );
}

export default Sidebar;
