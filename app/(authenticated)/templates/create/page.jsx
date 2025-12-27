'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Sparkles, FileEdit, Copy, ArrowLeft } from 'lucide-react';

/**
 * Template Creation Fork Page
 * 3-fork approach: Manual, With AI, or From Previous
 */
function TemplateCreateContent() {
  const router = useRouter();

  const handleOptionSelect = (option) => {
    switch (option) {
      case 'manual': {
        // Route to manual template builder
        router.push('/builder/template/new');
        break;
      }
      case 'ai': {
        // Route to AI fork page (Quick Idea or Relationship Helper)
        router.push('/templates/create/ai');
        break;
      }
      case 'previous': {
        // Route to clone from previous template
        router.push('/templates/create/clone');
        break;
      }
    }
  };

  const OPTIONS = [
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

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <div
                key={option.id}
                onClick={() => handleOptionSelect(option.id)}
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

