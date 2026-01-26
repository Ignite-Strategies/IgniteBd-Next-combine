'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  List,
  ArrowRight,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import { useLocalStorage } from '@/hooks/useLocalStorage.js';

export default function OutreachPrepPage() {
  const router = useRouter();
  const [lists, setLists] = useLocalStorage('contactLists', []);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if lists exist
    const checkLists = () => {
      if (lists.length === 0) {
        // Auto-redirect to create list if no lists exist
        router.push('/contacts/list-builder');
        return;
      }
      setChecking(false);
    };

    // Small delay to ensure localStorage is read
    const timer = setTimeout(checkLists, 100);
    return () => clearTimeout(timer);
  }, [lists.length, router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-2xl font-bold text-gray-900">Loading...</div>
          <div className="text-gray-600">Checking your lists</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="📋 Outreach Prep"
          subtitle="Build or select contact lists for outreach"
          backTo="/people"
          backLabel="Back to People Hub"
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Create Contact List */}
          <button
            type="button"
            onClick={() => router.push('/contacts/list-builder')}
            className="group rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-6 text-left transition hover:border-blue-400"
          >
            <div className="mb-4 flex items-center">
              <div className="mr-3 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500 text-white transition-transform group-hover:scale-110">
                <Plus className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  Create Contact List
                </h3>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-500 opacity-0 transition group-hover:opacity-100" />
            </div>
            <p className="text-sm text-gray-700">
              Build a new list from your contacts using filters and criteria.
            </p>
          </button>

          {/* View Existing Lists */}
          <button
            type="button"
            onClick={() => router.push('/contacts/list-manager')}
            className="group rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100 p-6 text-left transition hover:border-purple-400"
          >
            <div className="mb-4 flex items-center">
              <div className="mr-3 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-purple-500 text-white transition-transform group-hover:scale-110">
                <List className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  View Existing Lists
                </h3>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-500 opacity-0 transition group-hover:opacity-100" />
            </div>
            <p className="text-sm text-gray-700">
              Manage and review your existing contact lists ({lists.length} lists).
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}





