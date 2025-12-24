'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SIDEBAR_ITEMS } from '@/lib/navigation/sidebarItems';

function Sidebar() {
  const pathname = usePathname();

  const isActive = (path) => {
    if (pathname === path) return true;
    if (pathname?.startsWith(path + '/')) return true;
    return false;
  };

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

      <nav className="p-4 space-y-1">
        {SIDEBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.key}
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
          );
        })}
      </nav>
    </div>
  );
}

export default Sidebar;
