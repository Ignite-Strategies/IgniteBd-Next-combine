'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { RefreshCw, Save, X, Sparkles } from 'lucide-react';
import IntelligencePreview from '@/components/enrichment/IntelligencePreview';

function IntelligenceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const previewId = searchParams?.get('previewId');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [rawJson, setRawJson] = useState(null);

  useEffect(() => {
    if (!previewId) {
      setError('No preview ID provided');
      setLoading(false);
      return;
    }

    // Fetch preview data from API
    const fetchPreview = async () => {
      try {
        const response = await api.get(`/api/contacts/enrich/intelligence?previewId=${encodeURIComponent(previewId)}`);
        
        if (response.data?.success && response.data?.previewData) {
          setPreviewData(response.data.previewData);
        } else {
          setError(response.data?.error || 'Failed to load intelligence data');
        }
      } catch (err) {
        console.error('Error fetching preview:', err);
        setError(err.response?.data?.error || 'Failed to load intelligence data');
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [previewId]);

  const handleViewRawJSON = async () => {
    if (!previewData?.redisKey) return;
    
    try {
      const response = await fetch(`/api/contacts/enrich/raw?redisKey=${encodeURIComponent(previewData.redisKey)}`);
      if (response.ok) {
        const data = await response.json();
        setRawJson(data.rawEnrichmentPayload);
        setShowRawJson(true);
      } else {
        console.error('Failed to fetch raw JSON');
      }
    } catch (error) {
      console.error('Failed to fetch raw JSON:', error);
    }
  };

  const handleSave = async () => {
    if (!previewData) {
      alert('No preview data available');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const companyHQId = typeof window !== 'undefined' 
        ? (localStorage.getItem('companyHQId') || localStorage.getItem('companyId'))
        : null;
      if (!companyHQId) {
        alert('Company context required. Please set your company first.');
        setSaving(false);
        return;
      }

      // Step 1: Create contact in CRM
      const contactResponse = await api.post('/api/contacts', {
        crmId: companyHQId,
        firstName: previewData.normalizedContact.firstName,
        lastName: previewData.normalizedContact.lastName,
        email: previewData.normalizedContact.email,
        phone: previewData.normalizedContact.phone,
        title: previewData.normalizedContact.title,
      });

      if (!contactResponse.data?.contact) {
        throw new Error('Failed to create contact');
      }

      const contactId = contactResponse.data.contact.id;

      // Step 2: Save enrichment data with intelligence scores
      await api.post('/api/contacts/enrich/save', {
        contactId,
        redisKey: previewData.redisKey,
      });

      // Step 3: Redirect to contact detail page
      router.push(`/contacts/${contactId}`);
    } catch (err) {
      console.error('Error saving contact:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save contact');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center py-8">
            <RefreshCw className="animate-spin h-6 w-6 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-600">Loading intelligence data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !previewData) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="mx-auto max-w-4xl px-6">
          <div className="rounded-xl bg-white p-8 shadow text-center">
            <p className="text-lg font-semibold text-red-600 mb-4">{error}</p>
            <button
              onClick={() => router.push('/contacts/enrich/linkedin')}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Back to Enrichment
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!previewData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-4xl px-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Intelligence Preview
              </h1>
              <p className="text-gray-600">
                <strong>Step 2 of 3:</strong> Review all intelligence scores and data before saving
              </p>
            </div>
            <button
              onClick={() => router.push('/contacts/enrich/linkedin')}
              className="text-gray-600 hover:text-gray-900"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Intelligence Preview Component */}
        <IntelligencePreview
          normalizedContact={previewData.normalizedContact}
          normalizedCompany={previewData.normalizedCompany}
          intelligenceScores={previewData.intelligenceScores}
          companyIntelligence={previewData.companyIntelligence}
          linkedinUrl={previewData.linkedinUrl}
          onViewRawJSON={handleViewRawJSON}
        />

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-between gap-4">
          <button
            onClick={handleViewRawJSON}
            className="text-sm text-gray-600 hover:text-gray-800 font-medium"
          >
            {showRawJson ? '▼ Hide' : '▶ Show'} Full Apollo JSON
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/contacts/enrich/linkedin')}
              className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save to CRM
                </>
              )}
            </button>
          </div>
        </div>

        {/* Raw JSON Modal */}
        {showRawJson && rawJson && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <h2 className="text-xl font-bold text-gray-900">Raw Apollo JSON</h2>
                <button
                  onClick={() => {
                    setShowRawJson(false);
                    setRawJson(null);
                  }}
                  className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6">
                <pre className="text-xs bg-gray-50 p-4 rounded-lg overflow-x-auto">
                  {JSON.stringify(rawJson, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function IntelligencePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center py-8">
            <RefreshCw className="animate-spin h-6 w-6 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <IntelligenceContent />
    </Suspense>
  );
}

