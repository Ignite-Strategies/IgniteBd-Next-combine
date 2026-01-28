'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Sparkles,
  Mail,
  ArrowRight,
  FileSpreadsheet,
  UserPlus,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';

function LoadUpPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId');
  const LOAD_OPTIONS = [
    {
      id: 'import-csv',
      title: 'Upload CSV',
      description: 'Upload a CSV file to import contacts in bulk',
      route: companyHQId 
        ? `/contacts/upload?companyHQId=${companyHQId}`
        : '/contacts/upload',
      icon: FileSpreadsheet,
      containerClasses:
        'from-green-50 to-green-100 border-green-200 hover:border-green-400',
      iconClasses: 'bg-green-500 text-white',
      primary: true,
    },
    {
      id: 'import-microsoft',
      title: 'Import from Microsoft',
      description: 'Import from Outlook emails or Microsoft Contacts address book',
      route: companyHQId 
        ? `/contacts/ingest/microsoft?companyHQId=${companyHQId}`
        : '/contacts/ingest/microsoft',
      icon: Mail,
      containerClasses:
        'from-indigo-50 to-indigo-100 border-indigo-200 hover:border-indigo-400',
      iconClasses: 'bg-indigo-500 text-white',
      primary: true,
    },
    {
      id: 'discover-linkedin',
      title: 'Enrich with LinkedIn',
      description: 'Find people in your network and add them as contacts',
      route: companyHQId ? `/contacts/enrich/linkedin?companyHQId=${companyHQId}` : '/contacts/enrich/linkedin',
      icon: Sparkles,
      containerClasses:
        'from-purple-50 to-purple-100 border-purple-200 hover:border-purple-400',
      iconClasses: 'bg-purple-500 text-white',
      primary: true,
    },
    {
      id: 'add-manual',
      title: 'Add Manually',
      description: 'Enter contact information one at a time',
      route: companyHQId 
        ? `/contacts/manual?companyHQId=${companyHQId}`
        : '/contacts/manual',
      icon: UserPlus,
      containerClasses:
        'from-blue-50 to-blue-100 border-blue-200 hover:border-blue-400',
      iconClasses: 'bg-blue-500 text-white',
      primary: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="📥 Load Up"
          subtitle="Get people into Ignite BD"
          backTo={companyHQId ? `/people?companyHQId=${companyHQId}` : '/people'}
          backLabel="Back to People Hub"
        />

        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Import Options
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 max-w-3xl">
            {LOAD_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => router.push(option.route)}
                  className={`group rounded-xl border-2 bg-gradient-to-br p-6 text-left transition ${option.containerClasses}`}
                >
                  <div className="mb-4 flex items-center">
                    <div
                      className={`mr-3 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110 ${option.iconClasses}`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {option.title}
                      </h3>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-500 opacity-0 transition group-hover:opacity-100" />
                  </div>
                  <p className="text-sm text-gray-700">{option.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoadUpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-8">
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <LoadUpPageContent />
    </Suspense>
  );
}




