'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import Sidebar from './Sidebar';
import CRMSidebar from './CRMSidebar';
import Navigation from './Navigation';

const ROUTES_WITH_SIDEBAR = [
  '/growth-dashboard',
  '/people',
  '/personas',
  '/persona',
  '/products',
  '/product',
  '/outreach',
  '/pipelines',
  '/proposals',
  '/content',
  '/branding-hub',
  '/events',
  '/meetings',
  '/insights',
  '/bd-intelligence',
  '/settings',
  '/client-operations',
  '/workpackages',
  '/client-operations/execution',
  '/billing',
  '/template',
  '/people',
  '/companies',
];

// CRM-only routes that use CRMSidebar instead of full Sidebar
const CRM_ROUTES = [
  '/people',
  '/people/lists',
  '/outreach',
  '/pipelines',
  '/companies',
  '/personas',
  '/products',
  '/bd-intelligence',
  '/ecosystem',
];

// Public routes that should NOT show navigation
const PUBLIC_ROUTES = [
  '/',
  '/signin',
  '/signup',
  '/splash',
  '/login',
  '/welcome',
  '/company',
  '/profilesetup',
];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const hasHydratedRef = useRef(false);

  // Check Firebase auth state - this is the source of truth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      // Reset hydration flag when auth state changes
      if (!user) {
        hasHydratedRef.current = false;
      }
    });
    return () => unsubscribe();
  }, []);

  // Hydrate on every authenticated page except root, signin, signup
  useEffect(() => {
    // Skip hydration on root, signin, signup pages
    if (!isAuthenticated || !pathname) return;
    if (['/', '/signin', '/signup', '/login'].some(route => pathname === route || pathname.startsWith(`${route}/`))) {
      return;
    }

    // Hydrate on every page navigation
    const hydrate = async () => {
      try {
        console.log('🚀 AppShell: Hydrating owner data...');
        const response = await api.get('/api/owner/hydrate');
        
        if (response.data?.success) {
          const hydrateData = response.data;
          const owner = hydrateData.owner;
          const memberships = hydrateData.memberships || [];
          
          // Save to localStorage
          localStorage.setItem('owner', JSON.stringify(owner));
          localStorage.setItem('ownerId', owner.id);
          localStorage.setItem('memberships', JSON.stringify(memberships));
          
          if (owner.companyHQId) {
            localStorage.setItem('companyHQId', owner.companyHQId);
          }
          if (owner.companyHQ) {
            localStorage.setItem('companyHQ', JSON.stringify(owner.companyHQ));
          }
          
          console.log(`✅ AppShell: Hydrated with ${memberships.length} membership(s)`);
        }
      } catch (err) {
        // Don't log 401 errors - expected when not authenticated
        if (err.response?.status !== 401) {
          console.error('❌ AppShell: Error hydrating:', err);
        }
      }
    };

    hydrate();
  }, [pathname, isAuthenticated]);

  const showSidebar = useMemo(() => {
    if (!pathname) return false;
    return ROUTES_WITH_SIDEBAR.some((route) => pathname.startsWith(route));
  }, [pathname]);

  const isCRMRoute = useMemo(() => {
    if (!pathname) return false;
    return CRM_ROUTES.some((route) => pathname.startsWith(route));
  }, [pathname]);

  const showNavigation = useMemo(() => {
    // Only hide navigation on truly public routes (signup/signin) when NOT authenticated
    if (!isAuthenticated) {
      return false;
    }
    // If authenticated, show navigation everywhere except signup/signin pages
    if (!pathname) return false;
    return !['/signup', '/signin', '/login'].some((route) => pathname.startsWith(route));
  }, [pathname, isAuthenticated]);

  // Show navigation when authenticated (except on signup/signin pages)
  if (showNavigation) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Top Navigation Bar - Only on authenticated pages */}
        <Navigation />
        
        {/* Sidebar - Only render when showSidebar is true */}
        {showSidebar && (isCRMRoute ? <CRMSidebar /> : <Sidebar />)}
        {/* Main Content Area */}
        <main className={showSidebar ? 'flex-1 ml-64 min-h-[calc(100vh-3.5rem)]' : 'min-h-[calc(100vh-3.5rem)]'}>
          {children}
        </main>
      </div>
    );
  }

  // For public routes (splash, login, welcome), render children without navigation
  return <>{children}</>;
}
