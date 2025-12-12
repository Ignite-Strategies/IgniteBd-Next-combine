'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Plus, Presentation, ArrowRight, RefreshCw } from 'lucide-react';
import api from '@/lib/api';

export default function PresentationsPage() {
  const router = useRouter();
  const [presentations, setPresentations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  const [companyHQId, setCompanyHQId] = useState('');

  // Load ONLY from localStorage on mount - NO API CALLS
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Get companyHQId (for syncing button only)
    const id = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
    setCompanyHQId(id);

    // Load from localStorage - check multiple possible keys
    try {
      let loaded = false;
      
      // First try: presentations_${id} (if we have id)
      if (id) {
        const stored = localStorage.getItem(`presentations_${id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPresentations(parsed);
            loaded = true;
            console.log('✅ Loaded', parsed.length, 'presentations from localStorage');
          }
        }
      }
      
      // Second try: Check hydration data (companyHydration_${id})
      if (!loaded && id) {
        const hydrationKey = `companyHydration_${id}`;
        const hydrationData = localStorage.getItem(hydrationKey);
        if (hydrationData) {
          try {
            const parsed = JSON.parse(hydrationData);
            if (parsed?.data?.presentations && Array.isArray(parsed.data.presentations)) {
              setPresentations(parsed.data.presentations);
              loaded = true;
              console.log('✅ Loaded', parsed.data.presentations.length, 'presentations from hydration data');
            }
          } catch (e) {
            console.warn('Failed to parse hydration data:', e);
          }
        }
      }
      
      // Third try: Check any presentations_* key (fallback)
      if (!loaded) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('presentations_')) {
            try {
              const stored = localStorage.getItem(key);
              if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  setPresentations(parsed);
                  loaded = true;
                  console.log('✅ Loaded', parsed.length, 'presentations from fallback localStorage key:', key);
                  break;
                }
              }
            } catch (e) {
              // Skip invalid entries
            }
          }
        }
      }
      
      // If nothing loaded, show empty state (NO AUTO-SYNC)
      if (!loaded) {
        setPresentations([]);
        console.log('ℹ️ No presentations found in localStorage - click Sync to load from server');
      }
    } catch (err) {
      console.warn('Failed to load presentations from localStorage:', err);
      setPresentations([]);
    }
    
    setLoading(false);
  }, []);

  // Silent sync function (called by sync button or on mount)
  const handleSync = async (overrideCompanyId = null) => {
    const id = overrideCompanyId || companyHQId;
    if (!id) {
      // Try to get it fresh
      const freshId = typeof window !== 'undefined'
        ? (localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '')
        : '';
      if (!freshId) {
        console.warn('No companyHQId available for sync');
        return;
      }
      setCompanyHQId(freshId);
      id = freshId;
    }

    try {
      setSyncing(true);
      setLoading(true);
      setError('');
      
      const response = await api.get(`/api/content/presentations?companyHQId=${id}`);
      if (response.data?.success) {
        const fetchedPresentations = response.data.presentations || [];
        
        // Log to verify we got full objects
        if (fetchedPresentations.length > 0) {
          console.log('✅ Synced presentation sample fields:', Object.keys(fetchedPresentations[0]).join(', '));
          console.log('✅ Sample presentation:', JSON.stringify(fetchedPresentations[0], null, 2).substring(0, 500));
        }
        
        setPresentations(fetchedPresentations);
        
        // Store in localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem(`presentations_${id}`, JSON.stringify(fetchedPresentations));
          console.log('✅ Synced', fetchedPresentations.length, 'presentations to localStorage');
        }
      }
    } catch (err) {
      console.error('Error syncing presentations:', err);
      setError('Failed to sync presentations. Please try again.');
      // Still show error, but don't block
    } finally {
      setSyncing(false);
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
                onClick={() => handleSync()}
                disabled={syncing}
                className="flex items-center gap-2 rounded bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow transition hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Sync presentations from database"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync'}
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

          {presentations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center shadow">
              <Presentation className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-semibold text-gray-900">No presentations yet</h3>
              <p className="mt-2 text-sm text-gray-500">
                Get started by creating your first presentation
              </p>
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => router.push('/content/presentations/create')}
                  className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Create Your First Presentation
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
