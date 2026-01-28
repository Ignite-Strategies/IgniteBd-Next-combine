'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  FileSpreadsheet,
  UserPlus,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';

// LinkedIn Logo SVG Component
const LinkedInIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="#0077B5" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

// Microsoft Logo SVG Component
const MicrosoftIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="11" height="11" fill="#F25022"/>
    <rect x="12" y="0" width="11" height="11" fill="#7FBA00"/>
    <rect x="0" y="12" width="11" height="11" fill="#00A4EF"/>
    <rect x="12" y="12" width="11" height="11" fill="#FFB900"/>
  </svg>
);

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
      icon: MicrosoftIcon,
      isSvg: true,
      containerClasses:
        'from-blue-50 to-blue-100 border-blue-200 hover:border-blue-400',
      iconClasses: 'bg-white',
      primary: true,
    },
    {
      id: 'discover-linkedin',
      title: 'Import with LinkedIn',
      description: 'Find people in your network and add them as contacts',
      route: companyHQId ? `/contacts/enrich/linkedin?companyHQId=${companyHQId}` : '/contacts/enrich/linkedin',
      icon: LinkedInIcon,
      isSvg: true,
      containerClasses:
        'from-blue-50 to-blue-100 border-blue-200 hover:border-blue-400',
      iconClasses: 'bg-white',
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
                      {option.isSvg ? (
                        <Icon className="h-7 w-7" />
                      ) : (
                        <Icon className="h-6 w-6" />
                      )}
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




