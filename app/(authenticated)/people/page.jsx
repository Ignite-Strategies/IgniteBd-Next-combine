'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  List,
  ArrowRight,
  RefreshCw,
  Users,
} from 'lucide-react';
import api from '@/lib/api';

const ACTION_CARDS = [
  {
    id: 'load',
    title: 'Load Up',
    description: 'Get people into Ignite BD.',
    route: '/people/load',
    icon: Upload,
    containerClasses:
      'from-blue-50 to-blue-100 border-blue-200 hover:border-blue-400',
    iconClasses: 'bg-blue-500 text-white',
  },
  {
    id: 'manage',
    title: 'Manage',
    description: 'View all contacts and filter by deal stage.',
    route: '/contacts/view',
    icon: Users,
    containerClasses:
      'from-green-50 to-green-100 border-green-200 hover:border-green-400',
    iconClasses: 'bg-green-500 text-white',
  },
  {
    id: 'outreach-prep',
    title: 'Outreach Prep',
    description: 'Build or select contact lists for outreach.',
    route: '/people/outreach-prep',
    icon: List,
    containerClasses:
      'from-purple-50 to-purple-100 border-purple-200 hover:border-purple-400',
    iconClasses: 'bg-purple-500 text-white',
  },
];

export default function PeopleHubPage() {
  const router = useRouter();
  const [companyHQId, setCompanyHQId] = useState('');
  const [contactCount, setContactCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const hasRedirectedRef = useRef(false);

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
    }
  }, []);

  // Load from localStorage immediately (local-first)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Prevent multiple redirects
    if (hasRedirectedRef.current) return;
    
    const storedCompanyHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedCompanyHQId);

    // Load from cache immediately - no API call
    const cachedContacts = window.localStorage.getItem('contacts');
    if (cachedContacts) {
      try {
        const contacts = JSON.parse(cachedContacts);
        const count = contacts.length;
        setContactCount(count);
        
        // Only redirect if cached count is 0
        if (count === 0 && storedCompanyHQId) {
          hasRedirectedRef.current = true;
          router.push('/people/load');
          return;
        }
      } catch (error) {
        console.warn('Failed to parse cached contacts', error);
        // If cache is corrupted, check if we need to redirect
        if (storedCompanyHQId) {
          hasRedirectedRef.current = true;
          router.push('/people/load');
          return;
        }
      }
    } else {
      // No cache at all - redirect to load if we have companyHQId
      if (storedCompanyHQId) {
        hasRedirectedRef.current = true;
        router.push('/people/load');
        return;
      }
    }

    // Optional: Sync in background (non-blocking) after a short delay
    // This keeps data fresh without blocking the UI
    if (storedCompanyHQId) {
      const syncTimer = setTimeout(() => {
        syncContacts(storedCompanyHQId, false);
      }, 500); // Small delay to let UI render first
      
      return () => clearTimeout(syncTimer);
    }
  }, [syncContacts]);

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
