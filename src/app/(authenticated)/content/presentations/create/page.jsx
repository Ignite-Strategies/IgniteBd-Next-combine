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
    if (!title.trim()) {
      setError('Title is required');
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

      const finalCompanyHQId = resolvedCompanyHQId || companyHQId;
      const response = await api.post('/api/content/presentations', {
        companyHQId: finalCompanyHQId,
        title,
        description,
        slides,
        published: false,
      });

      if (response.data?.success && response.data?.presentation) {
        router.push(`/content/presentations/${response.data.presentation.id}`);
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
          subtitle="Create a new presentation deck"
          backTo="/content/presentations"
          backLabel="Back to Presentations"
        />

        <div className="mt-8 rounded-2xl bg-white p-6 shadow">
          <div className="space-y-6">
            {!resolvedCompanyHQId && !companyHQId && (
              <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="rounded-full bg-amber-100 p-3">
                      <Building2 className="h-6 w-6 text-amber-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="mb-1 text-lg font-semibold text-gray-900">
                      Company Profile Required
                    </h3>
                    <p className="mb-4 text-sm text-gray-600">
                      To create presentations, we need your company information set up first. This helps us organize your content and ensure everything is properly linked.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => router.push('/company/profile')}
                        className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                      >
                        Set Up Company Profile
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleRefreshCompany}
                        disabled={refreshing}
                        className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                      >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? 'Checking...' : 'Refresh Company Data'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (resolvedCompanyHQId || companyHQId) && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Presentation title"
                spellCheck={true}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the presentation"
                rows={4}
                spellCheck={true}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

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
                You can add or remove slides later
              </p>
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
                disabled={saving || !title.trim()}
                className="rounded bg-red-600 px-6 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Creating...' : 'Create Presentation'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
