'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Plus, Presentation, ArrowRight } from 'lucide-react';
import api from '@/lib/api';

export default function PresentationsPage() {
  const router = useRouter();
  const [presentations, setPresentations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const companyHQId = typeof window !== 'undefined'
    ? (localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '')
    : '';

  useEffect(() => {
    if (companyHQId) {
      loadPresentations();
    }
  }, [companyHQId]);

  const loadPresentations = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/content/presentations?companyHQId=${companyHQId}`);
      if (response.data?.success) {
        setPresentations(response.data.presentations || []);
      }
    } catch (err) {
      console.error('Error loading presentations:', err);
      setError('Failed to load presentations');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Presentations"
          subtitle="Create and manage your presentation decks"
          backTo="/content"
          backLabel="Back to Content"
        />

        <div className="mt-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Your Presentations</h2>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/content/presentations/ai')}
                className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                AI Builder
              </button>
              <button
                onClick={() => router.push('/content/presentations/create')}
                className="flex items-center gap-2 rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                New Presentation
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="rounded-2xl bg-white p-12 text-center shadow">
              <p className="text-sm font-semibold text-gray-600">Loading presentations...</p>
            </div>
          ) : presentations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center shadow">
              <Presentation className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-semibold text-gray-900">No presentations yet</h3>
              <p className="mt-2 text-sm text-gray-500">
                Get started by creating your first presentation
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <button
                  onClick={() => router.push('/content/presentations/create')}
                  className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Create Presentation
                </button>
                <button
                  onClick={() => router.push('/content/presentations/ai')}
                  className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Use AI Builder
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {presentations.map((presentation) => (
                <div
                  key={presentation.id}
                  onClick={() => router.push(`/content/presentations/${presentation.id}`)}
                  className="group cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <Presentation className="h-5 w-5 text-red-600" />
                        <h3 className="text-lg font-semibold text-gray-900">
                          {presentation.title}
                        </h3>
                      </div>
                      {presentation.description && (
                        <p className="mb-3 text-sm text-gray-600 line-clamp-2">
                          {presentation.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {presentation.published ? 'Published' : 'Draft'}
                        </span>
                        <ArrowRight className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
