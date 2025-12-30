'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CompanyCreateSuccessPage() {
  const router = useRouter();
  const [companyName] = useState(() => {
    if (typeof window === 'undefined') return 'Your Company';
    try {
      const storedCompany = localStorage.getItem('companyHQ');
      const parsed = storedCompany ? JSON.parse(storedCompany) : null;
      return parsed?.companyName || 'Your Company';
    } catch (error) {
      console.warn('Failed to parse companyHQ from storage', error);
      return 'Your Company';
    }
  });
  const [companyId] = useState(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('companyHQId');
  });

  useEffect(() => {
    if (!companyId) {
      // No company ID - redirect to company setup
      router.push('/company/profile');
      return;
    }

    const timer = setTimeout(() => {
      // Redirect to dashboard with companyHQId param
      router.push(`/growth-dashboard?companyHQId=${companyId}`);
    }, 5000);

    return () => clearTimeout(timer);
  }, [router, companyId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full text-center">
        <div className="mb-8">
          <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
            <span className="text-5xl">✓</span>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-xl p-8 border border-white/20">
          <h1 className="text-4xl font-bold text-white mb-4">
            Company Created Successfully!
          </h1>
          <p className="text-white/80 text-lg mb-2">
            <strong>{companyName}</strong> has been set up. You&apos;re now ready to start building customer relationships.
          </p>
          {companyId && (
            <p className="text-white/60 text-sm mb-8">
              Company ID: {companyId.substring(0, 20)}...
            </p>
          )}

          <div className="bg-white/5 rounded-lg p-6 mb-8 text-left">
            <h2 className="text-xl font-semibold text-white mb-4">Next Steps:</h2>
            <ul className="space-y-3 text-white/80">
              <li className="flex items-start gap-3">
                <span className="text-green-400 text-xl mt-1">✓</span>
                <span>Your company profile is complete</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-400 text-xl mt-1">→</span>
                <span>Start adding contacts to build your network</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-400 text-xl mt-1">→</span>
                <span>Take the assessment to understand your growth potential</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-400 text-xl mt-1">→</span>
                <span>Explore tools and services to maximize customer relationships</span>
              </li>
            </ul>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => {
                if (companyId) {
                  router.push(`/growth-dashboard?companyHQId=${companyId}`);
                } else {
                  router.push('/company/profile');
                }
              }}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold rounded-lg hover:shadow-lg transition-all"
            >
              Go to Dashboard →
            </button>
          </div>

          <p className="text-white/60 text-sm mt-4">
            Redirecting to dashboard in 5 seconds...
          </p>
        </div>
      </div>
    </div>
  );
}

