'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Search, RefreshCw, Linkedin, X, Sparkles, Save, CheckCircle, User, ArrowRight, Mail } from 'lucide-react';
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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedContactId, setSavedContactId] = useState(null);
  const [savedWithoutIntelligence, setSavedWithoutIntelligence] = useState(false);

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
        // Store EVERYTHING including rawEnrichmentPayload so we can send it directly to save route
        setIntelligenceData({
          normalizedContact: response.data.normalizedContact,
          normalizedCompany: response.data.normalizedCompany,
          intelligenceScores: response.data.intelligenceScores,
          companyIntelligence: response.data.companyIntelligence,
          rawEnrichmentPayload: response.data.rawEnrichmentPayload, // Store raw payload!
          redisKey: response.data.redisKey,
          previewId: response.data.previewId,
          profileSummary: response.data.profileSummary,
          tenureYears: response.data.tenureYears,
          currentTenureYears: response.data.currentTenureYears,
          totalExperienceYears: response.data.totalExperienceYears,
          avgTenureYears: response.data.avgTenureYears,
          careerTimeline: response.data.careerTimeline,
          companyPositioning: response.data.companyPositioning,
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

  async function handleSave(skipIntelligence = false) {
    // If skipping intelligence, we need at least preview data
    if (!skipIntelligence && !intelligenceData) {
      alert('No intelligence data available');
      return;
    }

    if (skipIntelligence && !preview) {
      alert('Please preview the contact first');
      return;
    }

    setSaving(true);

    try {
      // CRITICAL: Only use companyHQId, never fallback to companyId (which might be wrong)
      const companyHQId = typeof window !== 'undefined' 
        ? localStorage.getItem('companyHQId')
        : null;
      
      if (!companyHQId) {
        alert('Company context required. Please set your company first. You may need to refresh or switch company context.');
        setSaving(false);
        return;
      }

      // Validate companyHQId is in user's memberships (prevent wrong context)
      const storedMemberships = typeof window !== 'undefined' 
        ? localStorage.getItem('memberships') 
        : null;
      if (storedMemberships) {
        try {
          const memberships = JSON.parse(storedMemberships);
          const hasAccess = memberships.some(m => m.companyHqId === companyHQId);
          if (!hasAccess) {
            alert(`⚠️ You don't have access to CompanyHQ ${companyHQId}. Please switch to a CompanyHQ you have membership in.`);
            setSaving(false);
            return;
          }
        } catch (error) {
          console.warn('Failed to validate membership, proceeding anyway:', error);
        }
      }

      // Step 1: Create contact in CRM
      const contactData = skipIntelligence ? {
        firstName: preview.firstName,
        lastName: preview.lastName,
        email: preview.email,
        phone: preview.phone,
        title: preview.title,
      } : {
        firstName: intelligenceData.normalizedContact.firstName,
        lastName: intelligenceData.normalizedContact.lastName,
        email: intelligenceData.normalizedContact.email,
        phone: intelligenceData.normalizedContact.phone,
        title: intelligenceData.normalizedContact.title,
      };

      const contactResponse = await api.post('/api/contacts', {
        crmId: companyHQId,
        ...contactData,
      });

      if (!contactResponse.data?.contact) {
        throw new Error('Failed to create contact');
      }

      const contactId = contactResponse.data.contact.id;

      // Step 2: Save enrichment data
      // Send ALL the data we already have in state - no Redis needed!
      if (skipIntelligence) {
        // If skipping intelligence, we still need to enrich to get raw payload
        const enrichResponse = await api.post('/api/enrich/enrich', {
          linkedinUrl: url,
        });
        
        const saveResponse = await api.post('/api/contacts/enrich/save', {
          contactId,
          rawEnrichmentPayload: enrichResponse.data?.rawApolloResponse || enrichResponse.data?.rawEnrichmentPayload, // Send raw payload directly
          companyHQId,
          skipIntelligence: true,
        });
        
        // Verify intelligence was NOT saved (should be empty object)
        const hasIntelligenceInResponse = saveResponse.data?.contact?.seniorityScore !== undefined ||
          saveResponse.data?.contact?.profileSummary !== undefined;
        
        // Step 3: Show success modal for basic save
        setSaving(false);
        setShowSuccessModal(true);
        setSavedContactId(contactId);
        setSavedWithoutIntelligence(!hasIntelligenceInResponse); // Should be true if no intelligence
        
        console.log('✅ Contact saved without intelligence:', {
          contactId,
          skipIntelligence: true,
          hasIntelligenceInResponse,
          savedWithoutIntelligence: !hasIntelligenceInResponse,
        });
        
        return; // Exit early
      } else {
        // We have everything in intelligenceData - send it all directly!
        const saveResponse = await api.post('/api/contacts/enrich/save', {
          contactId,
          rawEnrichmentPayload: intelligenceData.rawEnrichmentPayload, // Send raw payload directly (no Redis!)
          companyHQId,
          skipIntelligence: false,
          // Send all inference fields directly too
          profileSummary: intelligenceData.profileSummary,
          tenureYears: intelligenceData.tenureYears,
          currentTenureYears: intelligenceData.currentTenureYears,
          totalExperienceYears: intelligenceData.totalExperienceYears,
          avgTenureYears: intelligenceData.avgTenureYears,
          careerTimeline: intelligenceData.careerTimeline,
          companyPositioning: intelligenceData.companyPositioning,
        });
        
        // Check the response to confirm intelligence was saved
        const hasIntelligenceInResponse = saveResponse.data?.contact?.seniorityScore !== undefined ||
          saveResponse.data?.contact?.profileSummary !== undefined;
        
        // Step 3: Show success modal with next steps
        setSaving(false);
        setShowSuccessModal(true);
        setSavedContactId(contactId);
        // Use response data to determine if intelligence was actually saved
        setSavedWithoutIntelligence(!hasIntelligenceInResponse);
        
        console.log('✅ Contact saved with intelligence:', {
          contactId,
          hasIntelligenceInResponse,
          savedWithoutIntelligence: !hasIntelligenceInResponse,
          responseHasSeniorityScore: !!saveResponse.data?.contact?.seniorityScore,
          responseHasProfileSummary: !!saveResponse.data?.contact?.profileSummary,
        });
        
        return; // Exit early since we handled the enriched case
      }

      // Step 3: Show success modal for basic save (skipIntelligence = true)
      setSaving(false);
      setShowSuccessModal(true);
      setSavedContactId(contactId);
      setSavedWithoutIntelligence(true);
      
      console.log('✅ Contact saved without intelligence:', {
        contactId,
        skipIntelligence: true,
      });
    } catch (err) {
      console.error('Error saving contact:', err);
      // Handle network errors (Redis connection failures, etc.)
      const errorMessage = err?.message || err?.response?.data?.error || 'Failed to save contact';
      // If it's a network error (status 0) or Redis connection error, show a more helpful message
      if (err?.status === 0 || err?.type === 'NETWORK_ERROR' || errorMessage.includes('Redis') || errorMessage.includes('connection')) {
        alert(`Connection error: ${errorMessage}\n\nThis might be a Redis configuration issue. Please check your Redis settings or try again in a moment.`);
      } else {
        alert(errorMessage);
      }
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
    <div className="py-10">
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

            {/* Action Buttons - Fork */}
            <div className="mt-6 border-t pt-6">
              <p className="text-sm text-gray-600 mb-4 text-center">Choose an option:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Save Contact as Is - Primary Option */}
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving || generatingIntel}
                  className="bg-green-600 text-white px-6 py-4 rounded-lg flex flex-col items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold hover:bg-green-700 transition shadow-md"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="animate-spin h-5 w-5" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5" />
                      <span className="text-base">Save Contact as Is</span>
                      <span className="text-xs font-normal opacity-90">Name, email, title</span>
                    </>
                  )}
                </button>

                {/* Generate Intelligence - Secondary Option */}
                <button
                  onClick={handleGenerateIntelligence}
                  disabled={generatingIntel || saving}
                  className="bg-indigo-600 text-white px-6 py-4 rounded-lg flex flex-col items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold hover:bg-indigo-700 transition shadow-md"
                >
                  {generatingIntel ? (
                    <>
                      <RefreshCw className="animate-spin h-5 w-5" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      <span className="text-base">Generate Intelligence</span>
                      <span className="text-xs font-normal opacity-90">Full profile analysis</span>
                    </>
                  )}
                </button>
              </div>
            </div>
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
              profileSummary={intelligenceData.profileSummary}
              tenureYears={intelligenceData.tenureYears}
              currentTenureYears={intelligenceData.currentTenureYears}
              totalExperienceYears={intelligenceData.totalExperienceYears}
              avgTenureYears={intelligenceData.avgTenureYears}
              careerTimeline={intelligenceData.careerTimeline}
              companyPositioning={intelligenceData.companyPositioning}
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
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Saving Enriched Contact...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Save Enriched Contact
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

        {/* Success Modal - Different UX for enriched vs non-enriched */}
        {showSuccessModal && savedContactId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-xl">
              <div className="p-6">
                <div className="flex items-center justify-center mb-4">
                  <div className={`rounded-full p-3 ${savedWithoutIntelligence ? 'bg-yellow-100' : 'bg-green-100'}`}>
                    <CheckCircle className={`h-8 w-8 ${savedWithoutIntelligence ? 'text-yellow-600' : 'text-green-600'}`} />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
                  {savedWithoutIntelligence ? 'Contact Saved Successfully!' : 'Contact Enriched Successfully!'}
                </h2>
                <p className="text-gray-600 text-center mb-6">
                  {savedWithoutIntelligence 
                    ? 'Contact has been saved to your CRM. You can enrich it later to get intelligence scores and profile analysis.'
                    : 'All intelligence scores and profile data have been saved. What would you like to do next?'
                  }
                </p>
                
                <div className="space-y-3">
                  {savedWithoutIntelligence ? (
                    // Non-enriched save: Show "Send Email" (primary), "Enrich", "View Contact"
                    <>
                      <button
                        onClick={() => {
                          setShowSuccessModal(false);
                          router.push(`/outreach/compose?contactId=${savedContactId}`);
                        }}
                        className="w-full flex items-center justify-between rounded-lg border-2 border-red-600 bg-red-50 px-6 py-4 text-left transition hover:bg-red-100"
                      >
                        <div className="flex items-center gap-3">
                          <Mail className="h-5 w-5 text-red-600" />
                          <div>
                            <div className="font-semibold text-gray-900">Send an Email to this Contact</div>
                            <div className="text-sm text-gray-600">Compose and send a personalized email</div>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-red-600" />
                      </button>

                      <button
                        onClick={() => {
                          setShowSuccessModal(false);
                          router.push(`/contacts/${savedContactId}`);
                          // Trigger enrichment from contact detail page
                        }}
                        className="w-full flex items-center justify-between rounded-lg border-2 border-indigo-600 bg-indigo-50 px-6 py-4 text-left transition hover:bg-indigo-100"
                      >
                        <div className="flex items-center gap-3">
                          <Sparkles className="h-5 w-5 text-indigo-600" />
                          <div>
                            <div className="font-semibold text-gray-900">Enrich Contact</div>
                            <div className="text-sm text-gray-600">Generate intelligence scores and profile analysis</div>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-indigo-600" />
                      </button>

                      <button
                        onClick={() => {
                          setShowSuccessModal(false);
                          router.push(`/contacts/${savedContactId}`);
                        }}
                        className="w-full flex items-center justify-between rounded-lg border border-gray-300 bg-white px-6 py-4 text-left transition hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <User className="h-5 w-5 text-gray-600" />
                          <div>
                            <div className="font-semibold text-gray-900">View Contact</div>
                            <div className="text-sm text-gray-600">See contact details</div>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-gray-600" />
                      </button>
                    </>
                  ) : (
                    // Enriched save: Show existing options (View Contact, Persona Flow, Enrich Another)
                    <>
                      <button
                        onClick={() => {
                          setShowSuccessModal(false);
                          router.push(`/contacts/${savedContactId}`);
                        }}
                        className="w-full flex items-center justify-between rounded-lg border-2 border-blue-600 bg-blue-50 px-6 py-4 text-left transition hover:bg-blue-100"
                      >
                        <div className="flex items-center gap-3">
                          <User className="h-5 w-5 text-blue-600" />
                          <div>
                            <div className="font-semibold text-gray-900">View Contact</div>
                            <div className="text-sm text-gray-600">See full contact details and intelligence</div>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-blue-600" />
                      </button>

                      <button
                        onClick={() => {
                          setShowSuccessModal(false);
                          router.push(`/personas/from-contact?contactId=${savedContactId}`);
                        }}
                        className="w-full flex items-center justify-between rounded-lg border-2 border-purple-600 bg-purple-50 px-6 py-4 text-left transition hover:bg-purple-100"
                      >
                        <div className="flex items-center gap-3">
                          <Sparkles className="h-5 w-5 text-purple-600" />
                          <div>
                            <div className="font-semibold text-gray-900">Start Persona Flow</div>
                            <div className="text-sm text-gray-600">Create a persona from this enriched contact</div>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-purple-600" />
                      </button>

                      <button
                        onClick={() => {
                          setShowSuccessModal(false);
                          router.push(`/outreach/compose?contactId=${savedContactId}`);
                        }}
                        className="w-full flex items-center justify-between rounded-lg border-2 border-red-600 bg-red-50 px-6 py-4 text-left transition hover:bg-red-100"
                      >
                        <div className="flex items-center gap-3">
                          <Mail className="h-5 w-5 text-red-600" />
                          <div>
                            <div className="font-semibold text-gray-900">Send an Email</div>
                            <div className="text-sm text-gray-600">Compose and send a personalized email</div>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-red-600" />
                      </button>

                      <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    setPreview(null);
                    setIntelligenceData(null);
                    setUrl('');
                    setSavedContactId(null);
                    setSavedWithoutIntelligence(false);
                  }}
                        className="w-full flex items-center justify-between rounded-lg border border-gray-300 bg-white px-6 py-4 text-left transition hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <Search className="h-5 w-5 text-gray-600" />
                          <div>
                            <div className="font-semibold text-gray-900">Enrich Another Contact</div>
                            <div className="text-sm text-gray-600">Start a new enrichment</div>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-gray-600" />
                      </button>
                    </>
                  )}
                </div>
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
