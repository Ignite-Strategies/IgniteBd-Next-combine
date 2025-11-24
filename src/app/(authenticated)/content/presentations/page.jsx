'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';
import { FileText, Plus, Edit2, Eye, RefreshCw, Trash2 } from 'lucide-react';

export default function PresentationsPage() {
  const router = useRouter();
  const [presentations, setPresentations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadPresentations();
  }, []);

  const loadPresentations = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setSyncing(true);
      } else {
        setLoading(true);
      }
      
      const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
      
      if (!companyHQId) {
        console.warn('No companyHQId found');
        setLoading(false);
        setSyncing(false);
        return;
      }

      const cachedKey = `presentations_${companyHQId}`;

      // Try to load from localStorage first (only if not forcing refresh)
      if (!forceRefresh && typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem(cachedKey);
          if (cached) {
            const cachedPresentations = JSON.parse(cached);
            if (Array.isArray(cachedPresentations) && cachedPresentations.length > 0) {
              console.log(`📦 Loaded ${cachedPresentations.length} presentations from localStorage`);
              setPresentations(cachedPresentations);
              setLoading(false);
            }
          }
        } catch (e) {
          console.warn('Failed to load from localStorage:', e);
        }
      }

      // Always fetch fresh data from API
      const response = await api.get(`/api/content/presentations?companyHQId=${companyHQId}`);
      if (response.data?.success) {
        const freshPresentations = response.data.presentations || [];
        console.log(`✅ Fetched ${freshPresentations.length} presentations from API`);
        setPresentations(freshPresentations);
        
        // Update localStorage with fresh data
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(cachedKey, JSON.stringify(freshPresentations));
            console.log('💾 Updated localStorage with fresh presentations');
          } catch (e) {
            console.warn('Failed to update localStorage:', e);
          }
        }
      } else {
        console.warn('API response not successful:', response.data);
      }
    } catch (err) {
      console.error('Error loading presentations:', err);
      alert('Failed to load presentations. Please try again.');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  const handleSync = () => {
    loadPresentations(true);
  };

  const handleDelete = async (presentationId, e) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this presentation? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await api.delete(`/api/content/presentations/${presentationId}`);
      if (response.data?.success) {
        // Remove from state
        setPresentations(presentations.filter(p => p.id !== presentationId));
        
        // Remove from localStorage
        const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
        if (companyHQId) {
          const cachedKey = `presentations_${companyHQId}`;
          try {
            const cached = localStorage.getItem(cachedKey);
            if (cached) {
              const cachedPresentations = JSON.parse(cached);
              const updated = cachedPresentations.filter(p => p.id !== presentationId);
              localStorage.setItem(cachedKey, JSON.stringify(updated));
            }
          } catch (e) {
            console.warn('Failed to update localStorage:', e);
          }
        }
      } else {
        throw new Error('Failed to delete presentation');
      }
    } catch (err) {
      console.error('Error deleting presentation:', err);
      alert('Failed to delete presentation. Please try again.');
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
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing || loading}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              title="Sync presentations from database"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              Sync
            </button>
            <button
              onClick={() => router.push('/content/presentations/build')}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-orange-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
            >
              <Plus className="h-5 w-5" />
              Build Presentation
            </button>
          </div>
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
              return (
                <div
                  key={presentation.id}
                  className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-xl transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="rounded-lg bg-red-100 p-3">
                        <FileText className="h-6 w-6 text-red-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                          {presentation.title || 'Untitled Presentation'}
                        </h3>
                        {presentation.description && (
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                            {presentation.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3">
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => router.push(`/builder/presentation/${presentation.id}`)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </button>
                      <button
                        onClick={() => router.push(`/builder/presentation/${presentation.id}`)}
                        className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        onClick={(e) => handleDelete(presentation.id, e)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:text-red-700 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
