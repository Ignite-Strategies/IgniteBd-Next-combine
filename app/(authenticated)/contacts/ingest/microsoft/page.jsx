'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useOwner } from '@/hooks/useOwner';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { Mail, RefreshCw, CheckCircle2, AlertCircle, ArrowLeft, Check, X } from 'lucide-react';

// UI states for error handling
const UI_STATES = {
  SUCCESS: 'SUCCESS',
  LOGIN_REQUIRED: 'LOGIN_REQUIRED',
  CONNECT_MICROSOFT: 'CONNECT_MICROSOFT',
  RECONNECT_MICROSOFT: 'RECONNECT_MICROSOFT',
  RETRY: 'RETRY',
};

export default function MicrosoftEmailIngest() {
  const router = useRouter();
  const { ownerId, owner } = useOwner(); // ownerId and owner from our DB (via hook)
  const [companyHQId, setCompanyHQId] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedPreviewIds, setSelectedPreviewIds] = useState(new Set());
  const [saveResult, setSaveResult] = useState(null);
  const [uiState, setUiState] = useState(null); // UI state instead of raw error
  const [errorMessage, setErrorMessage] = useState(null); // User-friendly message
  
  // Simple check: tokens exist = connected (green), no tokens = not connected (red)
  // No API calls needed - owner object from hook has all the info
  const isConnected = !!owner?.microsoftAccessToken;

  // CRITICAL: Owner must be hydrated from welcome page
  // If owner is not available from hook, redirect to welcome
  // NO API calls to hydrate owner on this page - use hook exclusively
  useEffect(() => {
    // Give hook a moment to provide owner data (if it's already hydrated from welcome)
    const timer = setTimeout(() => {
      if (!ownerId || !owner) {
        console.log('⚠️ Owner not available from hook - redirecting to welcome');
        router.push('/welcome');
      }
    }, 1000); // 1 second grace period for hook to provide data

    return () => clearTimeout(timer);
  }, [ownerId, owner, router]);

  // Get companyHQId from localStorage and initialize
  useEffect(() => {
    const storedCompanyHQId = typeof window !== 'undefined'
      ? (localStorage.getItem('companyHQId') || localStorage.getItem('companyId'))
      : null;
    
    if (storedCompanyHQId) {
      setCompanyHQId(storedCompanyHQId);
    }
  }, []);

  // Check for OAuth callback session ID and save tokens
  // CRITICAL: Add gating checks BEFORE calling API - prevent invalid requests
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const oauthSession = params.get('oauth_session');
      const errorParam = params.get('error');
      
      // Handle OAuth errors from callback
      if (errorParam) {
        setUiState(UI_STATES.RECONNECT_MICROSOFT);
        setErrorMessage(
          errorParam === 'ownerId_not_found' || errorParam === 'owner_not_found'
            ? 'Unable to identify your account. Please try again.'
            : errorParam === 'no_authorization_code_provided'
            ? 'Authorization was cancelled or incomplete'
            : errorParam === 'invalid_state'
            ? 'OAuth session expired. Please try again.'
            : 'OAuth error occurred. Please try again.'
        );
        window.history.replaceState({}, '', '/contacts/ingest/microsoft');
        return;
      }
      
      // If we have a session ID from OAuth callback, save tokens
      if (oauthSession) {
        // Clear URL params immediately
        window.history.replaceState({}, '', '/contacts/ingest/microsoft');
        
        // GATING CHECKS: Prevent invalid requests before calling API
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) {
          setUiState(UI_STATES.LOGIN_REQUIRED);
          setErrorMessage('Please sign in to continue');
          return;
        }
        
        if (!ownerId) {
          setUiState(UI_STATES.LOGIN_REQUIRED);
          setErrorMessage('Account not loaded. Please refresh the page.');
          return;
        }
        
        // All checks passed - save tokens
        const saveTokens = async () => {
          try {
            const response = await api.post('/api/microsoft/tokens/save', {
              sessionId: oauthSession,
            });
            
            if (response.data?.success) {
              setUiState(UI_STATES.SUCCESS);
              setErrorMessage(null);
              // Owner hook will refresh automatically, then preview will load
            } else {
              // Backend returned error (shouldn't happen with new error format)
              setUiState(UI_STATES.RETRY);
              setErrorMessage(response.data?.message || 'Failed to save tokens');
            }
          } catch (err) {
            // Axios interceptor transforms errors to structured format
            switch (err.action) {
              case 'LOGIN_REQUIRED':
                setUiState(UI_STATES.LOGIN_REQUIRED);
                setErrorMessage('Please sign in to continue');
                break;
              case 'RECONNECT_MICROSOFT':
                setUiState(UI_STATES.RECONNECT_MICROSOFT);
                setErrorMessage(err.message || 'Please reconnect your Microsoft account');
                break;
              case 'RELOAD_APP':
                setUiState(UI_STATES.LOGIN_REQUIRED);
                setErrorMessage('Account not found. Please refresh the page.');
                break;
              case 'RETRY':
              default:
                setUiState(UI_STATES.RETRY);
                setErrorMessage(err.message || 'Failed to save tokens. Please try again.');
            }
          }
        };
        
        saveTokens();
      }
    }
  }, [ownerId]); // Wait for ownerId before saving tokens

  // Load preview from API
  // Memoized with useCallback to prevent infinite loops in useEffect
  const loadPreview = useCallback(async () => {
    setLoading(true);
    setUiState(null);
    setErrorMessage(null);

    try {
      const response = await api.get('/api/microsoft/email-contacts/preview');
      
      if (response.data?.success) {
        setPreview(response.data);
        setSelectedPreviewIds(new Set()); // Reset selection
        setSaveResult(null); // Clear previous save result
      } else {
        setUiState(UI_STATES.RETRY);
        setErrorMessage(response.data?.message || 'Failed to load preview');
      }
    } catch (err) {
      // Axios interceptor transforms errors to structured format
      switch (err.action) {
        case 'LOGIN_REQUIRED':
          setUiState(UI_STATES.LOGIN_REQUIRED);
          setErrorMessage('Please sign in to continue');
          break;
        case 'RETRY':
        default:
          setUiState(UI_STATES.RETRY);
          setErrorMessage(err.message || 'Failed to load preview');
      }
    } finally {
      setLoading(false);
    }
  }, []); // Empty deps - function doesn't depend on any props/state

  // Load preview if Microsoft is connected (tokens exist)
  // Simple check: owner.microsoftAccessToken exists = connected, show preview
  // Only run once when owner loads and is connected
  // CRITICAL: Owner must come from hook (already hydrated on welcome) - NO API calls here
  useEffect(() => {
    if (!ownerId || !owner) {
      return; // Owner not available - redirect will happen in other effect
    }
    
    // Compute isConnected inside effect (not as dependency)
    // This prevents infinite loops when owner updates
    const isConnected = !!owner?.microsoftAccessToken;
    
    // Only load preview if connected AND we don't already have preview data
    // This prevents infinite loops
    if (isConnected && !preview) {
      console.log('✅ Microsoft connected, loading preview...');
      loadPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, owner]); // loadPreview is stable (useCallback), preview checked inside but not in deps

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
      setUiState(UI_STATES.RETRY);
      setErrorMessage('Company context required. Please navigate from a company.');
      return;
    }

    if (selectedPreviewIds.size === 0) {
      setUiState(UI_STATES.RETRY);
      setErrorMessage('Please select at least one contact to save');
      return;
    }

    setSaving(true);
    setUiState(null);
    setErrorMessage(null);

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
        setUiState(UI_STATES.RETRY);
        setErrorMessage(response.data?.message || 'Failed to save contacts');
      }
    } catch (err) {
      // Axios interceptor transforms errors to structured format
      switch (err.action) {
        case 'LOGIN_REQUIRED':
          setUiState(UI_STATES.LOGIN_REQUIRED);
          setErrorMessage('Please sign in to continue');
          break;
        case 'RETRY':
        default:
          setUiState(UI_STATES.RETRY);
          setErrorMessage(err.message || 'Failed to save contacts');
      }
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

  // CRITICAL: Owner must be available from hook (hydrated on welcome page)
  // If not available, show loading state while redirect happens
  if (!ownerId || !owner) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="mx-auto max-w-4xl px-6">
          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-3" />
              <p className="text-gray-600">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    );
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
                onClick={() => {
                  if (!ownerId) {
                    alert('Please wait for authentication to complete.');
                    return;
                  }
                  // IMPORTANT: OAuth login must use browser navigation.
                  // Do NOT replace with Axios, fetch, or move into useEffect.
                  // Pass ownerId in URL so callback can save tokens
                  window.location.href = `/api/microsoft/login?ownerId=${ownerId}`;
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Reconnect
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <div>
                  <p className="text-gray-600 font-medium">Not connected</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Connect your Microsoft account to import contacts from Outlook
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  // IMPORTANT: OAuth login must use browser navigation.
                  // Do NOT replace with Axios, fetch, or move into useEffect.
                  window.location.href = '/api/microsoft/login';
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm hover:shadow transition-all"
              >
                Connect Microsoft Account
              </button>
            </div>
          )}
        </div>

        {/* Error Message - UI State Based */}
        {uiState && errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                  <p className="text-red-800 font-medium">{errorMessage}</p>
                </div>
                {/* Action buttons based on UI state */}
                <div className="flex gap-2 mt-3">
                  {uiState === UI_STATES.LOGIN_REQUIRED && (
                    <button
                      onClick={() => router.push('/welcome')}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                    >
                      Go to Sign In
                    </button>
                  )}
                  {uiState === UI_STATES.RECONNECT_MICROSOFT && (
                    <button
                      onClick={() => {
                        if (!ownerId) {
                          router.push('/welcome');
                          return;
                        }
                        window.location.href = `/api/microsoft/login?ownerId=${ownerId}`;
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      Reconnect Microsoft
                    </button>
                  )}
                  {uiState === UI_STATES.RETRY && (
                    <button
                      onClick={() => {
                        setUiState(null);
                        setErrorMessage(null);
                        if (isConnected) {
                          loadPreview();
                        }
                      }}
                      className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setUiState(null);
                  setErrorMessage(null);
                }}
                className="text-red-600 hover:text-red-800 ml-4"
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
