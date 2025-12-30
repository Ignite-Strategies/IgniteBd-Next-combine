'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { TrendingUp, Settings, Menu, X, LogOut, User, ChevronDown } from 'lucide-react';
import { signOutUser, getCurrentUser } from '@/lib/firebase';

const NAV_ITEMS = [
  { path: '/growth-dashboard', label: 'Growth Dashboard', icon: TrendingUp },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [owner, setOwner] = useState(null);

  // Load owner from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedOwner = localStorage.getItem('owner');
      if (storedOwner) {
        try {
          setOwner(JSON.parse(storedOwner));
        } catch (error) {
          console.warn('Failed to parse stored owner', error);
        }
      }
    }
  }, []);

  // Get Firebase user info
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const user = getCurrentUser();
      setFirebaseUser(user);
      
      // Listen for auth state changes
      import('firebase/auth').then(({ onAuthStateChanged }) => {
        import('@/lib/firebase').then(({ auth }) => {
          onAuthStateChanged(auth, (user) => {
            setFirebaseUser(user);
          });
        });
      });
    }
  }, []);

  const isActive = (path) =>
    pathname === path || pathname.startsWith(`${path}/`);

  const handleLogout = async () => {
    try {
      // Clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.clear();
      }
      
      // Sign out from Firebase
      await signOutUser();
      
      // Redirect to signin
      router.push('/signin');
    } catch (error) {
      console.error('Logout failed:', error);
      // Still redirect even if logout fails
      if (typeof window !== 'undefined') {
        localStorage.clear();
      }
      router.push('/signin');
    }
  };

  // Get display name/email
  const displayName = owner?.name || owner?.firstName || firebaseUser?.displayName || null;
  const displayEmail = owner?.email || firebaseUser?.email || null;
  const userDisplay = displayName || displayEmail || 'User';

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/growth-dashboard"
          className="flex items-center space-x-2 text-lg font-bold text-red-600 transition hover:text-red-700"
        >
          <span className="text-2xl">🔥</span>
          <span className="hidden sm:inline">Ignite BD</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-2">
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
          
          {/* User Menu */}
          <div className="relative ml-2">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <User className="h-4 w-4" />
              <span className="max-w-[120px] truncate">{userDisplay}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {userMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 rounded-lg bg-white shadow-lg border border-gray-200 py-1 z-20">
                  <div className="px-4 py-2 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {displayName || 'User'}
                    </p>
                    {displayEmail && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {displayEmail}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-500"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-base font-semibold transition ${
                    isActive(item.path)
                      ? 'bg-red-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-red-50 hover:text-red-600'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            
            {/* Mobile User Info & Logout */}
            <div className="px-4 py-3 border-t border-gray-200 mt-2">
              <div className="mb-2">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {displayName || 'User'}
                </p>
                {displayEmail && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {displayEmail}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="flex items-center gap-3 w-full rounded-lg px-4 py-3 text-base font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600 transition"
              >
                <LogOut className="h-5 w-5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

