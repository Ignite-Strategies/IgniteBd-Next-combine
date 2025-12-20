'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useOwner } from '@/hooks/useOwner';
import api from '@/lib/api';
import { Mail, RefreshCw, CheckCircle2, AlertCircle, ArrowLeft, Check, X } from 'lucide-react';

export default function MicrosoftEmailIngest() {
  const router = useRouter();
  const { ownerId, owner } = useOwner(); // ownerId and owner from our DB (via hook)
  const [companyHQId, setCompanyHQId] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedPreviewIds, setSelectedPreviewIds] = useState(new Set());
  const [saveResult, setSaveResult] = useState(null);
  const [error, setError] = useState(null);
  
  // Simple check: tokens exist = connected (green), no tokens = not connected (red)
  // No API calls needed - owner object from hook has all the info
  const isConnected = !!owner?.microsoftAccessToken;

  // Get companyHQId from localStorage and initialize
  useEffect(() => {
    const storedCompanyHQId = typeof window !== 'undefined'
      ? (localStorage.getItem('companyHQId') || localStorage.getItem('companyId'))
      : null;
    
    if (storedCompanyHQId) {
      setCompanyHQId(storedCompanyHQId);
    }
  }, []);

  // Check for OAuth callback success/error in URL params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const success = params.get('success');
      const errorParam = params.get('error');
      
      if (success === '1') {
        // OAuth completed successfully - clear URL params
        window.history.replaceState({}, '', '/contacts/ingest/microsoft');
        // Owner hook will refresh automatically, then useEffect will load preview
        // No need to manually reload - hook handles it
      }
      
      if (errorParam) {
        // OAuth error - show error message
        setError(errorParam === 'owner_not_found' 
          ? 'Unable to identify your account. Please try again.'
          : errorParam === 'no_authorization_code_provided'
          ? 'Authorization was cancelled or incomplete'
          : errorParam);
        // Clear URL params
        window.history.replaceState({}, '', '/contacts/ingest/microsoft');
      }
    }
  }, []);

  // Load preview from API
  // Memoized with useCallback to prevent infinite loops in useEffect
  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('🔄 Loading Microsoft email preview...');
      const response = await api.get('/api/microsoft/email-contacts/preview');
      
      if (response.data?.success) {
        console.log('✅ Preview loaded:', response.data.items?.length || 0, 'contacts');
        setPreview(response.data);
        setSelectedPreviewIds(new Set()); // Reset selection
        setSaveResult(null); // Clear previous save result
      } else {
        throw new Error(response.data?.error || 'Failed to load preview');
      }
    } catch (err) {
      console.error('❌ Failed to load preview:', err);
      console.error('Error details:', {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });
      setError(err.response?.data?.error || err.message || 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  }, []); // Empty deps - function doesn't depend on any props/state

  // Load preview if Microsoft is connected (tokens exist)
  // Simple check: owner.microsoftAccessToken exists = connected, show preview
  useEffect(() => {
    if (!ownerId || !owner) {
      console.log('⏳ Waiting for owner from hook...', { ownerId: !!ownerId, owner: !!owner });
      return; // Wait for owner from hook
    }
    
    console.log('🔍 Checking Microsoft connection:', { 
      isConnected, 
      hasToken: !!owner?.microsoftAccessToken,
      ownerId 
    });
    
    // If tokens exist, load preview automatically
    if (isConnected) {
      console.log('✅ Microsoft connected, loading preview...');
      loadPreview();
    } else {
      console.log('⚠️ Microsoft not connected, skipping preview load');
    }
  }, [ownerId, owner, isConnected, loadPreview]);

  // Redirect to OAuth if not connected
  // IMPORTANT: OAuth login must use direct navigation, not AJAX
  // The /api/microsoft/login endpoint redirects to Microsoft OAuth
  // AJAX requests can't follow OAuth redirects due to CORS
  // Direct navigation (window.location.href) is the correct pattern
  // 
  // CRITICAL: Pass ownerId as query param so callback can find the owner
  // ownerId comes from useOwner hook (resolved from Firebase auth via hook)
  function handleConnectMicrosoft() {
    if (!ownerId) {
      setError('Unable to identify user. Please wait for authentication to complete.');
      return;
    }
    
    // Direct navigation to login endpoint with ownerId - it will redirect to Microsoft OAuth
    window.location.href = `/api/microsoft/login?ownerId=${ownerId}`;
  }

  // Toggle selection
  function toggleSelect(previewId) {
    setSelectedPreviewIds(prev => {
      const updated = new Set(prev);
      if (updated.has(previewId)) {
        updated.delete(previewId);
      } else {
        updated.add(previewId);
      }
      return updated;
    });
  }

  // Toggle all
  function toggleSelectAll() {
    if (!preview || !preview.items) return;
    
    if (selectedPreviewIds.size === preview.items.length) {
      setSelectedPreviewIds(new Set());
    } else {
      setSelectedPreviewIds(new Set(preview.items.map(item => item.previewId)));
    }
  }

  // Save selected contacts
  async function handleSave() {
    if (!companyHQId) {
      setError('companyHQId is required. Please navigate from a company context.');
      return;
    }

    if (selectedPreviewIds.size === 0) {
      setError('Please select at least one contact to save');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await api.post('/api/microsoft/email-contacts/save', {
        previewIds: Array.from(selectedPreviewIds),
        companyHQId,
      });

      if (response.data?.success) {
        setSaveResult({
          saved: response.data.saved,
          skipped: response.data.skipped,
          errors: response.data.errors,
        });
        // Clear selection after save
        setSelectedPreviewIds(new Set());
      } else {
        throw new Error(response.data?.error || 'Failed to save contacts');
      }
    } catch (err) {
      console.error('Save error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save contacts');
    } finally {
      setSaving(false);
    }
  }

  // Handle "Import next 50"
  async function handleNext50() {
    // Invalidate Redis cache by fetching fresh data
    // The API will recompute if we force a refresh
    setSaveResult(null);
    await loadPreview();
  }

  if (loading && !preview) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="mx-auto max-w-4xl px-6">
          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-3" />
              <p className="text-gray-600">Loading preview...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-4xl px-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/contacts')}
            className="mb-4 flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Contacts
          </button>
          <h1 className="text-3xl font-bold mb-2">Import People from Email</h1>
          <p className="text-gray-600">
            Extract contact signals from people you email in Outlook
          </p>
        </div>

        {/* Microsoft Connection Status */}
        <div className="bg-white p-6 rounded-lg shadow border mb-6">
          <h2 className="text-lg font-semibold mb-4">Microsoft Account</h2>
          {isConnected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                <div>
                  <p className="font-medium text-green-700">Connected</p>
                  {owner?.microsoftEmail && (
                    <p className="text-sm text-gray-500">{owner.microsoftEmail}</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleConnectMicrosoft}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Reconnect
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <p className="text-gray-600">Not connected</p>
              </div>
              <button
                onClick={handleConnectMicrosoft}
                disabled={!ownerId}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Connect Microsoft Account
              </button>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <p className="text-red-800">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Success Screen */}
        {saveResult && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <div className="flex items-start">
              <CheckCircle2 className="h-6 w-6 text-green-500 mr-3 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-800 mb-2">
                  {saveResult.saved} contact{saveResult.saved !== 1 ? 's' : ''} saved
                </h3>
                {saveResult.skipped > 0 && (
                  <p className="text-sm text-green-700 mb-4">
                    {saveResult.skipped} contact{saveResult.skipped !== 1 ? 's' : ''} skipped (already exist)
                  </p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={handleNext50}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Import Next 50
                  </button>
                  <button
                    onClick={() => {
                      setSaveResult(null);
                      router.push('/contacts');
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    Done for Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preview Section */}
        {isConnected && (
          <div className="bg-white p-6 rounded-lg shadow border mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Preview Contacts</h2>
                {preview && (
                  <p className="text-sm text-gray-500 mt-1">
                    {preview.items?.length || 0} unique people from {preview.limit} recent emails
                    {preview.generatedAt && (
                      <span className="ml-2">
                        • Generated {new Date(preview.generatedAt).toLocaleString()}
                      </span>
                    )}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {preview && preview.items && preview.items.length > 0 && (
                  <button
                    onClick={toggleSelectAll}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {selectedPreviewIds.size === preview.items.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
                <button
                  onClick={loadPreview}
                  disabled={loading}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 flex items-center"
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            {loading && !preview ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-3" />
                <p className="text-gray-600">Loading preview...</p>
              </div>
            ) : preview && preview.items && preview.items.length > 0 ? (
              <>
                <div className="max-h-96 overflow-y-auto space-y-2 mb-4">
                  {preview.items.map((item) => (
                    <div
                      key={item.previewId}
                      className={`flex items-center gap-3 p-3 border rounded hover:bg-gray-50 cursor-pointer ${
                        selectedPreviewIds.has(item.previewId) ? 'bg-blue-50 border-blue-300' : ''
                      }`}
                      onClick={() => toggleSelect(item.previewId)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPreviewIds.has(item.previewId)}
                        onChange={() => toggleSelect(item.previewId)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {item.displayName || item.email}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{item.email}</p>
                        <div className="flex gap-4 mt-1 text-xs text-gray-400">
                          <span>{item.domain}</span>
                          <span>{item.stats.messageCount} message{item.stats.messageCount !== 1 ? 's' : ''}</span>
                          {item.stats.lastSeenAt && (
                            <span>
                              Last: {new Date(item.stats.lastSeenAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <p className="text-sm text-gray-600">
                    {selectedPreviewIds.size} of {preview.items.length} selected
                  </p>
                  <button
                    onClick={handleSave}
                    disabled={saving || selectedPreviewIds.size === 0 || !companyHQId}
                    className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Save Selected Contacts
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Mail className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No contacts found in preview</p>
                <button
                  onClick={loadPreview}
                  className="mt-4 text-sm text-blue-600 hover:text-blue-800"
                >
                  Refresh Preview
                </button>
              </div>
            )}
          </div>
        )}

        {/* Help Text */}
        {!isConnected && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              Connect your Microsoft account to import contacts from people you email in Outlook.
              This extracts contact signals from your inbox metadata (no message content is read).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
