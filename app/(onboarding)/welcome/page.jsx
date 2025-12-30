'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { wipeTenantData } from '@/lib/localStorageWiper';

/**
 * Welcome Page Contract:
 * - 1 membership → auto-select and persist
 * - >1 memberships → require explicit user selection
 * - 0 memberships → fallback to owner.companyHQId
 * - Persist companyHQId exactly once
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
    // Wait for Firebase auth to initialize before making API call
    // This prevents 401 errors when page loads before Firebase is ready
    let hasRun = false; // Guard to prevent multiple runs
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (hasRun) {
        console.log('⚠️ Welcome: Already ran, skipping to prevent loops...');
        return;
      }
      
      if (!firebaseUser) {
        console.log('⚠️ Welcome: No Firebase user, redirecting to signup');
        router.push('/signup');
        return;
      }

      hasRun = true; // Mark as run
      console.log('🔍 Welcome: Running checkMemberships (first time only)');

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
            
            // 🔒 CORE CONTRACT: Determine mode based on membership count
            const requiresSelection = memberships.length > 1;
            
            // Save hydrate data to localStorage (always)
            localStorage.setItem('owner', JSON.stringify(owner));
            localStorage.setItem('ownerId', owner.id);
            localStorage.setItem('memberships', JSON.stringify(memberships));
            
            // Map memberships for display
            const mappedMemberships = memberships.map(m => ({
              id: m.id,
              companyHqId: m.companyHqId,
              role: m.role,
              companyName: m.company_hqs?.companyName || null,
              companyHQ: m.company_hqs || null,
            }));
            
            // ✅ MODE A — SINGLE MEMBERSHIP (AUTO-SELECT BUT STILL A CHOICE)
            if (memberships.length === 1) {
              const companyHQId = memberships[0].companyHqId;
              const companyHQ = memberships[0].company_hqs;
              
              // ❌ Do NOT persist yet - wait for Continue click
              // ✅ Auto-select for display only
              setSelectedCompanyHqId(companyHQId);
              
              // Set membership data for display
              setMembershipData({
                hasMemberships: true,
                owner: {
                  id: owner.id,
                  email: owner.email,
                  firstName: owner.firstName,
                  lastName: owner.lastName,
                  name: owner.name,
                },
                memberships: mappedMemberships,
                defaultMembership: {
                  companyHqId: companyHQId,
                  companyName: companyHQ?.companyName || null,
                  role: memberships[0].role,
                },
              });
              
              console.log(`✅ Welcome: Auto-selected single membership (user must click Continue): ${companyHQId}`);
              setLoading(false);
              return; // Show UI with Continue button
            }
            
            // ✅ MODE B — MULTIPLE MEMBERSHIPS (USER SELECTION REQUIRED)
            if (memberships.length > 1) {
              // ❌ Do NOT persist companyHQId here
              // ❌ Do NOT auto-default
              // ✅ Use React state only
              setSelectedCompanyHqId(null); // Start with no selection
              
              // Set membership data for display
              setMembershipData({
                hasMemberships: true,
                owner: {
                  id: owner.id,
                  email: owner.email,
                  firstName: owner.firstName,
                  lastName: owner.lastName,
                  name: owner.name,
                },
                memberships: mappedMemberships,
                defaultMembership: null, // No default in multi-member mode
              });
              
              console.log(`✅ Welcome: ${memberships.length} memberships - user selection required`);
              setLoading(false);
              return; // Show selection UI
            }
            
            // ✅ MODE C — NO MEMBERSHIPS (LEGACY FALLBACK)
            if (memberships.length === 0) {
              if (owner.companyHQId) {
                // ❌ Do NOT persist yet - wait for Continue click
                // ✅ Auto-select for display only
                setSelectedCompanyHqId(owner.companyHQId);
                
                // Set membership data for display
                setMembershipData({
                  hasMemberships: false,
                  owner: {
                    id: owner.id,
                    email: owner.email,
                    firstName: owner.firstName,
                    lastName: owner.lastName,
                    name: owner.name,
                  },
                  memberships: [],
                  defaultMembership: {
                    companyHqId: owner.companyHQId,
                    companyName: owner.companyHQ?.companyName || null,
                    role: null,
                  },
                });
                
                console.log(`✅ Welcome: No memberships - using owner.companyHQId (user must click Continue): ${owner.companyHQId}`);
                setLoading(false);
                return; // Show UI with Continue button
              } else {
                // No memberships and no owner.companyHQId - redirect to company setup
                console.log('⚠️ Welcome: No memberships and no owner.companyHQId - redirecting to company setup');
                router.push('/company/profile');
                return;
              }
            }
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
    });

    return () => {
      unsubscribe();
      hasRun = false; // Reset on unmount
    };
  }, [router]);

  const handleContinue = async () => {
    // 🔥 THE MAIN THING: DO WE SET? YES - THIS IS WHERE WE SET!
    
    // Require companyHQId (from selection or auto-selection)
    if (!selectedCompanyHqId) {
      setError('Please select a company to continue');
      return;
    }
    
    // Get current companyHQId to check if we're switching
    const currentCompanyHQId = typeof window !== 'undefined' 
      ? localStorage.getItem('companyHQId') 
      : null;
    
    // If switching to a different company, wipe tenant data first
    // CRITICAL: Don't wipe companyHQId - we're setting a new one, so just wipe tenant-scoped data
    if (currentCompanyHQId && currentCompanyHQId !== selectedCompanyHqId) {
      console.log(`🔄 Switching tenant from ${currentCompanyHQId} to ${selectedCompanyHqId} - wiping tenant data...`);
      // Wipe tenant data but preserve companyHQId (we'll set the new one after)
      wipeTenantData({ 
        preserveCompanyHQ: true, // Preserve companyHQId during wipe
      });
      // Set new companyHQId after wipe
      if (typeof window !== 'undefined') {
        localStorage.setItem('companyHQId', selectedCompanyHqId);
      }
    }
    
    // Find the selected membership/company data
    let companyHQ = null;
    
    // MODE A & MODE B: Get from memberships
    if (membershipData?.memberships && membershipData.memberships.length > 0) {
      const selectedMembership = membershipData.memberships.find(
        m => m.companyHqId === selectedCompanyHqId
      );
      if (selectedMembership) {
        companyHQ = selectedMembership.companyHQ;
      }
    }
    // MODE C: Get from owner
    else if (membershipData?.defaultMembership) {
      const storedOwner = localStorage.getItem('owner');
      if (storedOwner) {
        try {
          const owner = JSON.parse(storedOwner);
          companyHQ = owner.companyHQ;
        } catch (err) {
          console.warn('Failed to parse owner from localStorage', err);
        }
      }
    }
    
    // ✅ THIS IS WHERE WE SET - FOR ALL MODES
    if (typeof window !== 'undefined') {
      console.log(`💾 Welcome: SETTING companyHQId in localStorage: ${selectedCompanyHqId}`);
      localStorage.setItem('companyHQId', selectedCompanyHqId);
      
      if (companyHQ) {
        localStorage.setItem('companyHQ', JSON.stringify(companyHQ));
      }
      
      // Update owner object in localStorage with selected companyHQ
      const storedOwner = localStorage.getItem('owner');
      if (storedOwner) {
        try {
          const owner = JSON.parse(storedOwner);
          owner.companyHQId = selectedCompanyHqId;
          owner.companyHQ = companyHQ;
          localStorage.setItem('owner', JSON.stringify(owner));
        } catch (err) {
          console.warn('Failed to update owner in localStorage', err);
        }
      }
      
      // Verify it was set
      const verifySet = localStorage.getItem('companyHQId');
      console.log(`✅ Welcome: VERIFIED companyHQId set in localStorage: ${verifySet}`, {
        matches: verifySet === selectedCompanyHqId,
      });
    }
    
    // Route immediately - dashboard will fetch contacts
    router.push(`/growth-dashboard?companyHQId=${selectedCompanyHqId}`);
    
    // Prefetch contacts in background (truly non-blocking)
    api.get(`/api/contacts?companyHQId=${selectedCompanyHqId}`).catch(err => {
      console.error('❌ Failed to prefetch contacts on welcome page:', err);
      // Ignore errors - dashboard will fetch anyway
    });
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

  // Welcome screen (only shown in MODE B - multiple memberships)
  const owner = membershipData?.owner;
  const hasMultipleMemberships = membershipData?.memberships && membershipData.memberships.length > 1;
  const selectedMembership = membershipData?.memberships?.find(
    m => m.companyHqId === selectedCompanyHqId
  );
  const displayCompany = selectedMembership?.companyName;
  
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
          
          {/* Company selector for multiple memberships (MODE B only) */}
          {hasMultipleMemberships && (
            <div className="text-left space-y-2">
              <label className="block text-white/90 text-sm font-medium mb-2">
                Select company to manage:
              </label>
              <select
                value={selectedCompanyHqId || ''}
                onChange={(e) => {
                  const newCompanyHqId = e.target.value;
                  setSelectedCompanyHqId(newCompanyHqId);
                  setError(null); // Clear any previous errors
                }}
                className="w-full bg-white/20 border border-white/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50"
              >
                <option value="" className="bg-red-800 text-white">
                  -- Select a company --
                </option>
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
              : 'Please select a company to continue'}
          </p>
          
          {selectedMembership && (
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
          Continue →
        </button>
      </div>
    </div>
  );
}
