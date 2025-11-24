'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Search, RefreshCw, Sparkles, Linkedin, User, X, UserCircle, Target, Plus, Building2 } from 'lucide-react';

export default function LinkedInEnrich() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams?.get('returnTo'); // e.g., 'persona' if coming from persona builder
  
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [enriching, setEnriching] = useState(false);
  const [enriched, setEnriched] = useState(null);
  const [rawApolloResponse, setRawApolloResponse] = useState(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [redisKey, setRedisKey] = useState(null);

  async function handlePreview() {
    setLoading(true);
    setPreview(null);
    setEnriched(null);
    setRawApolloResponse(null);
    setShowRawJson(false);
    setRedisKey(null);

    try {
      const r = await api.post('/api/enrich/preview', { linkedinUrl: url });
      setPreview(r.data.preview || null);
    } catch (err) {
      alert(err.response?.data?.details || err.message || 'Preview failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleEnrich() {
    setEnriching(true);
    setEnriched(null);
    setRawApolloResponse(null);
    setShowRawJson(false);
    setRedisKey(null);

    try {
      const r = await api.post('/api/enrich/enrich', { linkedinUrl: url });
      setEnriched(r.data.enrichedProfile || null);
      setRawApolloResponse(r.data.rawApolloResponse || null);
      setRedisKey(r.data.redisKey || null);
    } catch (err) {
      alert(err.response?.data?.details || err.message || 'Enrichment failed');
    } finally {
      setEnriching(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-2xl px-6">
        <h1 className="text-3xl font-bold mb-6">🔍 LinkedIn Lookup & Enrich</h1>

        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs text-blue-700">
            ⚠️ <strong>External lookup only</strong> - No CRM lookups, no contact creation. Data stored in Redis.
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

        {/* Preview Card */}
        {preview && (
          <div className="bg-white p-5 rounded-lg shadow border mb-6">
            <div className="flex justify-between">
              <h2 className="font-semibold text-lg">Preview Found</h2>
              <button onClick={() => setPreview(null)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="mt-3">
              {preview.firstName || preview.lastName ? (
                <p className="font-semibold text-gray-900">
                  {preview.firstName} {preview.lastName}
                </p>
              ) : null}

              {preview.title && <p className="text-gray-700 text-sm">{preview.title}</p>}
              {preview.companyName && (
                <p className="text-gray-700 text-sm">Company: {preview.companyName}</p>
              )}

              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 text-sm underline flex items-center gap-1 mt-2"
              >
                <Linkedin className="h-4 w-4" /> View LinkedIn
              </a>
            </div>

            {/* Enrich Button */}
            <button
              onClick={handleEnrich}
              disabled={enriching}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enriching ? <RefreshCw className="animate-spin h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              Enrich
            </button>
          </div>
        )}

        {/* Enriched Card */}
        {enriched && (
          <div className="bg-green-50 border border-green-200 p-5 rounded-lg shadow mb-6">
            <h2 className="font-semibold text-lg text-green-700 mb-2">✅ Enrichment Complete</h2>
            
            {redisKey && (
              <div className="mb-3 text-xs text-green-600">
                Redis key: <code className="bg-green-100 px-1 py-0.5 rounded">{redisKey}</code>
              </div>
            )}

            <div className="mb-3">
              {enriched.firstName || enriched.lastName ? (
                <p className="font-semibold text-gray-900">
                  {enriched.firstName} {enriched.lastName}
                </p>
              ) : null}
              {enriched.email && <p className="text-sm text-gray-700">Email: {enriched.email}</p>}
              {enriched.title && <p className="text-sm text-gray-700">Title: {enriched.title}</p>}
              {enriched.companyName && <p className="text-sm text-gray-700">Company: {enriched.companyName}</p>}
              {enriched.phone && <p className="text-sm text-gray-700">Phone: {enriched.phone}</p>}
            </div>

            {/* Raw Apollo JSON */}
            {rawApolloResponse && (
              <div className="mt-4">
                <button
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="text-xs text-gray-600 hover:text-gray-800 flex items-center gap-1"
                >
                  {showRawJson ? '▼ Hide' : '▶ Show'} Full Apollo JSON
                </button>
                {showRawJson && (
                  <pre className="mt-2 text-xs bg-gray-900 text-green-300 p-4 rounded max-h-[400px] overflow-y-auto">
                    {JSON.stringify(rawApolloResponse, null, 2)}
                  </pre>
                )}
              </div>
            )}

            <button
              onClick={() => {
                setEnriched(null);
                setPreview(null);
                setRawApolloResponse(null);
                setShowRawJson(false);
                setRedisKey(null);
                setUrl('');
              }}
              className="mt-4 bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm"
            >
              Clear & Search Again
            </button>

            {/* What do you want to do now? Action Menu */}
            {enriched && redisKey && (
              <div className="mt-6 rounded-xl border-2 border-blue-200 bg-blue-50 p-6">
                <h3 className="mb-4 text-lg font-bold text-gray-900">
                  What do you want to do now?
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Build Persona */}
                  <button
                    onClick={async () => {
                      try {
                        // Navigate to persona builder with redisKey
                        router.push(`/personas/builder?enrichedKey=${encodeURIComponent(redisKey)}`);
                      } catch (err) {
                        alert('Failed to navigate to persona builder');
                      }
                    }}
                    className="flex items-center gap-3 rounded-lg border border-purple-200 bg-white p-4 shadow-sm transition hover:shadow-md hover:border-purple-300 text-left"
                  >
                    <div className="rounded-lg bg-purple-100 p-2">
                      <UserCircle className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">Build Persona</div>
                      <div className="text-xs text-gray-600">Generate persona from this profile</div>
                    </div>
                  </button>

                  {/* Target this Person */}
                  <button
                    onClick={() => {
                      // Navigate to outreach with contact context
                      if (enriched.email) {
                        router.push(`/outreach?email=${encodeURIComponent(enriched.email)}`);
                      } else {
                        router.push('/outreach');
                      }
                    }}
                    className="flex items-center gap-3 rounded-lg border border-blue-200 bg-white p-4 shadow-sm transition hover:shadow-md hover:border-blue-300 text-left"
                  >
                    <div className="rounded-lg bg-blue-100 p-2">
                      <Target className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">Target this Person</div>
                      <div className="text-xs text-gray-600">Start outreach campaign</div>
                    </div>
                  </button>

                  {/* Save to CRM */}
                  <button
                    onClick={async () => {
                      try {
                        // Create contact in CRM from enriched data
                        const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId');
                        if (!companyHQId) {
                          alert('Company context required');
                          return;
                        }
                        
                        const response = await api.post('/api/contacts', {
                          firstName: enriched.firstName,
                          lastName: enriched.lastName,
                          email: enriched.email,
                          phone: enriched.phone,
                          title: enriched.title,
                          linkedinUrl: url,
                          companyHQId,
                          // Add more fields as needed
                        });
                        
                        if (response.data?.contact) {
                          alert('Contact saved to CRM!');
                          router.push(`/contacts/${response.data.contact.id}`);
                        }
                      } catch (err) {
                        console.error('Error saving contact:', err);
                        alert('Failed to save contact. Please try again.');
                      }
                    }}
                    className="flex items-center gap-3 rounded-lg border border-green-200 bg-white p-4 shadow-sm transition hover:shadow-md hover:border-green-300 text-left"
                  >
                    <div className="rounded-lg bg-green-100 p-2">
                      <Plus className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">Save to CRM</div>
                      <div className="text-xs text-gray-600">Add to your contacts</div>
                    </div>
                  </button>

                  {/* View Company (if available) */}
                  {enriched.companyName && (
                    <button
                      onClick={() => {
                        router.push(`/contacts/companies?search=${encodeURIComponent(enriched.companyName)}`);
                      }}
                      className="flex items-center gap-3 rounded-lg border border-orange-200 bg-white p-4 shadow-sm transition hover:shadow-md hover:border-orange-300 text-left"
                    >
                      <div className="rounded-lg bg-orange-100 p-2">
                        <Building2 className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">View Company</div>
                        <div className="text-xs text-gray-600">See company details</div>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

