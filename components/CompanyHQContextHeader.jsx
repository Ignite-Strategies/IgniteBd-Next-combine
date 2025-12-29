'use client';

import { useEffect, useState } from 'react';
import { Building2, AlertCircle, ChevronDown } from 'lucide-react';
import { useOwner } from '@/hooks/useOwner';
import { switchCompanyHQ } from '@/lib/companyhq-switcher';
import { useRouter } from 'next/navigation';

/**
 * CompanyHQ Context Header
 * 
 * Always visible component showing:
 * - Current CompanyHQ name
 * - User's role in that CompanyHQ
 * - Ability to switch to other CompanyHQs if user has multiple memberships
 */
export function CompanyHQContextHeader() {
  const { companyHQ, companyHQId, memberships, owner, refresh } = useOwner();
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [isValid, setIsValid] = useState(true);
  const router = useRouter();

  // Validate context
  useEffect(() => {
    if (!companyHQId || !memberships || memberships.length === 0) {
      setIsValid(false);
      return;
    }

    const hasAccess = memberships.some(m => m.companyHqId === companyHQId);
    if (!hasAccess) {
      setIsValid(false);
      return;
    }

    setIsValid(true);
  }, [companyHQId, memberships]);

  // Get current role
  const currentMembership = memberships?.find(m => m.companyHqId === companyHQId);
  const currentRole = currentMembership?.role || null;

  // Handle context switch
  const handleSwitchCompanyHQ = async (newCompanyHQId) => {
    const result = switchCompanyHQ(newCompanyHQId);
    if (result) {
      await refresh();
      setShowSwitcher(false);
      // Reload page to apply new context
      router.refresh();
    }
  };

  // Don't show if no context
  if (!companyHQId || !companyHQ) {
    return null;
  }

  const hasMultipleCompanies = memberships && memberships.length > 1;

  return (
    <div className="w-full border-b bg-gradient-to-r from-blue-50 to-indigo-50">
      {/* Invalid Context Warning */}
      {!isValid && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2">
          <div className="flex items-center gap-2 text-sm text-red-800">
            <AlertCircle className="w-4 h-4" />
            <span className="font-semibold">Invalid Context:</span>
            <span>You don't have access to CompanyHQ {companyHQId.substring(0, 8)}...</span>
            <span className="text-red-600">Please switch to a CompanyHQ you have membership in.</span>
          </div>
        </div>
      )}

      {/* Main Context Bar */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center justify-between">
          {/* Left: Current Context - Add left margin to account for logo */}
          <div className="flex items-center gap-3 ml-0 sm:ml-0">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Building2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span className="font-medium whitespace-nowrap">Working in:</span>
              <span className="font-semibold text-blue-900 whitespace-nowrap">{companyHQ.companyName}</span>
              
              {currentRole && (
                <>
                  <span className="text-gray-400">•</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 whitespace-nowrap">
                    {currentRole}
                  </span>
                </>
              )}
            </div>

            {/* CompanyHQ ID (truncated, hover to see full) - hidden on smaller screens */}
            <div className="hidden lg:block text-xs text-gray-500 whitespace-nowrap" title={companyHQId}>
              ID: {companyHQId.substring(0, 8)}...
            </div>
          </div>

          {/* Right: Switcher (if multiple companies) */}
          {hasMultipleCompanies && (
            <div className="relative">
              <button
                onClick={() => setShowSwitcher(!showSwitcher)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-white hover:shadow-sm rounded-md border border-gray-300 transition"
              >
                <span>Switch Company</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showSwitcher ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {showSwitcher && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowSwitcher(false)}
                  />
                  
                  {/* Menu */}
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20 py-1">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase border-b">
                      Your Companies
                    </div>
                    {memberships.map((membership) => {
                      const isActive = membership.companyHqId === companyHQId;
                      return (
                        <button
                          key={membership.companyHqId}
                          onClick={() => handleSwitchCompanyHQ(membership.companyHqId)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition ${
                            isActive ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-gray-900">
                                {membership.company_hqs.companyName}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {membership.company_hqs.companyIndustry || 'No industry'}
                              </div>
                            </div>
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
                              {isActive && (
                                <span className="text-blue-600 text-xs">✓ Current</span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Additional Info (if multiple companies) */}
        {hasMultipleCompanies && (
          <div className="mt-1 text-xs text-gray-500 px-4 sm:px-6 lg:px-8">
            You have access to {memberships.length} CompanyHQ{memberships.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

