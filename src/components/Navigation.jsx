import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { path: '/growth-dashboard', label: 'Dashboard', icon: '🔥' },
  { path: '/contacts', label: 'People Hub', icon: '👥' },
  { path: '/contacts/view', label: 'Contacts', icon: '📋' },
  { path: '/contacts/manual', label: 'Add Contact', icon: '➕' },
  { path: '/personas', label: 'Personas', icon: '🧠' },
  { path: '/personas/builder', label: 'Persona Builder', icon: '🛠️' },
  { path: '/outreach', label: 'Outreach', icon: '📣' },
  { path: '/proposals', label: 'Proposals', icon: '📄' },
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

        <div className="flex items-center space-x-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                isActive(item.path)
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-gray-700 hover:bg-red-50 hover:text-red-600'
              }`}
            >
              <span className="mr-1.5">{item.icon}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

