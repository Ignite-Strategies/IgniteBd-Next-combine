'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';

export default function TemplateSavedPage() {
  const router = useRouter();
  const { companyHQId } = useCompanyHQ();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // 🎯 LOCAL-FIRST: Load ONLY from localStorage on mount - NO API CALLS
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const id = companyHQId || localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
    
    if (!id) {
      setLoading(false);
      return;
    }

    // 🎯 LOCAL-FIRST: Load from localStorage - localStorage is authoritative
    try {
      let loaded = false;

      // First try: outreachTemplates_${id}
      const stored = localStorage.getItem(`outreachTemplates_${id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTemplates(parsed);
          loaded = true;
          console.log('✅ [LOCAL-FIRST] Loaded', parsed.length, 'templates from localStorage');
        }
      }

      // Second try: Check hydration data (companyHydration_${id})
      if (!loaded) {
        const hydrationKey = `companyHydration_${id}`;
        const hydrationData = localStorage.getItem(hydrationKey);
        if (hydrationData) {
          try {
            const parsed = JSON.parse(hydrationData);
            if (parsed?.data?.outreachTemplates && Array.isArray(parsed.data.outreachTemplates)) {
              setTemplates(parsed.data.outreachTemplates);
              // Also store in direct key for consistency
              localStorage.setItem(`outreachTemplates_${id}`, JSON.stringify(parsed.data.outreachTemplates));
              loaded = true;
              console.log('✅ [LOCAL-FIRST] Loaded', parsed.data.outreachTemplates.length, 'templates from hydration data');
            }
          } catch (e) {
            console.warn('[LOCAL-FIRST] Failed to parse hydration data:', e);
          }
        }
      }

      // 🎯 LOCAL-FIRST: If nothing loaded, show empty state (NO AUTO-SYNC)
      if (!loaded) {
        setTemplates([]);
        console.log('ℹ️ [LOCAL-FIRST] No templates found in localStorage - click Sync to load from server');
      }
    } catch (err) {
      console.warn('[LOCAL-FIRST] Failed to load templates from localStorage:', err);
      setTemplates([]);
    }
    
    setLoading(false);
  }, []); // Empty dependency array - only run on mount

  // 🎯 LOCAL-FIRST: API sync is explicit and optional - only called by user clicking Sync button
  const handleSync = async () => {
    const id = companyHQId || (typeof window !== 'undefined'
      ? (localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '')
      : '');
    
    if (!id) {
      setError('Company ID not found. Cannot sync.');
      return;
    }

    setSyncing(true);
    setError(null);

    try {
      const response = await api.get(`/api/template/saved?companyHQId=${encodeURIComponent(id)}`);

      if (response.data?.success && response.data?.templates) {
        const fetchedTemplates = response.data.templates;
        setTemplates(fetchedTemplates);
        // Cache in localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem(`outreachTemplates_${id}`, JSON.stringify(fetchedTemplates));
          console.log('✅ Cached', fetchedTemplates.length, 'templates to localStorage');
        }
        setError(null);
      } else {
        throw new Error('Failed to fetch templates');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch templates');
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRelationshipLabel = (value) => {
    const map = {
      COLD: 'Cold',
      WARM: 'Warm',
      ESTABLISHED: 'Established',
      DORMANT: 'Dormant',
    };
    return map[value] || value;
  };

  const getTypeOfPersonLabel = (value) => {
    const map = {
      CURRENT_CLIENT: 'Current Client',
      FORMER_CLIENT: 'Former Client',
      FORMER_COWORKER: 'Former Coworker',
      PROSPECT: 'Prospect',
      PARTNER: 'Partner',
      FRIEND_OF_FRIEND: 'Friend of Friend',
    };
    return map[value] || value;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="text-center text-gray-500">Loading templates...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Saved Templates</h1>
            <p className="mt-2 text-sm text-gray-600">
              View and manage your saved outreach templates
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing || !companyHQId}
              className="flex items-center gap-2 rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/template/build')}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700"
            >
              Build New Template
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {templates.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <p className="text-gray-500">No saved templates yet.</p>
            <button
              type="button"
              onClick={() => router.push('/template/build')}
              className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700"
            >
              Build Your First Template
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {templates.map((template) => {
              const base = template.template_bases;
              const isExpanded = expandedId === template.id;

              return (
                <div
                  key={template.id}
                  className="rounded-lg border border-gray-200 bg-white shadow-sm"
                >
                  <div
                    className="flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50"
                    onClick={() => setExpandedId(isExpanded ? null : template.id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-semibold text-gray-900">
                          {base.title || `${getRelationshipLabel(base.relationship)} • ${getTypeOfPersonLabel(base.typeOfPerson)}`}
                        </div>
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                          template.mode === 'AI'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {template.mode}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Created {formatDate(template.createdAt)}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {isExpanded ? '▼' : '▶'}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-200 p-4">
                      <div className="space-y-4">
                        <div>
                          <div className="mb-1 text-xs font-semibold uppercase text-gray-500">
                            Why Reaching Out
                          </div>
                          <div className="text-sm text-gray-800">{base.whyReachingOut}</div>
                        </div>

                        {base.whatWantFromThem && (
                          <div>
                            <div className="mb-1 text-xs font-semibold uppercase text-gray-500">
                              What Want From Them
                            </div>
                            <div className="text-sm text-gray-800">{base.whatWantFromThem}</div>
                          </div>
                        )}

                        <div>
                          <div className="mb-1 text-xs font-semibold uppercase text-gray-500">
                            Message Preview
                          </div>
                          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800 whitespace-pre-wrap">
                            {template.content}
                          </div>
                        </div>
                      </div>
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

