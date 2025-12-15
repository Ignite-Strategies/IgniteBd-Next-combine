'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useOwner } from '@/hooks/useOwner';

export default function WelcomePage() {
  const router = useRouter();
  const { owner, loading, hydrated, error } = useOwner();

  // Auto-redirect to dashboard once hydrated
  useEffect(() => {
    if (hydrated && !loading) {
      router.replace('/growth-dashboard');
    }
  }, [hydrated, loading, router]);

  // Loading state
  if (loading || !hydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4" />
          <p className="text-white text-xl">Loading your account...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="bg-white rounded-xl shadow-xl p-8">
            <p className="text-red-600 text-lg mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Welcome screen (brief flash before redirect)
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {owner?.firstName
              ? `Welcome, ${owner.firstName}!`
              : owner?.name
              ? `Welcome, ${owner.name.split(' ')[0]}!`
              : owner?.email
              ? `Welcome, ${owner.email.split('@')[0]}!`
              : 'Welcome!'}
          </h1>
          <p className="text-gray-600 mb-6">Redirecting to dashboard...</p>
        </div>
      </div>
    </div>
  );
}
