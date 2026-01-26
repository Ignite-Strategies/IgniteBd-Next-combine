'use client';

import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Edit, Users, GitBranch } from 'lucide-react';

const MODIFY_OPTIONS = [
  {
    id: 'edit-fields',
    title: 'Edit Contact Fields',
    description: 'View and edit individual contact details',
    route: '/contacts/view',
    icon: Edit,
  },
  {
    id: 'batch-edit',
    title: 'Batch Edit Contacts',
    description: 'Modify multiple contacts at once',
    route: '/contacts/view',
    icon: Users,
  },
  {
    id: 'change-stage',
    title: 'Change Deal Stage',
    description: 'Update pipeline stages for contacts',
    route: '/contacts/deal-pipelines',
    icon: GitBranch,
  },
];

export default function ModifyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Modify Contacts"
          subtitle="Edit contact fields, batch edit, or change deal stages"
          backTo="/people/manage"
          backLabel="Back to Manage"
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {MODIFY_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => router.push(option.route)}
                className="group rounded-xl border-2 border-gray-200 bg-white p-6 text-left transition hover:border-blue-400 hover:bg-blue-50"
              >
                <div className="mb-4 flex items-center">
                  <div className="mr-3 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 transition group-hover:bg-blue-500 group-hover:text-white">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {option.title}
                    </h3>
                  </div>
                </div>
                <p className="text-sm text-gray-700">{option.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}






