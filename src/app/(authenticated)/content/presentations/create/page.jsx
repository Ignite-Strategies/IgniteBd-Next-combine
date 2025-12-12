'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Building2, RefreshCw, ArrowRight } from 'lucide-react';
import api from '@/lib/api';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';

export default function CreatePresentationPage() {
  const router = useRouter();
  const { companyHQId, companyHQ, loading: companyLoading, refresh: refreshCompany } = useCompanyHQ();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slideCount, setSlideCount] = useState(10);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [resolvedCompanyHQId, setResolvedCompanyHQId] = useState(null);

  // Resolve companyHQId from multiple sources
  useEffect(() => {
    if (companyHQId) {
      setResolvedCompanyHQId(companyHQId);
      return;
    }

    // Check localStorage directly
    const storedId = typeof window !== 'undefined' 
      ? (localStorage.getItem('companyHQId') || localStorage.getItem('companyId'))
      : null;
    
    if (storedId) {
      setResolvedCompanyHQId(storedId);
      return;
    }

    // Try to refresh from API
    if (!companyLoading && !refreshing) {
      setRefreshing(true);
      refreshCompany().then(() => {
        const refreshedId = typeof window !== 'undefined'
          ? (localStorage.getItem('companyHQId') || localStorage.getItem('companyId'))
          : null;
        if (refreshedId) {
          setResolvedCompanyHQId(refreshedId);
        }
      }).finally(() => setRefreshing(false));
    }
  }, [companyHQId, companyLoading, refreshCompany, refreshing]);

  const handleRefreshCompany = async () => {
    setRefreshing(true);
    setError('');
    try {
      await refreshCompany();
      // Check localStorage after refresh
      const refreshedId = typeof window !== 'undefined'
        ? (localStorage.getItem('companyHQId') || localStorage.getItem('companyId'))
        : null;
      if (refreshedId) {
        setResolvedCompanyHQId(refreshedId);
      } else {
        setError('Company data not found. Please set up your company profile.');
      }
    } catch (err) {
      console.error('Error refreshing company:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSave = async () => {
    // Description is now the main field - title is optional
    if (!description.trim()) {
      setError('Please describe what your presentation is about');
      return;
    }

    // Try to resolve companyHQId on submit
    let finalCompanyHQId = resolvedCompanyHQId || companyHQId;
    
    if (!finalCompanyHQId && typeof window !== 'undefined') {
      finalCompanyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId');
    }

    if (!finalCompanyHQId) {
      setError('Company profile required. Please set up your company first.');
      return;
    }

    setError('');
    setSaving(true);

    try {
      // Create empty slides array
      const slides = Array.from({ length: slideCount }, (_, i) => ({
        slideNumber: i + 1,
        title: '',
        content: '',
        notes: null,
      }));

      // Resolve companyHQId on submit
      let finalCompanyHQId = resolvedCompanyHQId || companyHQId;
      if (!finalCompanyHQId && typeof window !== 'undefined') {
        finalCompanyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId');
      }

      if (!finalCompanyHQId) {
        setError('Company profile required. Please set up your company first.');
        setSaving(false);
        return;
      }

      // Create presentation with description - AI will generate the rest
      const response = await api.post('/api/content/presentations', {
        companyHQId: finalCompanyHQId,
        title: title.trim() || 'Untitled Presentation', // Use title if provided, otherwise placeholder
        description, // This is the main input - AI will use this
        slides,
        published: false,
      });

      if (response.data?.success && response.data?.presentation) {
        // Immediately redirect to AI builder to generate the content
        router.push(`/content/presentations/${response.data.presentation.id}/ai`);
      } else {
        throw new Error('Failed to create presentation');
      }
    } catch (err) {
      console.error('Error creating presentation:', err);
      setError('Failed to create presentation. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Create Presentation"
          subtitle="AI will build your presentation - just describe what you want"
          backTo="/content/presentations"
          backLabel="Back to Presentations"
        />

        <div className="mt-8 rounded-2xl bg-white p-6 shadow">
          <div className="space-y-6">
            {/* AI Builder Info Box */}
            <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-5">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="mb-1 text-base font-semibold text-blue-900">
                    AI-Powered Presentation Builder
                  </h3>
                  <p className="text-sm text-blue-800">
                    Just describe your presentation idea below. Our AI will create the title, outline, and slide content for you. You can edit anything after it's generated.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                What is your presentation about? *
              </label>
              <p className="mb-2 text-xs text-gray-500">
                Describe what you want to present - the AI will create everything else
              </p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Example: A pitch deck for our new SaaS product targeting mid-market companies, focusing on ROI and ease of implementation..."
                rows={6}
                spellCheck={true}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Number of Slides
                </label>
                <input
                  type="number"
                  value={slideCount}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    if (!isNaN(value) && value >= 1 && value <= 100) {
                      setSlideCount(value);
                    }
                  }}
                  min={1}
                  max={100}
                  step={1}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
                <p className="mt-1 text-xs text-gray-500">
                  AI will create this many slides
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Title (Optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Leave blank - AI will suggest one"
                  spellCheck={true}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Or let AI suggest a title
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded border border-gray-300 px-6 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !description.trim()}
                className="flex items-center gap-2 rounded bg-red-600 px-6 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  'Creating...'
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Create & Generate with AI
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
