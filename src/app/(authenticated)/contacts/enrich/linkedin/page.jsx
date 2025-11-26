'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Search, RefreshCw, Linkedin, X, Sparkles } from 'lucide-react';

function LinkedInEnrichContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams?.get('returnTo'); // e.g., 'persona' if coming from persona builder
  
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [generatingIntel, setGeneratingIntel] = useState(false);

  async function handlePreview() {
    setLoading(true);
    setPreview(null);

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

      if (response.data?.success && response.data?.previewId) {
        // Redirect to intelligence preview page
        router.push(`/contacts/enrich/intelligence?previewId=${encodeURIComponent(response.data.previewId)}`);
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

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-2xl px-6">
        <h1 className="text-3xl font-bold mb-6">🔍 LinkedIn Lookup & Enrich</h1>

        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs text-blue-700">
            <strong>Step 1 of 3:</strong> Preview contact match. No intelligence or saving yet.
          </p>
        </div>

        {/* URL Input */}
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
          />
          <button
            onClick={handlePreview}
            disabled={loading || !url}
            className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <RefreshCw className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
            Preview
          </button>
        </div>

        {/* Preview Card - Step 1: Preview Only */}
        {preview && (
          <div className="bg-white p-5 rounded-lg shadow border mb-6">
            <div className="flex justify-between mb-4">
              <h2 className="font-semibold text-lg">Preview Found</h2>
              <button onClick={() => setPreview(null)}>
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

            {/* Generate Intelligence Button - Step 2 */}
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
      </div>
    </div>
  );
}

export default function LinkedInEnrich() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="mx-auto max-w-2xl px-6">
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
