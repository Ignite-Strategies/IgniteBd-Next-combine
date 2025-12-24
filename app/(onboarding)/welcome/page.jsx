'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

/**
 * Welcome Page - Company Selection + Routing
 * 
 * Shows company selection based on memberships.
 * Routes to /growth-dashboard after company selection.
 * No access gating - all users get full access.
 */
export default function WelcomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [membershipData, setMembershipData] = useState(null);
  const [selectedCompanyHqId, setSelectedCompanyHqId] = useState(null);

  useEffect(() => {
    const checkMemberships = async () => {
      try {
        setLoading(true);
        console.log('🔍 Welcome: Checking memberships (via hydrate)...');
        
        // Call hydrate - it gets owner + memberships
        const response = await api.get('/api/owner/hydrate');
        
        if (response.data?.success) {
          const hydrateData = response.data;
          const owner = hydrateData.owner;
          const memberships = hydrateData.memberships || [];
          const hasMemberships = memberships.length > 0;
          // Memberships are already sorted by role (OWNER first, then MANAGER, then others)
          const defaultMembership = memberships[0];
          
          // Map memberships for display (include full company_hqs object)
          const mappedMemberships = memberships.map(m => ({
            id: m.id,
            companyHqId: m.companyHqId,
            role: m.role,
            companyName: m.company_hqs?.companyName || null,
            companyHQ: m.company_hqs || null, // Full companyHQ object
          }));
          
          // Set selected company to first (already sorted by role priority)
          const defaultCompanyHqId = defaultMembership?.companyHqId || memberships[0]?.companyHqId;
          setSelectedCompanyHqId(defaultCompanyHqId);
          
          // Set membership data for display/routing
          setMembershipData({
            hasMemberships,
            owner: {
              id: owner.id,
              email: owner.email,
              firstName: owner.firstName,
              lastName: owner.lastName,
              name: owner.name,
            },
            memberships: mappedMemberships,
            defaultMembership: defaultMembership ? {
              companyHqId: defaultMembership.companyHqId,
              companyName: defaultMembership.company_hqs?.companyName || null,
              role: defaultMembership.role,
            } : null,
          });
          
          // Save hydrate data to localStorage
          localStorage.setItem('owner', JSON.stringify(owner));
          localStorage.setItem('ownerId', owner.id);
          localStorage.setItem('memberships', JSON.stringify(memberships));
          if (owner.companyHQId) {
            localStorage.setItem('companyHQId', owner.companyHQId);
          }
          if (owner.companyHQ) {
            localStorage.setItem('companyHQ', JSON.stringify(owner.companyHQ));
          }
          
          console.log(`✅ Welcome: User has ${memberships.length} membership(s)`);
        } else {
          setError(response.data?.error || 'Failed to check memberships');
        }
      } catch (err) {
        console.error('❌ Welcome: Error checking memberships:', err);
        setError(err.response?.data?.error || err.message || 'Failed to check memberships');
      } finally {
        setLoading(false);
      }
    };

    checkMemberships();
  }, []);

  const handleContinue = () => {
    // If user has memberships, save selected company and route to dashboard
    if (membershipData?.hasMemberships && selectedCompanyHqId) {
      // Find the selected membership
      const selectedMembership = membershipData.memberships.find(
        m => m.companyHqId === selectedCompanyHqId
      );
      
      if (selectedMembership) {
        // Update localStorage with selected company
        localStorage.setItem('companyHQId', selectedCompanyHqId);
        if (selectedMembership.companyHQ) {
          localStorage.setItem('companyHQ', JSON.stringify(selectedMembership.companyHQ));
        }
        
        // Update owner object in localStorage with selected companyHQ
        const storedOwner = localStorage.getItem('owner');
        if (storedOwner) {
          try {
            const owner = JSON.parse(storedOwner);
            owner.companyHQId = selectedCompanyHqId;
            owner.companyHQ = selectedMembership.companyHQ;
            localStorage.setItem('owner', JSON.stringify(owner));
          } catch (err) {
            console.warn('Failed to update owner in localStorage', err);
          }
        }
        
        // Route to growth dashboard (no gating)
        router.push('/growth-dashboard');
      }
    } else {
      // No memberships - go to onboarding flow
      router.push('/company/create-or-choose');
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center p-4">
        <div className="text-center space-y-6 bg-white/10 backdrop-blur-sm rounded-2xl p-12 shadow-2xl border border-white/20">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto" />
          <p className="text-white text-xl font-medium">Loading your account...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    const isNotFound = error.includes('not found') || error.includes('OWNER_NOT_FOUND');
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center p-4">
        <div className="text-center max-w-md mx-auto space-y-6 bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/20">
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-6">
            <p className="text-white text-lg mb-4">{error}</p>
            {isNotFound && (
              <p className="text-white/80 text-sm mt-2">
                Please contact support to set up your account.
              </p>
            )}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-red-700 hover:to-orange-700 transition shadow-lg"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  // Welcome screen
  const owner = membershipData?.owner;
  const hasMultipleMemberships = membershipData?.memberships && membershipData.memberships.length > 1;
  const selectedMembership = membershipData?.memberships?.find(
    m => m.companyHqId === selectedCompanyHqId
  );
  const displayCompany = selectedMembership?.companyName || membershipData?.defaultMembership?.companyName;
  
  const displayName = owner?.firstName 
    ? owner.firstName 
    : owner?.name 
    ? owner.name.split(' ')[0] 
    : owner?.email 
    ? owner.email.split('@')[0] 
    : 'there';

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center p-4">
      <div className="text-center max-w-md mx-auto space-y-6 bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/20">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-white mb-2">
            Welcome, {displayName}!
          </h1>
          
          {/* Company selector for multiple memberships */}
          {hasMultipleMemberships && (
            <div className="text-left space-y-2">
              <label className="block text-white/90 text-sm font-medium mb-2">
                Select company to manage:
              </label>
              <select
                value={selectedCompanyHqId || ''}
                onChange={(e) => setSelectedCompanyHqId(e.target.value)}
                className="w-full bg-white/20 border border-white/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50"
              >
                {membershipData.memberships.map((membership) => (
                  <option
                    key={membership.companyHqId}
                    value={membership.companyHqId}
                    className="bg-red-800 text-white"
                  >
                    {membership.companyName || 'Unnamed Company'} ({membership.role})
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <p className="text-white/80 text-lg">
            {displayCompany
              ? `Ready to manage ${displayCompany}?`
              : membershipData?.hasMemberships
              ? 'Ready to get started?'
              : 'Let\'s set up your company profile to get started.'}
          </p>
          
          {hasMultipleMemberships && selectedMembership && (
            <p className="text-white/60 text-sm">
              You'll be working as: <span className="font-medium">{selectedMembership.role}</span>
            </p>
          )}
        </div>

        <button
          onClick={handleContinue}
          disabled={hasMultipleMemberships && !selectedCompanyHqId}
          className="w-full bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-4 rounded-xl font-semibold text-lg transition-all hover:from-red-700 hover:to-orange-700 hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {membershipData?.hasMemberships ? 'Continue →' : 'Set Up Company →'}
        </button>
      </div>
    </div>
  );
}
