'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOwner } from '@/hooks/useOwner';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';

/**
 * Welcome Page - Pure Router
 * 
 * Requires authenticated session and loads Owner + CompanyHQ records.
 * Routes based on companyHQ.hasGrowthAccess (company-level, not owner-level):
 * - true → /growth-dashboard (full Ignite BD)
 * - false/null → /crmdashboard (CRM-only)
 * 
 * This allows the same owner to have different access levels in different companies:
 * - Adam in Ignite Strategies → Full Growth Dashboard
 * - Adam in BusinessPoint Law → CRM Dashboard
 */
export default function WelcomePage() {
  const router = useRouter();
  const { owner, loading: ownerLoading, hydrated: ownerHydrated, error: ownerError } = useOwner();
  const { companyHQ, loading: companyLoading, hydrated: companyHydrated } = useCompanyHQ();

  useEffect(() => {
    // Wait for both owner and companyHQ to be hydrated
    if (ownerLoading || !ownerHydrated || companyLoading || !companyHydrated) {
      return;
    }

    // Error state - redirect to sign in
    if (ownerError) {
      console.error('Welcome page error:', ownerError);
      router.replace('/signin');
      return;
    }

    // Require authenticated session
    if (!owner) {
      console.warn('Welcome page: No owner found, redirecting to sign in');
      router.replace('/signin');
      return;
    }

    // Routing logic: companyHQ.hasGrowthAccess determines destination
    // Treat null as false (defaults to CRM)
    // If no companyHQ, default to CRM
    const hasGrowthAccess = companyHQ?.hasGrowthAccess === true;
    
    if (hasGrowthAccess) {
      router.replace('/growth-dashboard');
    } else {
      router.replace('/crmdashboard');
    }
  }, [owner, ownerLoading, ownerHydrated, ownerError, companyHQ, companyLoading, companyHydrated, router]);

  // Show minimal loading state while routing
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4" />
        <p className="text-white text-xl">Loading your account...</p>
      </div>
    </div>
  );
}
