'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, FileText, Edit, ArrowRight, Users } from 'lucide-react';

const TEMPLATE_PATHS = [
  {
    id: 'manual',
    title: 'Manual',
    description: 'Type your own message and insert variables as needed',
    icon: Edit,
    color: 'blue',
    route: '/template/build/manual',
  },
  {
    id: 'quick-idea',
    title: 'Quick Idea',
    description: 'Type a template idea and AI creates it quickly',
    icon: Sparkles,
    color: 'purple',
    route: '/template/build/quick-idea',
  },
  {
    id: 'relationship-helper',
    title: 'Relationship Helper',
    description: 'Relationship-aware AI template builder with full context',
    icon: Users,
    color: 'indigo',
    route: '/template/build/relationship-helper',
  },
  {
    id: 'templates',
    title: 'From Templates',
    description: 'Use templates you\'ve already built',
    icon: FileText,
    color: 'green',
    route: '/template/build/templates',
  },
];

export default function TemplateBuildLandingPage() {
  const router = useRouter();
  const [error, setError] = useState(null);

  const handlePathSelect = (route) => {
    router.push(route);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Build Outreach Template</h1>
          <p className="text-lg text-gray-600">
            Choose how you want to create your outreach template
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {TEMPLATE_PATHS.map((templatePath) => {
            const Icon = templatePath.icon;
            const getIconBgClass = (color) => {
              if (color === 'blue') return 'bg-blue-100';
              if (color === 'purple') return 'bg-purple-100';
              if (color === 'green') return 'bg-green-100';
              if (color === 'indigo') return 'bg-indigo-100';
              return 'bg-gray-100';
            };
            const getIconColorClass = (color) => {
              if (color === 'blue') return 'text-blue-600';
              if (color === 'purple') return 'text-purple-600';
              if (color === 'green') return 'text-green-600';
              if (color === 'indigo') return 'text-indigo-600';
              return 'text-gray-600';
            };
            return (
              <button
                key={templatePath.id}
                onClick={() => handlePathSelect(templatePath.route)}
                className="group relative rounded-lg border-2 border-gray-200 bg-white p-8 text-left shadow-sm transition-all hover:border-red-500 hover:shadow-md"
              >
                <div className={`mb-4 inline-flex rounded-lg p-3 ${getIconBgClass(templatePath.color)}`}>
                  <Icon className={`h-6 w-6 ${getIconColorClass(templatePath.color)}`} />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {templatePath.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {templatePath.description}
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
