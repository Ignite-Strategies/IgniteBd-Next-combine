'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Building2, RefreshCw, ArrowRight } from 'lucide-react';
import api from '@/lib/api';

function CreatePresentationPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Read companyHQId from URL params, with fallback to localStorage
  const urlCompanyHQId = searchParams?.get('companyHQId') || '';
  const [companyHQId, setCompanyHQId] = useState(urlCompanyHQId);
  const hasRedirectedRef = useRef(false);
  
  // Direct read from localStorage - NO HOOKS
  const [ownerId, setOwnerId] = useState(null);
  const [companyHQ, setCompanyHQ] = useState(null);
  
  // Fallback: If not in URL, check localStorage and redirect
  useEffect(() => {
    if (hasRedirectedRef.current) return;
    if (urlCompanyHQId) {
      setCompanyHQId(urlCompanyHQId);
      return;
    }
    
    if (typeof window === 'undefined') return;
    
    const storedCompanyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId');
    if (storedCompanyHQId) {
      hasRedirectedRef.current = true;
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('companyHQId', storedCompanyHQId);
      router.replace(currentUrl.pathname + currentUrl.search);
      setCompanyHQId(storedCompanyHQId);
    }
  }, [urlCompanyHQId, router]);
  
  // Load ownerId and companyHQ from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const storedOwnerId = localStorage.getItem('ownerId');
    if (storedOwnerId) {
      setOwnerId(storedOwnerId);
    }
    
    if (companyHQId) {
      const stored = localStorage.getItem('companyHQ');
      if (stored) {
        try {
          setCompanyHQ(JSON.parse(stored));
        } catch (e) {
          console.warn('Failed to parse companyHQ', e);
        }
      }
    }
  }, [companyHQId]);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slideCount, setSlideCount] = useState(10);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = () => {
    // Description is now the main field - title is optional
    if (!description.trim()) {
      setError('Please describe what your presentation is about');
      return;
    }

    // Store the form data temporarily and redirect to AI builder
    // We'll create the presentation only after user saves in AI builder
    if (typeof window !== 'undefined') {
      const tempData = {
        title: title.trim() || '',
        description: description.trim(),
        slideCount,
      };
      localStorage.setItem('temp_presentation_data', JSON.stringify(tempData));
    }

    // Redirect to AI builder (no ID - it's a new presentation)
    router.push(`/content/presentations/ai${companyHQId ? `?companyHQId=${companyHQId}` : ''}`);
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
                onClick={handleGenerate}
                disabled={!description.trim()}
                className="flex items-center gap-2 rounded bg-red-600 px-6 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate with AI
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreatePresentationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <CreatePresentationPageContent />
    </Suspense>
  );
}
