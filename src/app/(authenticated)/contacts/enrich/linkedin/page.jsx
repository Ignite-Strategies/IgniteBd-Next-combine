'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Search, RefreshCw, Linkedin, X, Sparkles, Save } from 'lucide-react';
import IntelligencePreview from '@/components/enrichment/IntelligencePreview';

function LinkedInEnrichContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams?.get('returnTo');
  
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [generatingIntel, setGeneratingIntel] = useState(false);
  const [intelligenceData, setIntelligenceData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [rawJson, setRawJson] = useState(null);

  async function handlePreview() {
    setLoading(true);
    setPreview(null);
    setIntelligenceData(null); // Clear intelligence when new preview

    try {
      const r = await api.post('/api/enrich/preview', { linkedinUrl: url });
      setPreview(r.data.preview || null);
    } catch (err) {
      alert(err.response?.data?.details || err.message || 'Preview failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateIntelligence() {
    if (!preview) {
      alert('Please preview the contact first');
      return;
    }

    setGeneratingIntel(true);

    try {
      const response = await api.post('/api/contacts/enrich/generate-intel', {
        linkedinUrl: url,
      });

      if (response.data?.success) {
        // Store intelligence data in component state (not Redis previewId)
        setIntelligenceData({
          normalizedContact: response.data.normalizedContact,
          normalizedCompany: response.data.normalizedCompany,
          intelligenceScores: response.data.intelligenceScores,
          companyIntelligence: response.data.companyIntelligence,
          redisKey: response.data.redisKey,
          linkedinUrl: url,
        });
      } else {
        alert(response.data?.error || 'Failed to generate intelligence');
      }
    } catch (err) {
      console.error('Error generating intelligence:', err);
      alert(err.response?.data?.error || err.message || 'Failed to generate intelligence');
    } finally {
      setGeneratingIntel(false);
    }
  }

  async function handleSave() {
    if (!intelligenceData) {
      alert('No intelligence data available');
      return;
    }

    setSaving(true);

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
        firstName: intelligenceData.normalizedContact.firstName,
        lastName: intelligenceData.normalizedContact.lastName,
        email: intelligenceData.normalizedContact.email,
        phone: intelligenceData.normalizedContact.phone,
        title: intelligenceData.normalizedContact.title,
      });

      if (!contactResponse.data?.contact) {
        throw new Error('Failed to create contact');
      }

      const contactId = contactResponse.data.contact.id;

      // Step 2: Save enrichment data with intelligence scores
      await api.post('/api/contacts/enrich/save', {
        contactId,
        redisKey: intelligenceData.redisKey,
      });

      // Step 3: Redirect to contact detail page
      router.push(`/contacts/${contactId}`);
    } catch (err) {
      console.error('Error saving contact:', err);
      alert(err.response?.data?.error || err.message || 'Failed to save contact');
      setSaving(false);
    }
  }

  const handleViewRawJSON = async () => {
    if (!intelligenceData?.redisKey) return;
    
    try {
      const response = await fetch(`/api/contacts/enrich/raw?redisKey=${encodeURIComponent(intelligenceData.redisKey)}`);
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

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-4xl px-6">
        <h1 className="text-3xl font-bold mb-6">🔍 LinkedIn Lookup & Enrich</h1>

        {/* URL Input - Always visible */}
        <div className="flex gap-3 mb-6">
          <input
            type="url"
            placeholder="https://linkedin.com/in/username"
            className="flex-1 border px-4 py-2 rounded"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && url && !loading) {
                handlePreview();
              }
            }}
            disabled={loading || generatingIntel || saving}
          />
          <button
            onClick={handlePreview}
            disabled={loading || !url || generatingIntel || saving}
            className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <RefreshCw className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
            Preview
          </button>
        </div>

        {/* Preview Card - Step 1: Preview Only */}
        {preview && !intelligenceData && (
          <div className="bg-white p-5 rounded-lg shadow border mb-6">
            <div className="flex justify-between mb-4">
              <h2 className="font-semibold text-lg">Preview Found</h2>
              <button onClick={() => {
                setPreview(null);
                setIntelligenceData(null);
              }}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {preview.firstName || preview.lastName ? (
                <p className="font-semibold text-gray-900 text-lg">
                  {preview.firstName} {preview.lastName}
                </p>
              ) : null}

              {preview.title && (
                <p className="text-gray-700 text-sm">
                  <span className="font-medium">Title:</span> {preview.title}
                </p>
              )}
              
              {preview.companyName && (
                <p className="text-gray-700 text-sm">
                  <span className="font-medium">Company:</span> {preview.companyName}
                </p>
              )}

              {preview.email && (
                <p className="text-gray-700 text-sm">
                  <span className="font-medium">Email:</span> {preview.email}
                </p>
              )}

              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 text-sm underline flex items-center gap-1 mt-3"
              >
                <Linkedin className="h-4 w-4" /> View LinkedIn Profile
              </a>
            </div>

            {/* Generate Intelligence Button */}
            <button
              onClick={handleGenerateIntelligence}
              disabled={generatingIntel}
              className="mt-6 w-full bg-indigo-600 text-white px-6 py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold hover:bg-indigo-700 transition"
            >
              {generatingIntel ? (
                <>
                  <RefreshCw className="animate-spin h-5 w-5" />
                  Generating Intelligence...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  Generate Intelligence
                </>
              )}
            </button>

            <p className="mt-2 text-xs text-gray-500 text-center">
              This will compute all intelligence scores and show you the full profile
            </p>
          </div>
        )}

        {/* Intelligence Preview - Step 2: Inline Intelligence */}
        {intelligenceData && intelligenceData.normalizedContact && intelligenceData.intelligenceScores && (
          <div className="space-y-6 mb-6">
            {/* Intelligence Preview Component */}
            <IntelligencePreview
              normalizedContact={intelligenceData.normalizedContact}
              normalizedCompany={intelligenceData.normalizedCompany}
              intelligenceScores={intelligenceData.intelligenceScores}
              companyIntelligence={intelligenceData.companyIntelligence}
              linkedinUrl={intelligenceData.linkedinUrl}
              onViewRawJSON={handleViewRawJSON}
            />

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-4 bg-white rounded-lg p-4 shadow">
              <button
                onClick={handleViewRawJSON}
                className="text-sm text-gray-600 hover:text-gray-800 font-medium"
              >
                {showRawJson ? '▼ Hide' : '▶ Show'} Full Apollo JSON
              </button>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setPreview(null);
                    setIntelligenceData(null);
                    setUrl('');
                  }}
                  className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  disabled={saving}
                >
                  Start Over
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
          </div>
        )}

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

export default function LinkedInEnrich() {
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
      <LinkedInEnrichContent />
    </Suspense>
  );
}
