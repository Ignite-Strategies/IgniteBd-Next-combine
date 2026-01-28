'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Check, X, ArrowLeft, Save } from 'lucide-react';

function MicrosoftReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  const source = searchParams?.get('source') || 'email'; // 'email' or 'contacts'
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Get preview items from sessionStorage (passed from preview page)
    const previewItemsJson = sessionStorage.getItem('microsoftPreviewItems');
    const selectedIdsJson = sessionStorage.getItem('microsoftSelectedIds');
    
    if (!previewItemsJson || !selectedIdsJson) {
      setError('No contacts selected. Please go back and select contacts.');
      setLoading(false);
      return;
    }

    const previewItems = JSON.parse(previewItemsJson);
    const selectedIds = JSON.parse(selectedIdsJson);
    
    // Filter to only selected items
    const selectedItems = previewItems.filter(item => selectedIds.includes(item.previewId));

    // Call review API to map and check existing
    async function loadReview() {
      try {
        const response = await api.post('/api/microsoft/contacts/review', {
          previewItems: selectedItems,
          companyHQId,
        });

        if (response.data?.success) {
          setContacts(response.data.contacts);
          setStats(response.data.stats);
        } else {
          setError(response.data?.error || 'Failed to load review');
        }
      } catch (err) {
        console.error('Review load failed:', err);
        setError(err.response?.data?.error || 'Failed to load review');
      } finally {
        setLoading(false);
      }
    }

    loadReview();
  }, [companyHQId]);

  async function handleSave() {
    if (!companyHQId) {
      alert('Company context required.');
      return;
    }

    setSaving(true);
    try {
      const endpoint = source === 'email'
        ? '/api/microsoft/email-contacts/save'
        : '/api/microsoft/contacts/save';
      
      const response = await api.post(endpoint, {
        previewIds: contacts.map(c => c.previewId),
        previewItems: contacts.map(c => c.originalPreview),
        companyHQId,
      });

      if (response.data?.success) {
        // Clear session storage
        sessionStorage.removeItem('microsoftPreviewItems');
        sessionStorage.removeItem('microsoftSelectedIds');
        
        // Navigate back with success
        router.push(`/contacts/ingest/microsoft?companyHQId=${companyHQId}&saved=${response.data.saved}&skipped=${response.data.skipped}`);
      }
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save contacts. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    router.back();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Preparing contacts for review...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="mx-auto max-w-4xl px-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">{error}</p>
            <button
              onClick={handleBack}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-4xl px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Review Contacts Before Import</h1>
            {stats && (
              <div className="flex items-center gap-4 mt-2">
                {stats.new > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
                      {stats.new} New
                    </span>
                  </div>
                )}
                {stats.alreadyExists > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm font-medium">
                      {stats.alreadyExists} Already in Contacts
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleBack}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        {/* Warning Banner if all exist */}
        {stats && stats.alreadyExists === stats.total && stats.total > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <X className="h-5 w-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-yellow-800 mb-1">
                  All {stats.total} contact{stats.total !== 1 ? 's' : ''} already exist in your database
                </h3>
                <p className="text-sm text-yellow-700">
                  These contacts won't be imported again. You can go back and select different contacts.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Contacts Table */}
        <div className="bg-white rounded-lg shadow border mb-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">First Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Last Name</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {contacts.map((contact) => (
                  <tr
                    key={contact.previewId}
                    className={contact.alreadyExists ? 'bg-yellow-50' : 'hover:bg-gray-50'}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-sm text-gray-900">
                        {contact.displayName || contact.email.split('@')[0]}
                      </div>
                      {contact.companyName && (
                        <div className="text-xs text-gray-500">{contact.companyName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{contact.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {contact.firstName || <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {contact.lastName || <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {contact.alreadyExists ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          <X className="h-3 w-3 mr-1" />
                          Already in Contacts
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                          <Check className="h-3 w-3 mr-1" />
                          Will Import
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
          >
            Cancel
          </button>
          <div className="flex items-center gap-4">
            {stats && stats.alreadyExists > 0 && (
              <p className="text-sm text-gray-600">
                {stats.alreadyExists} already exist • {stats.new} will be imported
              </p>
            )}
            <button
              onClick={handleSave}
              disabled={saving || contacts.length === 0 || (stats && stats.new === 0)}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : stats && stats.new === 0 ? (
                <>
                  <X className="h-4 w-4" />
                  All Already Exist
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Import {stats?.new || 0} Contact{stats?.new !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MicrosoftReview() {
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
      <MicrosoftReviewContent />
    </Suspense>
  );
}
