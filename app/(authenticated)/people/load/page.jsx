'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Upload,
  Sparkles,
  Mail,
  User,
  FileSpreadsheet,
  ArrowRight,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';

function LoadUpPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId');

  const LOAD_OPTIONS = [
    {
      id: 'upload-csv',
      title: 'Upload CSV',
      description: 'Bulk import contacts from a CSV file',
      route: companyHQId ? `/contacts/upload?companyHQId=${companyHQId}` : '/contacts/upload',
      icon: FileSpreadsheet,
      containerClasses:
        'from-blue-50 to-blue-100 border-blue-200 hover:border-blue-400',
      iconClasses: 'bg-blue-500 text-white',
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
      id: 'import-microsoft',
      title: 'Import from Microsoft',
      description: 'Import from Outlook emails or Microsoft Contacts address book',
      route: companyHQId ? `/contacts/ingest/microsoft?companyHQId=${companyHQId}` : '/contacts/ingest/microsoft',
      icon: Mail,
      containerClasses:
        'from-indigo-50 to-indigo-100 border-indigo-200 hover:border-indigo-400',
      iconClasses: 'bg-indigo-500 text-white',
      primary: true,
    },
    {
      id: 'import-google',
      title: 'Import from Google',
      description: 'Import contacts from Google Workspace (coming soon - similar to Microsoft)',
      route: companyHQId ? `/people/load/google?companyHQId=${companyHQId}` : '/people/load/google',
      icon: Mail,
      containerClasses:
        'from-green-50 to-green-100 border-green-200 hover:border-green-400 opacity-75',
      iconClasses: 'bg-green-500 text-white',
      primary: true,
      disabled: true,
    },
  ];

  const SECONDARY_OPTIONS = [
    {
      id: 'manual-add',
      title: 'Add Manually',
      description: 'Enter a single contact one at a time (name, email, company, etc.)',
      route: companyHQId ? `/contacts/manual?companyHQId=${companyHQId}` : '/contacts/manual',
      icon: User,
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
            Primary Options
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {LOAD_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isDisabled = option.disabled;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => !isDisabled && router.push(option.route)}
                  disabled={isDisabled}
                  className={`group rounded-xl border-2 bg-gradient-to-br p-6 text-left transition ${
                    isDisabled
                      ? 'cursor-not-allowed opacity-60'
                      : option.containerClasses
                  }`}
                >
                  <div className="mb-4 flex items-center">
                    <div
                      className={`mr-3 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg transition-transform ${
                        isDisabled ? '' : 'group-hover:scale-110'
                      } ${option.iconClasses}`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {option.title}
                        {isDisabled && (
                          <span className="ml-2 text-xs font-normal text-gray-500">
                            (Coming Soon)
                          </span>
                        )}
                      </h3>
                    </div>
                    {!isDisabled && (
                      <ArrowRight className="h-5 w-5 text-gray-500 opacity-0 transition group-hover:opacity-100" />
                    )}
                  </div>
                  <p className="text-sm text-gray-700">{option.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Quick Add
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            Need to add just one contact? Use manual entry for a quick, simple form.
          </p>
          <div className="space-y-3">
            {SECONDARY_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => router.push(option.route)}
                  className="group w-full rounded-lg border-2 border-blue-200 bg-blue-50 p-4 text-left transition hover:border-blue-400 hover:bg-blue-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500 text-white transition group-hover:bg-blue-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {option.title}
                      </h3>
                      <p className="text-sm text-gray-700">
                        {option.description}
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-blue-600 opacity-0 transition group-hover:opacity-100" />
                  </div>
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




