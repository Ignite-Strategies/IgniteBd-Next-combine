'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Users, ArrowRight, ArrowLeft } from 'lucide-react';

// Prevent prerendering - this page requires client-side state
export const dynamic = 'force-dynamic';

const AI_OPTIONS = [
  {
    id: 'quick-idea',
    title: 'Quick Idea',
    description: 'Type a template idea and AI creates it quickly',
    icon: Sparkles,
    color: 'purple',
    route: '/template/build/ai/quick-idea',
  },
  {
    id: 'relationship-helper',
    title: 'Relationship Helper',
    description: 'Relationship-aware AI template builder with full context',
    icon: Users,
    color: 'indigo',
    route: '/template/build/ai/relationship-helper',
  },
];

export default function AILandingPage() {
  const router = useRouter();
  const [error, setError] = useState(null);

  const handleOptionSelect = (route) => {
    router.push(route);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => router.push('/template/build')}
            className="mb-4 flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to choices
          </button>
        </div>
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">AI Generate</h1>
          <p className="text-lg text-gray-600">
            Choose how you want AI to create your template
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {AI_OPTIONS.map((option) => {
            const Icon = option.icon;
            const getIconBgClass = (color) => {
              if (color === 'purple') return 'bg-purple-100';
              if (color === 'indigo') return 'bg-indigo-100';
              return 'bg-gray-100';
            };
            const getIconColorClass = (color) => {
              if (color === 'purple') return 'text-purple-600';
              if (color === 'indigo') return 'text-indigo-600';
              return 'text-gray-600';
            };
            return (
              <button
                key={option.id}
                onClick={() => handleOptionSelect(option.route)}
                className="group relative rounded-lg border-2 border-gray-200 bg-white p-8 text-left shadow-sm transition-all hover:border-red-500 hover:shadow-md"
              >
                <div className={`mb-4 inline-flex rounded-lg p-3 ${getIconBgClass(option.color)}`}>
                  <Icon className={`h-6 w-6 ${getIconColorClass(option.color)}`} />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {option.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {option.description}
                </p>
                <div className="mt-4 flex items-center text-sm font-medium text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  Get started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

