'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, FileEdit } from 'lucide-react';

/**
 * Product Creation Fork Page
 * Choose how to create a new product: Manual or With AI
 */
export default function ProductCreatePage() {
  const router = useRouter();

  const handleOptionSelect = async (option) => {
    switch (option) {
      case 'manual': {
        // Route to manual product builder
        router.push('/products/builder');
        break;
      }
      case 'ai': {
        // Route to AI product builder (same builder but with AI modal open)
        router.push('/products/builder?buildWithAI=true');
        break;
      }
    }
  };

  const OPTIONS = [
    {
      id: 'manual',
      title: 'Build Manual',
      description: 'Fill out the form manually to define your product or service.',
      icon: FileEdit,
      buttonText: 'Build Manual',
    },
    {
      id: 'ai',
      title: 'Build with AI',
      description: 'Describe your product in natural language and let AI fill in the details.',
      icon: Sparkles,
      buttonText: 'Build with AI',
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
            <h1 className="text-3xl font-bold text-gray-900">Create Product/Service</h1>
            <p className="mt-1 text-sm text-gray-600">
              Choose how you want to create your product or service
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <div
                key={option.id}
                className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer hover:border-blue-300"
                onClick={() => handleOptionSelect(option.id)}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-blue-600" />
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
                <button className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
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

