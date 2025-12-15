'use client';

import { useRouter } from 'next/navigation';
import { Edit, List, FileText } from 'lucide-react';

export default function TemplateHubPage() {
  const router = useRouter();

  const actionCards = [
    {
      title: 'Build Template',
      description: 'Create a new outreach template with structured inputs',
      icon: Edit,
      path: '/template/build',
      color: 'bg-red-50 border-red-200 hover:bg-red-100',
      iconColor: 'text-red-600',
    },
    {
      title: 'Saved Templates',
      description: 'View and manage your saved outreach templates',
      icon: List,
      path: '/template/saved',
      color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
      iconColor: 'text-blue-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900">Templates Hub</h1>
          <p className="mt-2 text-sm text-gray-600">
            Build and manage outreach templates for human, low-pressure relationship maintenance.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {actionCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.path}
                onClick={() => router.push(card.path)}
                className={`rounded-lg border-2 p-6 text-left transition-colors ${card.color}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Icon className={`h-6 w-6 ${card.iconColor}`} />
                      <h3 className="text-lg font-semibold text-gray-900">{card.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600">{card.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">About Outreach Templates</h3>
              <p className="text-sm text-gray-600">
                Outreach templates help you re-enter or maintain human relationships using lightweight, 
                low-pressure outreach. Templates are built from structured inputs (relationship type, 
                person type, why you're reaching out) and composed into human, optional messages 
                without sales language or pressure.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

