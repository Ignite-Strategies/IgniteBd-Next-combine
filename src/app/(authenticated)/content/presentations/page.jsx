'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';
import { FileText, Plus, Edit2, Eye, RefreshCw, Trash2, Play, Download, ExternalLink, Loader2 } from 'lucide-react';

export default function PresentationsPage() {
  const router = useRouter();
  const [presentations, setPresentations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [generating, setGenerating] = useState({});

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
      
      console.log('🔍 Presentations page - companyHQId from localStorage:', companyHQId);
      
      if (!companyHQId) {
        console.warn('⚠️ No companyHQId found in localStorage');
        console.warn('   Available keys:', Object.keys(localStorage).filter(k => k.includes('company')));
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
      console.log(`🌐 Fetching presentations from API for companyHQId: ${companyHQId}`);
      const response = await api.get(`/api/content/presentations?companyHQId=${companyHQId}`);
      console.log('📦 API Response:', response.data);
      if (response.data?.success) {
        const freshPresentations = response.data.presentations || [];
        console.log(`✅ Fetched ${freshPresentations.length} presentations from API`);
        if (freshPresentations.length === 0) {
          console.warn('⚠️ API returned success but 0 presentations. Check companyHQId match.');
        }
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

  const handleBuildDeck = async (presentationId) => {
    try {
      setGenerating({ ...generating, [presentationId]: true });

      const response = await api.post('/api/decks/generate', {
        presentationId,
      });

      if (response.data?.success) {
        // Refresh presentations to get updated gammaStatus
        await loadPresentations(true);
        
        if (response.data.status === 'ready') {
          alert('Deck generated successfully!');
        }
      } else {
        throw new Error(response.data?.error || 'Failed to generate deck');
      }
    } catch (err) {
      console.error('Error generating deck:', err);
      const errorMessage = err?.message || err?.response?.data?.error || 'Failed to generate deck. Please try again.';
      alert(errorMessage);
    } finally {
      setGenerating({ ...generating, [presentationId]: false });
    }
  };

  const handleDownloadPPTX = (presentationId) => {
    window.open(`/api/presentations/${presentationId}/download`, '_blank');
  };

  const handleViewDeck = (deckUrl) => {
    window.open(deckUrl, '_blank');
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
                        <div className="flex items-center gap-3 flex-wrap">
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
                          {presentation.gammaStatus === 'ready' && (
                            <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                              Deck Ready
                            </span>
                          )}
                          {presentation.gammaStatus === 'generating' && (
                            <span className="px-2 py-1 text-xs font-semibold bg-orange-100 text-orange-800 rounded-full flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Generating...
                            </span>
                          )}
                          {presentation.gammaStatus === 'error' && (
                            <span className="px-2 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded-full">
                              Generation Failed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Build the Deck Button - Primary Action */}
                      {presentation.gammaStatus === 'ready' ? (
                        <>
                          {presentation.gammaDeckUrl && (
                            <button
                              onClick={() => handleViewDeck(presentation.gammaDeckUrl)}
                              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              <ExternalLink className="h-4 w-4" />
                              View Deck
                            </button>
                          )}
                          <button
                            onClick={() => handleDownloadPPTX(presentation.id)}
                            className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <Download className="h-4 w-4" />
                            Download PPTX
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleBuildDeck(presentation.id)}
                          disabled={generating[presentation.id] || presentation.gammaStatus === 'generating'}
                          className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-red-600 to-orange-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {generating[presentation.id] || presentation.gammaStatus === 'generating' ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4" />
                              Build the Deck
                            </>
                          )}
                        </button>
                      )}
                      
                      {/* Secondary Actions */}
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
