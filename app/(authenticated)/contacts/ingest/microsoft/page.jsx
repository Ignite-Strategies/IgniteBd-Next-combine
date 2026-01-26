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
  
  // Connection status from URL param (set by previous page) or default to false
  // Trust the previous page - no API call on mount
  const isConnectedFromUrl = searchParams?.get('microsoftConnected') === 'true';
  const [isConnected, setIsConnected] = useState(isConnectedFromUrl);
  const [connectionError, setConnectionError] = useState(null);
  
  // Initialize ownerId on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedOwnerId = localStorage.getItem('ownerId');
    if (storedOwnerId) setOwnerId(storedOwnerId);
  }, []);
  
  // Handle OAuth callback - set connection status
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const success = searchParams?.get('success');
    const error = searchParams?.get('error');
    
    // If OAuth just completed successfully, we're connected
    if (success === '1') {
      setIsConnected(true);
      setConnectionError(null);
      router.replace('/contacts/ingest/microsoft' + (companyHQId ? `?companyHQId=${companyHQId}&microsoftConnected=true` : '?microsoftConnected=true'));
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

  // Don't auto-load - user selects source first

  // Load preview function - THIS IS WHERE WE DISCOVER IF CONNECTED
  const handleLoadPreview = useCallback(async (selectedSource) => {
    const sourceToUse = selectedSource || source;
    if (!sourceToUse) return;
    
    setPreviewLoading(true);
    setHasLoadedOnce(true);
    setConnectionError(null);
    
    try {
      const endpoint = sourceToUse === 'email' 
        ? '/api/microsoft/email-contacts/preview'
        : '/api/microsoft/contacts/preview';
      const response = await api.get(endpoint);
      
      if (response.data?.success) {
        setPreview(response.data);
        setSelectedIds(new Set());
        setSaveResult(null);
        // If we got here, we're connected! Update connection status
        setIsConnected(true);
        setConnectionError(null);
      } else {
        setPreview(null);
      }
    } catch (error) {
      console.error('Failed to load preview:', error);
      
      // If 401, they need to connect - THIS IS HOW WE KNOW THEY'RE NOT CONNECTED
      if (error.response?.status === 401) {
        setConnectionError({
          type: 'not_connected',
          message: 'Microsoft account not connected. Please connect your account first.',
        });
        setIsConnected(false);
      } else {
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

  // Select source and load
  const handleSelectSource = useCallback((selectedSource) => {
    setSource(selectedSource);
    handleLoadPreview(selectedSource);
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

  // Save button
  async function handleSave() {
    if (!companyHQId) {
      alert('Company context required. Please navigate from a company.');
      return;
    }
    if (selectedIds.size === 0) {
      alert('Please select at least one contact to import.');
      return;
    }

    setSaving(true);
    try {
      const endpoint = source === 'email'
        ? '/api/microsoft/email-contacts/save'
        : '/api/microsoft/contacts/save';
      const response = await api.post(endpoint, {
        previewIds: Array.from(selectedIds),
        companyHQId,
      });
      if (response.data?.success) {
        setSaveResult({
          saved: response.data.saved,
          skipped: response.data.skipped,
        });
        setSelectedIds(new Set());
      }
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save contacts. Please try again.');
    } finally {
      setSaving(false);
    }
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

        {/* Connection Error from API call */}
        {connectionError && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start flex-1">
                <AlertCircle className="h-5 w-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-yellow-800 mb-1">
                    {connectionError.type === 'not_connected' ? 'Connection Required' : 'Error'}
                  </h3>
                  <p className="text-sm text-yellow-700">{connectionError.message}</p>
                </div>
              </div>
              {connectionError.type === 'not_connected' && (
                <button
                  onClick={handleConnect}
                  disabled={!ownerId}
                  className="ml-4 text-sm px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
                >
                  Connect Now
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
                  <button
                    onClick={() => {
                      setSaveResult(null);
                      handleLoadPreview();
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium transition-colors flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Import Next 50
                  </button>
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
                  <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-3 py-2 bg-gray-50 border-b font-semibold text-xs text-gray-600 sticky top-0 z-10">
                    <div className="w-4"></div>
                    <div>Name</div>
                    <div className="text-right">Last Send</div>
                    <div className="text-center">Status</div>
                    <div className="text-right w-16">Times Contacted</div>
                  </div>
                  {preview.items.map((item) => {
                    // Determine status color based on last contact
                    let statusColor = 'gray';
                    let statusText = 'New';
                    if (item.stats?.lastSeenAt) {
                      const daysSince = Math.floor((new Date() - new Date(item.stats.lastSeenAt)) / (1000 * 60 * 60 * 24));
                      if (daysSince <= 7) {
                        statusColor = 'green';
                        statusText = 'Recent';
                      } else if (daysSince <= 30) {
                        statusColor = 'yellow';
                        statusText = 'Active';
                      } else {
                        statusColor = 'red';
                        statusText = 'Stale';
                      }
                    }
                    if (item.alreadyExists) {
                      statusColor = 'blue';
                      statusText = 'Exists';
                    }

                    return (
                      <div
                        key={item.previewId}
                        className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 items-center px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer ${
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
                        </div>
                        <div className="text-xs text-gray-500 text-right whitespace-nowrap">
                          {item.stats?.lastSeenAt 
                            ? new Date(item.stats.lastSeenAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : item.companyName || '-'}
                        </div>
                        <div className="flex justify-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            statusColor === 'green' ? 'bg-green-100 text-green-700' :
                            statusColor === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                            statusColor === 'red' ? 'bg-red-100 text-red-700' :
                            statusColor === 'blue' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {statusText}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 text-right w-16">
                          {item.stats?.messageCount ? `${item.stats.messageCount}` : ''}
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
                    onClick={handleSave}
                    disabled={saving || selectedIds.size === 0 || !companyHQId}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm hover:shadow transition-all flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Import Selected ({selectedIds.size})
                      </>
                    )}
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
