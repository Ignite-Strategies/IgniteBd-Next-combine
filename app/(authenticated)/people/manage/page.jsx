'use client';

import { useRouter } from 'next/navigation';
import {
  Edit,
  Link2,
  ArrowRight,
  Users,
  FileEdit,
  GitBranch,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';

const MANAGE_OPTIONS = [
  {
    id: 'modify',
    title: 'Modify',
    description: 'Edit contact fields, batch edit contacts, or change deal stage',
    route: '/people/manage/modify',
    icon: Edit,
    containerClasses:
      'from-blue-50 to-blue-100 border-blue-200 hover:border-blue-400',
    iconClasses: 'bg-blue-500 text-white',
    actions: [
      { label: 'Edit contact fields', route: '/contacts/view' },
      { label: 'Batch edit contacts', route: '/contacts/view' },
      { label: 'Change deal stage', route: '/contacts/deal-pipelines' },
    ],
  },
];

const SECONDARY_OPTIONS = [
  {
    id: 'associate',
    title: 'Link to Business',
    description: 'Associate contacts with companies',
    route: '/people/manage/associate',
    icon: Link2,
  },
];

export default function ManagePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="🛠️ Manage"
          subtitle="Modify, enrich, or update existing contacts"
          backTo="/people"
          backLabel="Back to People Hub"
        />

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          {MANAGE_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <div
                key={option.id}
                className={`group rounded-xl border-2 bg-gradient-to-br p-6 transition ${option.containerClasses}`}
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
                </div>
                <p className="mb-4 text-sm text-gray-700">{option.description}</p>
                
                {option.actions && (
                  <div className="space-y-2">
                    {option.actions.map((action, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => router.push(action.route)}
                        className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm transition hover:border-gray-300 hover:bg-gray-50"
                      >
                        <span className="text-gray-700">{action.label}</span>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {SECONDARY_OPTIONS.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Additional Options
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
        )}
      </div>
    </div>
  );
}

