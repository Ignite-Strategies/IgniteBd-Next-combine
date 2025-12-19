'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Settings,
  List,
  ArrowRight,
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
    description: 'Modify, enrich, or update existing contacts.',
    route: '/people/manage',
    icon: Settings,
    containerClasses:
      'from-indigo-50 to-indigo-100 border-indigo-200 hover:border-indigo-400',
    iconClasses: 'bg-indigo-500 text-white',
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
  const [checking, setChecking] = useState(true);

  const checkContactCount = useCallback(async (tenantId) => {
    if (!tenantId) {
      setChecking(false);
      return;
    }
    try {
      const response = await api.get(`/api/contacts?companyHQId=${tenantId}`);

      if (response.data?.success && response.data.contacts) {
        const contacts = response.data.contacts;
        const count = contacts.length;
        setContactCount(count);
        
        // Redirect if no contacts
        if (count === 0) {
          router.push('/people/load');
          return;
        }
        
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('contacts', JSON.stringify(contacts));
        }
      } else {
        setContactCount(0);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('contacts', JSON.stringify([]));
        }
        // Redirect if no contacts
        router.push('/people/load');
        return;
      }
    } catch (error) {
      console.error('Error checking contacts:', error);
    } finally {
      setChecking(false);
    }
  }, [router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const storedCompanyHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedCompanyHQId);

    // Check cached contacts first
    const cachedContacts = window.localStorage.getItem('contacts');
    if (cachedContacts) {
      try {
        const contacts = JSON.parse(cachedContacts);
        const count = contacts.length;
        setContactCount(count);
        
        // Still check with API to ensure accuracy
        if (storedCompanyHQId) {
          checkContactCount(storedCompanyHQId);
        } else {
          setChecking(false);
        }
      } catch (error) {
        console.warn('Failed to parse cached contacts', error);
        if (storedCompanyHQId) {
          checkContactCount(storedCompanyHQId);
        } else {
          setChecking(false);
        }
      }
    } else if (storedCompanyHQId) {
      checkContactCount(storedCompanyHQId);
    } else {
      setChecking(false);
    }
  }, [checkContactCount]);

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-2xl font-bold text-gray-900">Loading...</div>
          <div className="text-gray-600">Checking your contacts</div>
        </div>
      </div>
    );
  }

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
            {contactCount > 0 && (
              <div className="text-right">
                <div className="text-sm text-gray-500">Contacts</div>
                <div className="text-2xl font-bold text-gray-900">
                  {contactCount}
                </div>
              </div>
            )}
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
