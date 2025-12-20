'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { useOwner } from '@/hooks/useOwner';

export default function SetupWizard({ companyHQ, hasContacts = false, onComplete }) {
  const router = useRouter();
  const { owner } = useOwner(); // CRITICAL: Use hook exclusively - NO API calls to hydrate
  const [hasAssessment, setHasAssessment] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [companyComplete, setCompanyComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Check what's been completed
  const hasCompany = companyHQ && companyHQ.id;

  // Check owner profile completeness
  // CRITICAL: Owner must come from hook (already hydrated on welcome) - NO API calls to hydrate
  useEffect(() => {
    if (owner) {
      // Use owner from hook - check if owner has name and email
      setHasProfile(!!(owner?.name && owner?.email));
    } else {
      // Owner not available from hook - assume incomplete
      setHasProfile(false);
    }
  }, [owner]);

  // Check company completeness
  useEffect(() => {
    if (!hasCompany) {
      setCompanyComplete(false);
      setLoading(false);
      return;
    }

    const check = () => {
      // Check if company has required fields
      const companyStr = typeof window !== 'undefined' ? localStorage.getItem('companyHQ') : null;
      if (companyStr) {
        try {
          const hq = JSON.parse(companyStr);
          // Check if company has name, whatYouDo, and industry at minimum
          setCompanyComplete(!!(hq?.companyName && hq?.whatYouDo && hq?.companyIndustry));
        } catch (e) {
          setCompanyComplete(false);
        }
      } else if (companyHQ) {
        setCompanyComplete(!!(companyHQ?.companyName && companyHQ?.whatYouDo && companyHQ?.companyIndustry));
      } else {
        setCompanyComplete(false);
      }
      setLoading(false);
    };

    check();
  }, [companyHQ, hasCompany]);

  // Check if assessment is completed
  useEffect(() => {
    const checkAssessment = async () => {
      try {
        // Check if Firebase auth is ready
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        if (!auth.currentUser) {
          // User not authenticated yet, skip check
          setHasAssessment(false);
          return;
        }

        const companyHQId = companyHQ?.id || 
          (typeof window !== 'undefined' ? localStorage.getItem('companyHQId') : null);
        
        if (!companyHQId) {
          setHasAssessment(false);
          return;
        }

        const response = await api.get(`/api/assessment?companyHQId=${companyHQId}`);
        if (response.data.success && response.data.assessments?.length > 0) {
          setHasAssessment(true);
        } else {
          setHasAssessment(false);
        }
      } catch (err) {
        // Silently handle assessment check failures - not critical
        setHasAssessment(false);
      }
    };

    // Only check if companyHQ is available
    if (companyHQ?.id) {
      checkAssessment();
    }
  }, [companyHQ]);
  
  const steps = [
    {
      id: 'profile',
      title: 'Complete Your Profile',
      description: 'Add your name and email',
      completed: hasProfile,
      route: '/settings',
      action: hasProfile ? 'View Profile' : 'Complete Profile'
    },
    {
      id: 'company',
      title: 'Set Up Your Company',
      description: companyComplete ? 'Company profile complete' : 'Add company details',
      completed: companyComplete,
      route: companyComplete ? '/settings' : '/company/profile',
      action: companyComplete ? 'View Company' : hasCompany ? 'Complete Company' : 'Set Up Company'
    },
    {
      id: 'contacts',
      title: 'Add Your First Contacts',
      description: 'Start building your network',
      completed: hasContacts,
      route: '/contacts/upload',
      action: hasContacts ? 'Add More Contacts' : 'Add Contacts'
    },
    {
      id: 'assessment',
      title: 'Complete Growth Assessment',
      description: 'Understand your growth potential',
      completed: hasAssessment,
      route: '/assessment',
      action: 'Start Assessment'
    }
  ];
  
  const completedCount = steps.filter(s => s.completed).length;
  const totalSteps = steps.length;
  const progressPercent = (completedCount / totalSteps) * 100;
  
  // Hide wizard if all steps complete
  if (completedCount === totalSteps && onComplete) {
    return null;
  }

  // Show prominent alert if critical steps are missing
  const criticalStepsIncomplete = !hasProfile || !hasCompany || !companyComplete;
  
  return (
    <div className={`rounded-lg p-6 mb-6 shadow-lg ${
      criticalStepsIncomplete 
        ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300' 
        : 'bg-white border border-gray-200'
    }`}>
      {criticalStepsIncomplete && (
        <div className="mb-4 pb-4 border-b border-amber-200">
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0">
              <div className="rounded-full bg-amber-100 p-2">
                <Circle className="h-5 w-5 text-amber-600" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-amber-900">
                Setup Required
              </h3>
              <p className="text-sm text-amber-700">
                Complete the steps below to get started. Some features may not work until setup is complete.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className={`${criticalStepsIncomplete ? '' : 'p-2'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-900">Getting Started</h2>
          <span className="text-xs text-gray-500">({completedCount}/{totalSteps})</span>
        </div>
        {/* Compact Progress Bar */}
        <div className="flex items-center gap-2">
          <div className="w-24 bg-gray-200 rounded-full h-1.5">
            <div 
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      </div>
      
      {/* Compact Steps - Horizontal or Compact Vertical */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map((step, index) => (
          <button
            key={step.id}
            onClick={() => router.push(step.route)}
            className={`relative flex items-center gap-2 p-2.5 rounded-md border transition-all text-left group ${
              step.completed
                ? 'bg-green-50 border-green-200 hover:bg-green-100'
                : index === completedCount
                ? 'bg-blue-50 border-blue-300 hover:bg-blue-100 shadow-sm'
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}
          >
            {/* Status Icon - Smaller */}
            <div className="flex-shrink-0">
              {step.completed ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <Circle className={`h-4 w-4 ${index === completedCount ? 'text-blue-600' : 'text-gray-400'}`} />
              )}
            </div>
            
            {/* Step Info - Compact */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className={`text-xs font-medium truncate ${
                  step.completed ? 'text-green-900' : index === completedCount ? 'text-blue-900' : 'text-gray-700'
                }`}>
                  {step.title}
                </h3>
                {index === completedCount && !step.completed && (
                  <span className="px-1 py-0.5 bg-blue-200 text-blue-800 text-[10px] font-semibold rounded flex-shrink-0">
                    Next
                  </span>
                )}
              </div>
            </div>
            
            {/* Arrow for next step */}
            {!step.completed && index === completedCount && (
              <ArrowRight className="h-3 w-3 text-blue-600 flex-shrink-0" />
            )}
          </button>
        ))}
      </div>
      
      {/* Dismiss Button (if all complete) */}
      {completedCount === totalSteps && onComplete && (
        <div className="mt-3 pt-3 border-t border-gray-200 text-center">
          <button
            onClick={onComplete}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Hide checklist
          </button>
        </div>
      )}
      </div>
    </div>
  );
}

