'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { FileCode, Plus } from 'lucide-react';

/**
 * Templates Main Forker Page
 * 2-option approach: View/Edit Templates or Create New
 */
function TemplatesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';

  // Redirect if no companyHQId in URL
  useEffect(() => {
    if (!companyHQId && typeof window !== 'undefined') {
      const stored = localStorage.getItem('companyHQId');
      if (stored) {
        router.replace(`/templates?companyHQId=${stored}`);
      }
    }
  }, [companyHQId, router]);

  // Log CompanyHQ from URL params
  useEffect(() => {
    if (companyHQId) {
      console.log('🏢 CompanyHQ from URL params:', {
        companyHQId,
        timestamp: new Date().toISOString(),
      });
    }
  }, [companyHQId]);

  const OPTIONS = [
    {
      id: 'library',
      title: 'View/Edit Templates',
      description: 'Browse and edit your existing email templates',
      icon: FileCode,
      buttonText: 'View Templates',
      route: companyHQId ? `/templates/library-email?companyHQId=${companyHQId}` : '/templates/library-email',
    },
    {
      id: 'create',
      title: 'Create New',
      description: 'Create a new email template using Manual, AI, or Clone',
      icon: Plus,
      buttonText: 'Create New',
      route: companyHQId ? `/templates/create?companyHQId=${companyHQId}` : '/templates/create',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Email Templates"
          subtitle="Manage your email templates for outreach campaigns"
        />

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <div
                key={option.id}
                onClick={() => router.push(option.route)}
                className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer hover:border-red-300"
              >
                <div className="flex flex-col items-center text-center mb-4">
                  <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center mb-3">
                    <Icon className="h-6 w-6 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {option.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {option.description}
                  </p>
                </div>
                <button className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
                  {option.buttonText}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <TemplatesContent />
    </Suspense>
  );
}

