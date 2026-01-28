'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Mail, RefreshCw, CheckCircle2, AlertCircle, ArrowLeft, Check, Users, Download } from 'lucide-react';

function MicrosoftEmailIngestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  
  // Get ownerId from localStorage (needed for connect button)
  const [ownerId, setOwnerId] = useState(null);
  
  // Connection status - check once on mount from owner/hydrate
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  
  // Initialize ownerId and check connection status on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedOwnerId = localStorage.getItem('ownerId');
    if (storedOwnerId) setOwnerId(storedOwnerId);
    
    // Check connection status from Microsoft status endpoint
    const checkConnection = async () => {
      try {
        const response = await api.get('/api/microsoft/status');
        setIsConnected(response.data?.connected || false);
      } catch (error) {
        console.error('Failed to check Microsoft connection:', error);
        setIsConnected(false);
      }
    };
    checkConnection();
  }, []);
  
  // Handle OAuth callback - set connection status
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const success = searchParams?.get('success');
    const error = searchParams?.get('error');
    
    // If OAuth just completed successfully, refresh connection status
    if (success === '1') {
      // Re-check connection status after OAuth
      const checkConnection = async () => {
        try {
          const response = await api.get('/api/microsoft/status');
          setIsConnected(response.data?.connected || false);
        } catch (error) {
          console.error('Failed to check Microsoft connection:', error);
        }
      };
      checkConnection();
      setConnectionError(null);
      router.replace('/contacts/ingest/microsoft' + (companyHQId ? `?companyHQId=${companyHQId}` : ''));
    } else if (error) {
      setIsConnected(false);
      router.replace('/contacts/ingest/microsoft' + (companyHQId ? `?companyHQId=${companyHQId}` : ''));
    }
  }, [searchParams, router, companyHQId]);
  
  const [source, setSource] = useState(null); // null = landing page, 'email' or 'contacts'
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [skip, setSkip] = useState(0); // Track pagination: 0, 100, 200, etc.

  // Check for success redirect from review page
  useEffect(() => {
    const saved = searchParams?.get('saved');
    const skipped = searchParams?.get('skipped');
    if (saved || skipped) {
      setSaveResult({
        saved: parseInt(saved || '0', 10),
        skipped: parseInt(skipped || '0', 10),
      });
      // Clear URL params
      router.replace(`/contacts/ingest/microsoft${companyHQId ? `?companyHQId=${companyHQId}` : ''}`);
    }
  }, [searchParams, router, companyHQId]);

  // Don't auto-load - user selects source first

  // Load preview function - Call API directly, no connection check
  // The API will return 401 if not connected, which we handle below
  const handleLoadPreview = useCallback(async (selectedSource, currentSkip = 0) => {
    const sourceToUse = selectedSource || source;
    if (!sourceToUse) return;
    
    setPreviewLoading(true);
    setHasLoadedOnce(true);
    setConnectionError(null);
    
    try {
      // Call API with skip parameter for pagination
      // skip=0 → messages 1-100, skip=100 → messages 101-200, etc.
      const endpoint = sourceToUse === 'email' 
        ? `/api/microsoft/email-contacts/preview?skip=${currentSkip}`
        : `/api/microsoft/contacts/preview?skip=${currentSkip}`;
      const response = await api.get(endpoint);
      
      if (response.data?.success) {
        setPreview(response.data);
        setSkip(currentSkip); // Update skip state
        setSelectedIds(new Set());
        setSaveResult(null);
        // API call succeeded = we're connected! Update status
        setIsConnected(true);
        setConnectionError(null);
      } else {
        setPreview(null);
      }
    } catch (error) {
      console.error('Failed to load preview:', error);
      
      // Handle 401 (not connected) - prompt user to connect
      if (error.response?.status === 401) {
        setConnectionError({
          type: 'not_connected',
          message: 'Connect your Microsoft account to import contacts.',
        });
        setIsConnected(false);
      } else {
        // Other API errors
        setConnectionError({
          type: 'api_error',
          message: error.response?.data?.error || error.message || 'Failed to load contacts',
        });
      }
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [source]);

  // Select source and load (reset to first batch)
  const handleSelectSource = useCallback((selectedSource) => {
    setSource(selectedSource);
    setSkip(0); // Reset to first batch
    handleLoadPreview(selectedSource, 0);
  }, [handleLoadPreview]);

  // Connect button
  function handleConnect() {
    if (!ownerId) {
      alert('Please sign in first.');
      return;
    }
    // Preserve companyHQId in OAuth flow
    const url = `/api/microsoft/login?ownerId=${ownerId}${companyHQId ? `&companyHQId=${companyHQId}` : ''}`;
    window.location.href = url;
  }

  // Disconnect button
  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect your Microsoft account?')) {
      return;
    }
    try {
      await api.patch('/api/microsoft/disconnect');
      window.location.reload();
    } catch (error) {
      console.error('Disconnect failed:', error);
      alert('Failed to disconnect. Please try again.');
    }
  }

  // Toggle selection
  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Toggle all
  function toggleSelectAll() {
    if (!preview?.items) return;
    if (selectedIds.size === preview.items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(preview.items.map(item => item.previewId)));
    }
  }

  // Review button - navigate to review page
  function handleReview() {
    if (!companyHQId) {
      alert('Company context required. Please navigate from a company.');
      return;
    }
    if (selectedIds.size === 0) {
      alert('Please select at least one contact to import.');
      return;
    }

    // Store preview items and selected IDs in sessionStorage for review page
    sessionStorage.setItem('microsoftPreviewItems', JSON.stringify(preview?.items || []));
    sessionStorage.setItem('microsoftSelectedIds', JSON.stringify(Array.from(selectedIds)));
    
    // Navigate to review page
    router.push(`/contacts/ingest/microsoft/review?companyHQId=${companyHQId}&source=${source}`);
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-4xl px-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.push('/people')}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to People Hub
            </button>
            
            {/* Connection Status & Connect Button - Top Right */}
            <div className="flex items-center gap-3">
              {isConnected ? (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Connected</span>
                </div>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={!ownerId}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <Mail className="h-4 w-4" />
                  Connect to Microsoft
                </button>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3 mb-2">
            <Mail className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold">Import Contacts from Microsoft</h1>
          </div>
          <p className="text-gray-600">
            Choose how to import: extract contacts from people you've emailed, or import directly from your Microsoft Contacts address book
          </p>
        </div>

        {/* Success Message from OAuth */}
        {searchParams?.get('success') === '1' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <CheckCircle2 className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-green-800 mb-1">Successfully Connected!</h3>
                <p className="text-sm text-green-700">Your Microsoft account has been connected. Choose an import source below.</p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message from OAuth */}
        {searchParams?.get('error') && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-800 mb-1">Connection Failed</h3>
                <p className="text-sm text-red-700">{decodeURIComponent(searchParams.get('error'))}</p>
              </div>
            </div>
          </div>
        )}

        {/* Prompt to connect (401) or API error */}
        {connectionError && (
          <div className={`rounded-lg p-4 mb-6 border ${
            connectionError.type === 'not_connected'
              ? 'bg-blue-50 border-blue-200'
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start flex-1 min-w-0">
                {connectionError.type === 'not_connected' ? (
                  <Mail className="h-5 w-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-semibold mb-1 ${
                    connectionError.type === 'not_connected' ? 'text-blue-800' : 'text-yellow-800'
                  }`}>
                    {connectionError.type === 'not_connected' ? 'Connect to continue' : 'Error'}
                  </h3>
                  <p className={`text-sm ${
                    connectionError.type === 'not_connected' ? 'text-blue-700' : 'text-yellow-700'
                  }`}>
                    {connectionError.message}
                  </p>
                </div>
              </div>
              {connectionError.type === 'not_connected' && (
                <button
                  onClick={handleConnect}
                  disabled={!ownerId}
                  className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm"
                >
                  Connect Microsoft
                </button>
              )}
            </div>
          </div>
        )}

        {/* Landing Page - Source Selection - ALWAYS SHOW (no blocking!) */}
        {!source && !preview && (
          <div className="bg-white p-8 rounded-lg shadow border mb-6">
            <h2 className="text-xl font-semibold mb-6 text-center">Choose Import Source</h2>
            <p className="text-center text-sm text-gray-600 mb-6">
              Select how you want to import contacts. We'll check your connection when you click.
            </p>
            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              <button
                onClick={() => handleSelectSource('email')}
                disabled={previewLoading}
                className="group p-6 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-12 w-12 rounded-lg bg-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Mail className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Ingest from Emails</h3>
                    <p className="text-sm text-gray-500">Extract contacts from people you email</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  <strong>From Email Messages:</strong> Scans your recent Outlook emails (up to 200 messages) to extract unique contacts from people you've emailed. Automatically filters out automated emails and business services. Shows message count and last contact date.
                </p>
              </button>

              <button
                onClick={() => handleSelectSource('contacts')}
                disabled={previewLoading}
                className="group p-6 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-12 w-12 rounded-lg bg-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Ingest from Contacts</h3>
                    <p className="text-sm text-gray-500">Import from Microsoft Contacts</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  <strong>From Contacts Address Book:</strong> Imports contacts directly from your Microsoft Contacts (saved in your address book). Includes company names and job titles when available. Shows which contacts already exist in your database.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {previewLoading && !preview && (
          <div className="bg-white p-12 rounded-lg shadow border mb-6">
            <div className="flex flex-col items-center justify-center">
              <RefreshCw className="h-12 w-12 animate-spin text-blue-600 mb-4" />
              <p className="text-gray-600 font-medium">Loading contacts from your inbox...</p>
              <p className="text-sm text-gray-500 mt-2">Analyzing recent email metadata</p>
            </div>
          </div>
        )}


        {/* Success Message */}
        {saveResult && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <div className="flex items-start">
              <CheckCircle2 className="h-6 w-6 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-800 mb-2">
                  Successfully imported {saveResult.saved} contact{saveResult.saved !== 1 ? 's' : ''}
                </h3>
                {saveResult.skipped > 0 && (
                  <p className="text-sm text-green-700 mb-4">
                    {saveResult.skipped} contact{saveResult.skipped !== 1 ? 's' : ''} skipped (already exist)
                  </p>
                )}
                <div className="flex gap-3">
                  {preview?.hasMore && (
                    <button
                      onClick={() => {
                        setSaveResult(null);
                        // Email: fetch 100 messages → increment by 100
                        // Contacts: fetch 200 contacts → increment by 200
                        const skipIncrement = source === 'email' ? 100 : 200;
                        const nextSkip = skip + skipIncrement;
                        handleLoadPreview(source, nextSkip);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium transition-colors flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Import Next 50
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSaveResult(null);
                      router.push('/people');
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preview Section */}
        {preview && preview.items && (
          <div className="bg-white p-6 rounded-lg shadow border mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <button
                    onClick={() => {
                      setSource(null);
                      setPreview(null);
                      setHasLoadedOnce(false);
                    }}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    ← Change Source
                  </button>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    Preview Contacts
                  </h2>
                </div>
                <p className="text-sm text-gray-500">
                  {preview.items.length} {preview.items.length === 1 ? 'contact' : 'contacts'} available
                </p>
              </div>
              <div className="flex gap-2">
                {preview.items.length > 0 && (
                  <button
                    onClick={toggleSelectAll}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    {selectedIds.size === preview.items.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
                <button
                  onClick={() => handleLoadPreview()}
                  disabled={previewLoading}
                  className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className={`h-4 w-4 ${previewLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            {preview.items.length > 0 ? (
              <>
                <div className="max-h-[calc(100vh-400px)] overflow-y-auto mb-4 border rounded">
                  <div className="grid grid-cols-[auto_1fr_auto] gap-3 px-3 py-2 bg-gray-50 border-b font-semibold text-xs text-gray-600 sticky top-0 z-10">
                    <div className="w-4"></div>
                    <div>Name</div>
                    <div className="text-right">Last Email</div>
                  </div>
                  {preview.items.map((item) => {
                    return (
                      <div
                        key={item.previewId}
                        className={`grid grid-cols-[auto_1fr_auto] gap-3 items-center px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer ${
                          selectedIds.has(item.previewId) ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => toggleSelect(item.previewId)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.previewId)}
                          onChange={() => toggleSelect(item.previewId)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-3.5 w-3.5 text-blue-600 rounded flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-sm text-gray-900 truncate">
                            {item.displayName || item.email.split('@')[0]}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{item.email}</div>
                          {item.companyName && (
                            <div className="text-xs text-gray-400 truncate">{item.companyName}</div>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 text-right whitespace-nowrap">
                          {item.stats?.lastSeenAt 
                            ? new Date(item.stats.lastSeenAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : item.companyName ? '-' : '-'}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <p className="text-sm text-gray-600 font-medium">
                    {selectedIds.size} of {preview.items.length} selected
                  </p>
                  <button
                    onClick={handleReview}
                    disabled={selectedIds.size === 0 || !companyHQId}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm hover:shadow transition-all flex items-center gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Review Selected ({selectedIds.size})
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Mail className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="font-medium mb-2">No contacts found</p>
                <p className="text-sm mb-4">We couldn't find any unique contacts in your recent emails.</p>
                <button
                  onClick={handleLoadPreview}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

export default function MicrosoftEmailIngest() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <MicrosoftEmailIngestContent />
    </Suspense>
  );
}
