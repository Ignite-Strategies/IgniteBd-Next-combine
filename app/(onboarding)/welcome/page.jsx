'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useOwner } from '@/hooks/useOwner';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';
import api from '@/lib/api';
import { RefreshCw } from 'lucide-react';

export default function WelcomePage() {
  const router = useRouter();
  const { owner, loading, hydrated, error } = useOwner();
  const { companyHQId } = useCompanyHQ();
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [syncSuccess, setSyncSuccess] = useState(false);

  // Always go to dashboard - profile changes happen in settings
  const nextRoute = '/growth-dashboard';

  const handleContinue = () => {
    router.push(nextRoute);
  };

  const handleSyncContacts = useCallback(async () => {
    if (!companyHQId) {
      setSyncError('Company ID not available. Please refresh the page.');
      return;
    }

    setSyncing(true);
    setSyncError('');
    setSyncSuccess(false);

    try {
      console.log('🔄 Syncing contacts for companyHQId:', companyHQId);
      const response = await api.get(`/api/contacts?companyHQId=${companyHQId}`);
      
      if (response.data?.success && Array.isArray(response.data.contacts)) {
        const fetchedContacts = response.data.contacts;
        console.log('✅ Synced contacts:', fetchedContacts.length);
        
        // Store in localStorage
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('contacts', JSON.stringify(fetchedContacts));
        }
        
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 3000);
      } else {
        setSyncError('Failed to sync contacts. Please try again.');
      }
    } catch (err) {
      console.error('❌ Error syncing contacts:', err);
      setSyncError(err.response?.data?.error || err.message || 'Failed to sync contacts');
    } finally {
      setSyncing(false);
    }
  }, [companyHQId]);

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

  // Welcome screen
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
          <p className="text-gray-600 mb-6">
            {owner?.companyHQ?.companyName
              ? `Ready to manage ${owner.companyHQ.companyName}?`
              : 'Ready to get started?'}
          </p>

          {/* Sync Contacts Button */}
          <div className="mb-4">
            <button
              onClick={handleSyncContacts}
              disabled={syncing || !companyHQId}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                syncing || !companyHQId
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing Contacts...' : 'Sync Contacts'}
            </button>
            {syncError && (
              <p className="mt-2 text-sm text-red-600 text-center">{syncError}</p>
            )}
            {syncSuccess && (
              <p className="mt-2 text-sm text-green-600 text-center">
                ✓ Contacts synced successfully!
              </p>
            )}
          </div>

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
