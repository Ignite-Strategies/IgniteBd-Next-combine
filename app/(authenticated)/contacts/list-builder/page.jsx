'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, Building2, Filter, CheckCircle, ArrowRight } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';

const FILTER_OPTIONS = [
  {
    id: 'all',
    name: 'Contacts',
    description: 'Select from all contacts in your CRM.',
    icon: Users,
  },
  {
    id: 'company',
    name: 'Filter by Company',
    description: 'Select contacts from specific companies.',
    icon: Building2,
  },
  {
    id: 'stage',
    name: 'Filter by Stage',
    description: 'Select contacts by pipeline stage.',
    icon: Filter,
  },
];

function ContactListBuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const [selectedFilter, setSelectedFilter] = useState('');
  const [selectAll, setSelectAll] = useState(false);

  const handleContinue = () => {
    if (!selectedFilter) {
      alert('Please select a filter option.');
      return;
    }

    // Navigate to selection page with filter params and returnTo
    const params = new URLSearchParams({ filter: selectedFilter });
    if (selectAll) {
      params.append('selectAll', 'true');
    }
    if (returnTo) {
      params.append('returnTo', returnTo);
    }
    router.push(`/contacts/list-builder/preview?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Create Contact List"
          subtitle="Select how you want to filter contacts"
          backTo="/contacts/list-manager"
          backLabel="Back to Lists"
        />

        <div className="mb-6 rounded-2xl bg-white p-6 shadow-lg">
          <h3 className="mb-6 text-lg font-semibold text-gray-900">
            Choose Filter Type
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FILTER_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = selectedFilter === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedFilter(option.id)}
                  className={`rounded-xl border-2 p-6 text-left transition ${
                    active
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex flex-col items-start gap-4">
                    <div
                      className={`rounded-lg p-3 ${
                        active ? 'bg-indigo-100' : 'bg-gray-100'
                      }`}
                    >
                      <Icon className="h-6 w-6 text-gray-700" />
                    </div>
                    <div className="flex-1 w-full">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">
                          {option.name}
                        </h4>
                        {active && (
                          <CheckCircle className="h-5 w-5 text-indigo-600 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {option.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {selectedFilter && (
          <div className="mb-6 rounded-2xl bg-white p-6 shadow-lg">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={(e) => setSelectAll(e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="font-semibold text-gray-900">Select All</span>
                <p className="text-sm text-gray-600 mt-1">
                  Automatically select all contacts matching your filter
                </p>
              </div>
            </label>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/contacts/list-manager')}
            className="rounded-lg bg-gray-100 px-6 py-2 font-semibold text-gray-700 transition hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!selectedFilter}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue to Selection
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContactListBuilderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <PageHeader
            title="Create Contact List"
            subtitle="Select how you want to filter contacts"
            backTo="/contacts/list-manager"
            backLabel="Back to Lists"
          />
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Loading...</div>
          </div>
        </div>
      </div>
    }>
      <ContactListBuilderContent />
    </Suspense>
  );
}
