'use client';

import { useRouter } from 'next/navigation';
import {
  Upload,
  Sparkles,
  Mail,
  User,
  FileSpreadsheet,
  ArrowRight,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';

const LOAD_OPTIONS = [
  {
    id: 'upload-csv',
    title: 'Upload CSV',
    description: 'Bulk import contacts from a CSV file',
    route: '/contacts/upload',
    icon: FileSpreadsheet,
    containerClasses:
      'from-blue-50 to-blue-100 border-blue-200 hover:border-blue-400',
    iconClasses: 'bg-blue-500 text-white',
    primary: true,
  },
  {
    id: 'enrich-loader',
    title: 'Enrich as Loader',
    description: 'Apollo-style enrichment that creates contacts',
    route: '/contacts/enrich',
    icon: Sparkles,
    containerClasses:
      'from-purple-50 to-purple-100 border-purple-200 hover:border-purple-400',
    iconClasses: 'bg-purple-500 text-white',
    primary: true,
  },
  {
    id: 'import-microsoft',
    title: 'Import from Microsoft',
    description: 'Extract contacts from Outlook',
    route: '/contacts/ingest/microsoft',
    icon: Mail,
    containerClasses:
      'from-indigo-50 to-indigo-100 border-indigo-200 hover:border-indigo-400',
    iconClasses: 'bg-indigo-500 text-white',
    primary: true,
  },
  {
    id: 'import-google',
    title: 'Import from Google',
    description: 'Import contacts from Google Workspace',
    route: '/people/load/google', // Placeholder route
    icon: Mail,
    containerClasses:
      'from-green-50 to-green-100 border-green-200 hover:border-green-400',
    iconClasses: 'bg-green-500 text-white',
    primary: true,
  },
];

const SECONDARY_OPTIONS = [
  {
    id: 'manual-add',
    title: 'Add Manually',
    description: 'Enter a single contact without CSV',
    route: '/contacts/manual',
    icon: User,
  },
];

export default function LoadUpPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="📥 Load Up"
          subtitle="Get people into Ignite BD"
          backTo="/people"
          backLabel="Back to People Hub"
        />

        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Primary Options
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Other Options
          </h2>
          <div className="space-y-3">
            {SECONDARY_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => router.push(option.route)}
                  className="group w-full rounded-lg border border-gray-200 bg-white p-4 text-left transition hover:border-gray-300 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition group-hover:bg-gray-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        {option.title}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {option.description}
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400 opacity-0 transition group-hover:opacity-100" />
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
