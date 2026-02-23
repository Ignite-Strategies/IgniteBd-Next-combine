'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Sparkles, FileEdit, Copy, ArrowLeft } from 'lucide-react';

/**
 * Template Creation Fork Page
 * 3-fork approach: Manual, With AI, or From Previous
 */
function TemplateCreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';

  // Redirect if no companyHQId in URL
  useEffect(() => {
    if (!companyHQId && typeof window !== 'undefined') {
      const stored = localStorage.getItem('companyHQId');
      if (stored) {
        router.replace(`/templates/create?companyHQId=${stored}`);
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
      case 'ai-snippets': {
        // Route to AI snippets builder
        router.push(`/templates/create/ai-snippets${baseParams}`);
        break;
      }
      case 'manual': {
        // Route to manual template builder
        router.push(`/builder/template/new${baseParams}`);
        break;
      }
      case 'ai': {
        // Route to AI fork page (Quick Idea or Relationship Helper)
        router.push(`/templates/create/ai${baseParams}`);
        break;
      }
      case 'previous': {
        // Route to clone from previous template
        router.push(`/templates/create/clone${baseParams}`);
        break;
      }
    }
  };

  const OPTIONS = [
    {
      id: 'ai-snippets',
      title: 'AI Snippets Builder',
      description: 'AI intelligently selects and orders your content snippets based on your intent. No more jigsaw puzzles!',
      icon: Sparkles,
      buttonText: 'Build with Snippets',
      highlight: true,
    },
    {
      id: 'manual',
      title: 'Manual',
      description: 'Create a template quickly with a form. You\'ll need to figure out the variables.',
      icon: FileEdit,
      buttonText: 'Create Manually',
    },
    {
      id: 'ai',
      title: 'With AI',
      description: 'Use AI to generate your template. Choose between Quick Idea or Relationship-aware generation.',
      icon: Sparkles,
      buttonText: 'Use AI',
    },
    {
      id: 'previous',
      title: 'From Previous Template',
      description: 'Clone an existing template as your starting point.',
      icon: Copy,
      buttonText: 'Use Previous',
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
          <PageHeader
            title="Create New Template"
            subtitle="Choose how you'd like to create your email template"
          />
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <div
                key={option.id}
                onClick={() => handleOptionSelect(option.id)}
                className={`rounded-xl border-2 p-6 shadow-sm hover:shadow-md transition cursor-pointer ${
                  option.highlight
                    ? 'border-purple-300 bg-gradient-to-br from-purple-50 to-white hover:border-purple-400'
                    : 'border-gray-200 bg-white hover:border-red-300'
                }`}
              >
                <div className="flex flex-col items-center text-center mb-4">
                  <div className={`flex-shrink-0 h-12 w-12 rounded-lg flex items-center justify-center mb-3 ${
                    option.highlight ? 'bg-purple-100' : 'bg-red-100'
                  }`}>
                    <Icon className={`h-6 w-6 ${option.highlight ? 'text-purple-600' : 'text-red-600'}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {option.title}
                    {option.highlight && (
                      <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">NEW</span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {option.description}
                  </p>
                </div>
                <button className={`w-full rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
                  option.highlight
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}>
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

export default function TemplateCreatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <TemplateCreateContent />
    </Suspense>
  );
}

