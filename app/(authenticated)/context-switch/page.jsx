'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, AlertCircle, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { switchCompanyHQ } from '@/lib/companyhq-switcher';
import { clearCompanyData } from '@/lib/hydrationService';

/**
 * Context Switch Page
 * 
 * Dedicated page for switching between CompanyHQs
 * Only shown to users with multiple memberships
 * Handles validation and error recovery
 */
export default function ContextSwitchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetCompanyHQId = searchParams.get('to');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [currentCompanyHQId, setCurrentCompanyHQId] = useState(null);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState(null);

  // Load memberships and current context
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push('/signup');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Get current companyHQId from localStorage
        const storedCompanyHQId = typeof window !== 'undefined' 
          ? localStorage.getItem('companyHQId')
          : null;
        setCurrentCompanyHQId(storedCompanyHQId);

        // Hydrate to get fresh memberships
        console.log('🔄 Context Switch: Loading memberships...');
        const response = await api.get('/api/owner/hydrate');
        
        if (response.data?.success) {
          const allMemberships = response.data.memberships || [];
          
          if (allMemberships.length < 2) {
            setError('You need at least 2 CompanyHQs to switch between them.');
            setLoading(false);
            return;
          }

          setMemberships(allMemberships);
          
          // If targetCompanyHQId provided, validate and switch
          if (targetCompanyHQId) {
            const targetMembership = allMemberships.find(m => m.companyHqId === targetCompanyHQId);
            if (!targetMembership) {
              setError(`CompanyHQ ${targetCompanyHQId} not found in your memberships.`);
            } else if (targetCompanyHQId === storedCompanyHQId) {
              // Already on this CompanyHQ, just redirect to dashboard
              router.push('/growth-dashboard');
              return;
            }
          }
        } else {
          setError(response.data?.error || 'Failed to load memberships');
        }
      } catch (err) {
        console.error('❌ Context Switch: Error loading memberships:', err);
        setError(err.response?.data?.error || err.message || 'Failed to load memberships');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, targetCompanyHQId]);

  const handleSwitch = async (newCompanyHQId) => {
    if (switching) return;
    
    try {
      setSwitching(true);
      setSwitchError(null);

      console.log(`🔄 Switching from ${currentCompanyHQId} to ${newCompanyHQId}`);

      // Validate membership
      const targetMembership = memberships.find(m => m.companyHqId === newCompanyHQId);
      if (!targetMembership) {
        setSwitchError('Invalid CompanyHQ selected');
        setSwitching(false);
        return;
      }

      // Clear old company data to prevent stale data
      clearCompanyData();

      // Switch CompanyHQ context (updates localStorage)
      const result = switchCompanyHQ(newCompanyHQId);
      if (!result) {
        setSwitchError('Failed to switch CompanyHQ. Please try again.');
        setSwitching(false);
        return;
      }

      console.log(`✅ Switched to: ${targetMembership.company_hqs.companyName}`);

      // Small delay to ensure localStorage is updated
      await new Promise(resolve => setTimeout(resolve, 100));

      // Redirect to dashboard - hydration will happen naturally
      router.push('/growth-dashboard');
    } catch (err) {
      console.error('❌ Context Switch: Error switching:', err);
      setSwitchError(err.message || 'Failed to switch CompanyHQ');
      setSwitching(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-gray-600">Loading your companies...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <XCircle className="h-6 w-6" />
            <h2 className="text-xl font-semibold">Error</h2>
          </div>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={() => router.push('/growth-dashboard')}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentMembership = memberships.find(m => m.companyHqId === currentCompanyHQId);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Switch Company</h1>
            <p className="text-gray-600">
              Select which company you'd like to work with.
            </p>
          </div>

          {switchError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p className="text-red-800 text-sm">{switchError}</p>
            </div>
          )}

          <div className="space-y-3">
            {memberships.map((membership) => {
              const isCurrent = membership.companyHqId === currentCompanyHQId;
              return (
                <button
                  key={membership.companyHqId}
                  onClick={() => handleSwitch(membership.companyHqId)}
                  disabled={switching || isCurrent}
                  className={`w-full text-left p-4 rounded-lg border-2 transition ${
                    isCurrent
                      ? 'border-blue-500 bg-blue-50 cursor-not-allowed'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                  } ${switching ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Building2 className="h-5 w-5 text-gray-400" />
                        <h3 className="font-semibold text-gray-900">
                          {membership.company_hqs?.companyName || 'Unnamed Company'}
                        </h3>
                      </div>
                      <div className="ml-8 space-y-1">
                        <p className="text-sm text-gray-600">
                          Industry: {membership.company_hqs?.companyIndustry || 'Not specified'}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            membership.role === 'OWNER' 
                              ? 'bg-purple-100 text-purple-800'
                              : membership.role === 'MANAGER'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {membership.role}
                          </span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Current
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {switching && !isCurrent && (
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={() => router.push('/growth-dashboard')}
              className="text-gray-600 hover:text-gray-900 text-sm"
            >
              ← Cancel and return to dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

