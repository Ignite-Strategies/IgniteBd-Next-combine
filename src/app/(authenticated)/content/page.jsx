'use client';

import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { FileText, Presentation, FileImage, Type } from 'lucide-react';

const CONTENT_TYPES = [
  {
    id: 'presentations',
    title: 'Presentations',
    description: 'Create and manage presentation decks',
    route: '/content/presentations',
    icon: Presentation,
    containerClasses: 'from-red-50 to-red-100 border-red-200 hover:border-red-400',
    iconClasses: 'bg-red-500 text-white',
  },
  {
    id: 'blog',
    title: 'Write Blog Post',
    description: 'Create a new blog article',
    route: '/builder/blog/new',
    icon: FileText,
    containerClasses: 'from-blue-50 to-blue-100 border-blue-200 hover:border-blue-400',
    iconClasses: 'bg-blue-500 text-white',
  },
  {
    id: 'template',
    title: 'Create Email Template',
    description: 'Design outreach email templates',
    route: '/builder/template/new',
    icon: Type,
    containerClasses: 'from-green-50 to-green-100 border-green-200 hover:border-green-400',
    iconClasses: 'bg-green-500 text-white',
  },
  {
    id: 'landing-page',
    title: 'Build Landing Page',
    description: 'Create a landing page',
    route: '/builder/landingpage/new',
    icon: FileImage,
    containerClasses: 'from-indigo-50 to-indigo-100 border-indigo-200 hover:border-indigo-400',
    iconClasses: 'bg-indigo-500 text-white',
  },
];

export default function ContentHubPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Content Studio"
          subtitle="Draft articles, social posts, and assets that accelerate demand."
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        <div className="mt-8">
          <h2 className="mb-6 text-xl font-semibold text-gray-900">Create Content</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CONTENT_TYPES.map((content) => {
              const Icon = content.icon;
              return (
                <button
                  key={content.id}
                  onClick={() => router.push(content.route)}
                  className={`group relative overflow-hidden rounded-2xl border-2 bg-gradient-to-br p-6 text-left shadow-sm transition-all hover:shadow-lg ${content.containerClasses}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${content.iconClasses} transition-transform group-hover:scale-110`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="mb-2 text-lg font-semibold text-gray-900">
                        {content.title}
                      </h3>
                      <p className="text-sm text-gray-600">{content.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-12 rounded-2xl border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">About Content Studio</h3>
          <p className="text-sm text-gray-600">
            Create standalone content assets for your marketing and outreach efforts. 
            These can be used in campaigns, linked to work packages, or shared independently.
          </p>
        </div>
      </div>
    </div>
  );
}
