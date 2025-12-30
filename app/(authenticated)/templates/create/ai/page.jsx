'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Zap, Heart } from 'lucide-react';

/**
 * AI Template Creation Fork Page
 * Choose between Quick Idea or Relationship-aware AI generation
 */
function AITemplateCreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';

  // Redirect if no companyHQId in URL
  useEffect(() => {
    if (!companyHQId && typeof window !== 'undefined') {
      const stored = localStorage.getItem('companyHQId');
      if (stored) {
        router.replace(`/templates/create/ai?companyHQId=${stored}`);
      } else {
        router.push('/templates');
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

  const handleOptionSelect = (option) => {
    const baseParams = companyHQId ? `?companyHQId=${companyHQId}` : '';
    switch (option) {
      case 'quick': {
        router.push(`/templates/create/ai/quick${baseParams}`);
        break;
      }
      case 'relationship': {
        router.push(`/templates/create/ai/relationship${baseParams}`);
        break;
      }
    }
  };

  const OPTIONS = [
    {
      id: 'quick',
      title: 'AI Quick Idea',
      description: 'Give AI a simple idea and it will generate a template with inferred relationship and variables.',
      icon: Zap,
      buttonText: 'Quick Idea',
    },
    {
      id: 'relationship',
      title: 'AI Relationship-Aware',
      description: 'Use AI with relationship context. Fill in your own details or use a prebuilt template.',
      icon: Heart,
      buttonText: 'Relationship-Aware',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create Template with AI</h1>
            <p className="mt-1 text-sm text-gray-600">
              Choose your AI generation method
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <div
                key={option.id}
                className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer hover:border-red-300"
                onClick={() => handleOptionSelect(option.id)}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {option.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {option.description}
                    </p>
                  </div>
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

export default function AITemplateCreatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AITemplateCreateContent />
    </Suspense>
  );
}

