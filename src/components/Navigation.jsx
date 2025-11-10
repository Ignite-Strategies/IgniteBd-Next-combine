'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TrendingUp, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/growth-dashboard', label: 'Growth Dashboard', icon: TrendingUp },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Navigation() {
  const pathname = usePathname();

  const isActive = (path) =>
    pathname === path || pathname.startsWith(`${path}/`);

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/growth-dashboard"
          className="flex items-center space-x-2 text-lg font-bold text-red-600 transition hover:text-red-700"
        >
          <span className="text-2xl">🔥</span>
          <span>Ignite BD</span>
        </Link>

        <div className="flex items-center space-x-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  isActive(item.path)
                    ? 'bg-red-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-red-50 hover:text-red-600'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

