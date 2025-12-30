'use client';

import { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Upload,
  List,
  ArrowRight,
  RefreshCw,
  Users,
} from 'lucide-react';
import api from '@/lib/api';

function PeopleHubPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  const hasRedirectedRef = useRef(false);
  
  const [contactCount, setContactCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [initialSyncComplete, setInitialSyncComplete] = useState(false);

  // Sync contacts from API (non-blocking, background)
  const syncContacts = useCallback(async (tenantId, showLoading = false) => {
    if (!tenantId) return;
    
    if (showLoading) setSyncing(true);
    
    try {
      const response = await api.get(`/api/contacts?companyHQId=${tenantId}`);

      if (response.data?.success && response.data.contacts) {
        const contacts = response.data.contacts;
        const count = contacts.length;
        setContactCount(count);
        
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('contacts', JSON.stringify(contacts));
        }
      } else {
        const count = 0;
        setContactCount(count);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('contacts', JSON.stringify([]));
        }
      }
    } catch (error) {
      console.error('Error syncing contacts:', error);
      // Don't update state on error - keep cached data
    } finally {
      if (showLoading) setSyncing(false);
      setInitialSyncComplete(true);
    }
  }, []);

  // Redirect if no companyHQId in URL - URL param is the ONLY source of truth
  // Add delay to let searchParams load before redirecting
  useEffect(() => {
    if (hasRedirectedRef.current) return;
    
    const checkAndRedirect = () => {
      if (typeof window === 'undefined') return;
      
      // Check if URL actually has companyHQId
      const currentUrl = window.location.href;
      const urlHasCompanyHQId = currentUrl.includes('companyHQId=');
      
      // If URL has companyHQId or searchParams has it, we're good
      if (urlHasCompanyHQId || companyHQId) {
        return; // No redirect needed
      }
      
      // URL truly doesn't have companyHQId - redirect to welcome
      hasRedirectedRef.current = true;
      console.warn('⚠️ People: No companyHQId in URL - redirecting to welcome');
      router.push('/welcome');
    };
    
    // Small delay to let searchParams load
    const timeoutId = setTimeout(checkAndRedirect, 100);
    return () => clearTimeout(timeoutId);
  }, [companyHQId, router]);

  // Load from cache and sync when companyHQId is available
  useEffect(() => {
    if (!companyHQId) return;
    
    // Load from cache immediately - no API call
    const cachedContacts = typeof window !== 'undefined' ? window.localStorage.getItem('contacts') : null;
    if (cachedContacts) {
      try {
        const contacts = JSON.parse(cachedContacts);
        const count = contacts.length;
        setContactCount(count);
        
        // If we have cached contacts, no need to wait for sync
        if (count > 0) {
          setInitialSyncComplete(true);
        }
      } catch (error) {
        console.warn('Failed to parse cached contacts', error);
      }
    }

    // Always do an initial sync to verify data is up to date
    syncContacts(companyHQId, false);
  }, [companyHQId, syncContacts]);

  // Handle redirect after initial sync completes
  useEffect(() => {
    if (!initialSyncComplete || hasRedirectedRef.current) return;
    if (!companyHQId) return;
    
    // Only redirect if we've confirmed there are no contacts after sync
    if (contactCount === 0) {
      hasRedirectedRef.current = true;
      router.push('/people/load');
    }
  }, [initialSyncComplete, contactCount, companyHQId, router]);

  const ACTION_CARDS = [
    {
      id: 'load',
      title: 'Load Up',
      description: 'Get people into Ignite BD.',
      route: companyHQId ? `/people/load?companyHQId=${companyHQId}` : '/people/load',
      icon: Upload,
      containerClasses:
        'from-blue-50 to-blue-100 border-blue-200 hover:border-blue-400',
      iconClasses: 'bg-blue-500 text-white',
    },
    {
      id: 'manage',
      title: 'Manage',
      description: 'View all contacts and filter by deal stage.',
      route: companyHQId ? `/contacts/view?companyHQId=${companyHQId}` : '/contacts/view',
      icon: Users,
      containerClasses:
        'from-green-50 to-green-100 border-green-200 hover:border-green-400',
      iconClasses: 'bg-green-500 text-white',
    },
    {
      id: 'outreach-prep',
      title: 'Outreach Prep',
      description: 'Build or select contact lists for outreach.',
      route: companyHQId ? `/people/outreach-prep?companyHQId=${companyHQId}` : '/people/outreach-prep',
      icon: List,
      containerClasses:
        'from-purple-50 to-purple-100 border-purple-200 hover:border-purple-400',
      iconClasses: 'bg-purple-500 text-white',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="mb-2 text-4xl font-bold text-gray-900">
                👥 People Hub
              </h1>
              <p className="text-lg text-gray-600">
                Manage your contacts and prepare for outreach.
              </p>
            </div>
            <div className="flex items-center gap-4">
              {contactCount > 0 && (
                <div className="text-right">
                  <div className="text-sm text-gray-500">Contacts</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {contactCount}
                  </div>
                </div>
              )}
              {companyHQId && (
                <button
                  type="button"
                  onClick={() => syncContacts(companyHQId, true)}
                  disabled={syncing}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    syncing
                      ? 'cursor-not-allowed bg-gray-300 text-gray-500'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <RefreshCw className={syncing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                  {syncing ? 'Syncing…' : 'Sync'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {ACTION_CARDS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => router.push(action.route)}
                className={`group rounded-xl border-2 bg-gradient-to-br p-6 text-left transition ${action.containerClasses}`}
              >
                <div className="mb-4 flex items-center">
                  <div
                    className={`mr-3 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110 ${action.iconClasses}`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {action.title}
                    </h3>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-500 opacity-0 transition group-hover:opacity-100" />
                </div>
                <p className="text-sm text-gray-700">{action.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function PeopleHubPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-8">
            <RefreshCw className="animate-spin h-6 w-6 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <PeopleHubPageContent />
    </Suspense>
  );
}
