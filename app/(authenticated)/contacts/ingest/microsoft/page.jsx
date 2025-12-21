'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOwner } from '@/hooks/useOwner';
import api from '@/lib/api';
import { Mail, RefreshCw, CheckCircle2, AlertCircle, ArrowLeft, Check, Users, Download } from 'lucide-react';

export default function MicrosoftEmailIngest() {
  const router = useRouter();
  const { ownerId, isMicrosoftConnected, microsoftEmail } = useOwner();
  
  const [companyHQId, setCompanyHQId] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Get companyHQId from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('companyHQId') || localStorage.getItem('companyId');
      if (stored) setCompanyHQId(stored);
    }
  }, []);

  // Auto-load preview when connected (only once)
  useEffect(() => {
    if (isMicrosoftConnected && !preview && !previewLoading && !hasLoadedOnce) {
      handleLoadPreview();
    }
  }, [isMicrosoftConnected]); // Only depend on connection status

  // Load preview function
  async function handleLoadPreview() {
    setPreviewLoading(true);
    setHasLoadedOnce(true);
    try {
      const response = await api.get('/api/microsoft/email-contacts/preview');
      if (response.data?.success) {
        setPreview(response.data);
        setSelectedIds(new Set());
        setSaveResult(null);
      } else {
        setPreview(null);
      }
    } catch (error) {
      console.error('Failed to load preview:', error);
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  // Connect button
  function handleConnect() {
    if (!ownerId) {
      alert('Please sign in first.');
      return;
    }
    window.location.href = `/api/microsoft/login?ownerId=${ownerId}`;
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
      const response = await api.post('/api/microsoft/email-contacts/save', {
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
          <button
            onClick={() => router.push('/contacts')}
            className="mb-4 flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Contacts
          </button>
          <div className="flex items-center gap-3 mb-2">
            <Mail className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold">Import People from Email</h1>
          </div>
          <p className="text-gray-600">
            Extract contact signals from people you email in Outlook
          </p>
        </div>

        {/* Microsoft Connection Status */}
        <div className="bg-white p-6 rounded-lg shadow border mb-6">
          <h2 className="text-lg font-semibold mb-4">Microsoft Account</h2>
          
          {isMicrosoftConnected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-gray-700">Connected{microsoftEmail ? ` as ${microsoftEmail}` : ''}</span>
              </div>
              <button
                onClick={handleDisconnect}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 mb-4">
                Connect your Microsoft account to import contacts from Outlook.
              </p>
              <button
                onClick={handleConnect}
                className="bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 font-medium"
              >
                Connect Microsoft
              </button>
            </div>
          )}
        </div>

        {/* Loading State */}
        {isMicrosoftConnected && previewLoading && !preview && (
          <div className="bg-white p-12 rounded-lg shadow border mb-6">
            <div className="flex flex-col items-center justify-center">
              <RefreshCw className="h-12 w-12 animate-spin text-blue-600 mb-4" />
              <p className="text-gray-600 font-medium">Loading contacts from your inbox...</p>
              <p className="text-sm text-gray-500 mt-2">Analyzing recent email metadata</p>
            </div>
          </div>
        )}

        {/* Empty State - Connected but no preview loaded */}
        {isMicrosoftConnected && !previewLoading && !preview && (
          <div className="bg-white p-12 rounded-lg shadow border mb-6">
            <div className="flex flex-col items-center justify-center text-center">
              <Users className="h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Import Contacts</h3>
              <p className="text-gray-600 mb-6 max-w-md">
                Click the button below to scan your recent emails and find people you've been in contact with.
              </p>
              <button
                onClick={handleLoadPreview}
                disabled={previewLoading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm hover:shadow transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <Download className="h-5 w-5" />
                {previewLoading ? 'Loading...' : 'Load Contacts from Email'}
              </button>
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
                      router.push('/contacts');
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
        {isMicrosoftConnected && preview && preview.items && (
          <div className="bg-white p-6 rounded-lg shadow border mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  Preview Contacts
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {preview.items.length} unique {preview.items.length === 1 ? 'person' : 'people'} from {preview.limit} recent emails
                  {preview.generatedAt && (
                    <span className="ml-2">
                      • Generated {new Date(preview.generatedAt).toLocaleString()}
                    </span>
                  )}
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
                  onClick={handleLoadPreview}
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
                <div className="max-h-96 overflow-y-auto space-y-2 mb-4 border rounded-lg p-2">
                  {preview.items.map((item) => (
                    <div
                      key={item.previewId}
                      className={`flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedIds.has(item.previewId) ? 'bg-blue-50 border-2 border-blue-300' : 'border border-gray-200'
                      }`}
                      onClick={() => toggleSelect(item.previewId)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.previewId)}
                        onChange={() => toggleSelect(item.previewId)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {item.displayName || item.email}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{item.email}</p>
                        <div className="flex gap-4 mt-1 text-xs text-gray-400">
                          <span className="font-medium">{item.domain}</span>
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
