'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';
import { FileText, Plus, Edit2 } from 'lucide-react';

export default function PresentationsPage() {
  const router = useRouter();
  const [presentations, setPresentations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPresentations();
  }, []);

  const loadPresentations = async () => {
    try {
      setLoading(true);
      const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
      
      if (!companyHQId) {
        console.warn('No companyHQId found');
        setLoading(false);
        return;
      }

      const response = await api.get(`/api/content/presentations?companyHQId=${companyHQId}`);
      if (response.data?.success) {
        setPresentations(response.data.presentations || []);
      }
    } catch (err) {
      console.error('Error loading presentations:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between mb-8">
          <PageHeader
            title="Presentations"
            subtitle="Draft, refine, and publish presentations for CLEs, webinars, and conferences."
            backTo="/content"
            backLabel="Back to Content Studio"
          />
          <button
            onClick={() => router.push('/content/presentations/build')}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-orange-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
          >
            <Plus className="h-5 w-5" />
            Build Presentation
          </button>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow">
            <p className="text-gray-600">Loading presentations...</p>
          </div>
        ) : presentations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center shadow">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-800 mb-2">No presentations yet</p>
            <p className="text-sm text-gray-500 mb-6">
              Create your first presentation to get started
            </p>
            <button
              onClick={() => router.push('/content/presentations/build')}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all mx-auto"
            >
              <Plus className="h-5 w-5" />
              Create Presentation
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {presentations.map((presentation) => {
              const slides = presentation.slides || {};
              const sections = slides.sections || [];
              
              return (
                <div
                  key={presentation.id}
                  className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer"
                  onClick={() => router.push(`/builder/cledeck/${presentation.id}`)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="rounded-lg bg-red-100 p-3">
                        <FileText className="h-6 w-6 text-red-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900">{presentation.title || 'Untitled Presentation'}</h3>
                        <div className="flex items-center gap-4 mt-1">
                          <p className="text-sm text-gray-500">
                            {sections.length} {sections.length === 1 ? 'slide' : 'slides'}
                          </p>
                          {presentation.published && (
                            <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
                              Published
                            </span>
                          )}
                          {!presentation.published && (
                            <span className="px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-full">
                              Draft
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/builder/cledeck/${presentation.id}`);
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                      Edit
                    </button>
                  </div>

                  {/* Show sections if they exist */}
                  {sections.length > 0 && (
                    <div className="space-y-2 mt-4">
                      {sections.slice(0, 6).map((section, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50"
                        >
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-gray-900">
                              {section.title || `Slide ${index + 1}`}
                            </h4>
                          </div>
                        </div>
                      ))}
                      {sections.length > 6 && (
                        <p className="text-xs text-gray-500 text-center mt-2">
                          +{sections.length - 6} more slides
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
