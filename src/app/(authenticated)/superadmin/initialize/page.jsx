'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, CheckCircle2, ArrowRight, Home } from 'lucide-react';
import api from '@/lib/api';

export default function SuperAdminInitialize() {
  const router = useRouter();
  const [owner, setOwner] = useState(null);
  const [ownerId, setOwnerId] = useState(null);
  const [initializing, setInitializing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  // Step 1: Just load from localStorage (ownerId already set from welcome)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedOwnerId = localStorage.getItem('ownerId');
    const storedOwner = localStorage.getItem('owner');

    if (storedOwnerId) {
      setOwnerId(storedOwnerId);
    }

    if (storedOwner) {
      try {
        const ownerData = JSON.parse(storedOwner);
        setOwner(ownerData);
      } catch (err) {
        console.warn('Failed to parse stored owner:', err);
      }
    }

    // If no ownerId in localStorage, redirect to login
    if (!storedOwnerId) {
      router.replace('/signup');
    }
  }, [router]);

  // Step 3: Only upsert when button is clicked
  const handleInitialize = async () => {
    if (!ownerId) {
      setError('No owner ID found. Please sign in again.');
      return;
    }

    try {
      setInitializing(true);
      setError(null);

      console.log('🚀 SuperAdmin Initialize: Calling upsert API for ownerId:', ownerId);
      const response = await api.post('/api/admin/superadmin/upsert');

      if (response.data?.success) {
        setSuccess(true);
        console.log('✅ SuperAdmin Initialize: Success!');
      } else {
        setError(response.data?.error || 'Failed to initialize SuperAdmin');
      }
    } catch (err) {
      console.error('❌ SuperAdmin Initialize: Error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to initialize SuperAdmin');
    } finally {
      setInitializing(false);
    }
  };

  // Step 2: Show welcome message (proof we have the user)
  if (!ownerId || !owner) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mb-4">
              <Shield className="h-8 w-8 text-yellow-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome{owner?.name ? `, ${owner.name.split(' ')[0]}` : ''}!
            </h1>
            <p className="text-sm text-gray-600 mb-4">
              {owner?.email && `Logged in as: ${owner.email}`}
            </p>
            <p className="text-sm text-gray-600">
              Would you like to become a SuperAdmin?
            </p>
          </div>

          {success ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <div className="flex items-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mr-2" />
                  <p className="text-sm font-medium text-green-900">
                    SuperAdmin role initialized successfully!
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => router.push('/admin/switchboard')}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
                >
                  Go to Tenant Switchboard
                  <ArrowRight className="h-5 w-5" />
                </button>
                <button
                  onClick={() => router.push('/growth-dashboard')}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Return to Dashboard
                  <Home className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <button
                onClick={handleInitialize}
                disabled={initializing}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-yellow-600 px-4 py-3 text-white font-medium hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {initializing ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Initializing...
                  </>
                ) : (
                  <>
                    <Shield className="h-5 w-5" />
                    Yes, Make Me SuperAdmin
                  </>
                )}
              </button>

              <button
                onClick={() => router.push('/growth-dashboard')}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                <Home className="h-5 w-5" />
                No, Return to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

