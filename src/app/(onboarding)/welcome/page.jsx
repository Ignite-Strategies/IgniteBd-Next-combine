'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { useOwner } from '@/hooks/useOwner';

export default function WelcomePage() {
  const router = useRouter();
  const { ownerId, owner, companyHQId, loading, hydrated, error, refresh } = useOwner();
  const [nextRoute, setNextRoute] = useState(null);

  // Refresh from API if not hydrated
  useEffect(() => {
    if (!hydrated && !loading) {
      const timer = setTimeout(() => {
        refresh();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hydrated, loading, refresh]);

  // Check Firebase auth
  useEffect(() => {
    const firebaseUser = getAuth().currentUser;
    if (!firebaseUser) {
      router.replace('/signup');
    }
  }, [router]);

  // Determine next route based on hydration
  useEffect(() => {
    if (!hydrated || loading) return;

    if (!companyHQId || !owner?.ownedCompanies?.length) {
      setNextRoute('/company/create-or-choose');
    } else {
      setNextRoute('/growth-dashboard');
    }
  }, [hydrated, loading, companyHQId, owner]);

  const handleContinue = () => {
    if (nextRoute) {
      router.push(nextRoute);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4" />
          <p className="text-white text-xl">Loading your account...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="bg-white rounded-xl shadow-xl p-8">
            <p className="text-red-600 text-lg mb-4">{error}</p>
            <button
              onClick={() => refresh()}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!hydrated || !nextRoute) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome{owner?.name ? `, ${owner.name.split(' ')[0]}` : ''}!
          </h1>
          <p className="text-gray-600 mb-6">
            {owner?.companyHQ?.companyName
              ? `Ready to manage ${owner.companyHQ.companyName}?`
              : 'Ready to get started?'}
          </p>

          <button
            onClick={handleContinue}
            className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium text-lg transition-colors shadow-lg"
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}

