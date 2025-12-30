'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import CompanyKeyMissingError from '@/components/CompanyKeyMissingError';
import { Search, RefreshCw, Linkedin, X, Save, CheckCircle, User, ArrowRight, Mail, Sparkles } from 'lucide-react';
import IntelligencePreview from '@/components/enrichment/IntelligencePreview';

function LinkedInEnrichContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams?.get('returnTo');
  const companyHQId = searchParams?.get('companyHQId') || '';
  const hasRedirectedRef = useRef(false);
  const urlCheckDoneRef = useRef(false);
  
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [enrichmentData, setEnrichmentData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [enrichingFullProfile, setEnrichingFullProfile] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedContactId, setSavedContactId] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [missingCompanyKey, setMissingCompanyKey] = useState(false);

  // Log CompanyHQ from URL params
  useEffect(() => {
    if (companyHQId) {
      console.log('🏢 LinkedIn Enrich: CompanyHQ from URL params:', {
        companyHQId,
        timestamp: new Date().toISOString(),
      });
    }
  }, [companyHQId]);

  // Debug: Track enrichmentData changes
  useEffect(() => {
    if (enrichmentData) {
      console.log('🔄 enrichmentData state updated:', {
        hasData: !!enrichmentData,
        hasNormalizedContact: !!enrichmentData.normalizedContact,
        normalizedContactKeys: enrichmentData.normalizedContact ? Object.keys(enrichmentData.normalizedContact) : [],
        firstName: enrichmentData.normalizedContact?.firstName,
        lastName: enrichmentData.normalizedContact?.lastName,
        email: enrichmentData.normalizedContact?.email,
        fullData: enrichmentData,
      });
    }
  }, [enrichmentData]);

  // Option B: URL params primary, localStorage fallback
  // If missing from URL, check localStorage and add to URL
  // If neither exists, show error instead of redirecting
  useEffect(() => {
    if (hasRedirectedRef.current) return;
    
    const checkAndSetError = () => {
      if (typeof window === 'undefined') return;
      
      // Check if URL actually has companyHQId
      const currentUrl = window.location.href;
      const urlHasCompanyHQId = currentUrl.includes('companyHQId=');
      
      // If URL has companyHQId or searchParams has it, we're good
      if (urlHasCompanyHQId || companyHQId) {
        setMissingCompanyKey(false);
        return; // No error needed
      }
      
      // URL doesn't have companyHQId - check localStorage (Option B fallback)
      const stored = localStorage.getItem('companyHQId');
      if (stored) {
        // Add companyHQId to URL from localStorage
        hasRedirectedRef.current = true;
        console.log(`🔄 LinkedIn Enrich: Adding companyHQId from localStorage to URL: ${stored}`);
        router.replace(`/contacts/enrich/linkedin?companyHQId=${stored}`);
        return;
      }
      
      // Neither URL nor localStorage has companyHQId - show error
      hasRedirectedRef.current = true;
      console.warn('⚠️ LinkedIn Enrich: No companyHQId in URL or localStorage');
      setMissingCompanyKey(true);
    };
    
    // Small delay to let searchParams load
    const timeoutId = setTimeout(checkAndSetError, 100);
    return () => clearTimeout(timeoutId);
  }, [companyHQId, router]);

  // Apollo enrich call
  async function handleEnrich() {
    if (!url) {
      alert('Please enter a LinkedIn URL');
      return;
    }

    setLoading(true);
    setEnrichmentData(null);

    try {
      // Direct Apollo enrich call
      const response = await api.post('/api/enrich/enrich', {
        linkedinUrl: url,
      });

      console.log('📥 API Response:', response.data);

      if (response.data?.success) {
        // API returns: enrichedProfile (NormalizedContactData), rawApolloResponse, redisKey
        const enrichedProfile = response.data.enrichedProfile || {};
        const rawApolloResponse = response.data.rawApolloResponse;
        
        console.log('✅ Apollo enrichment successful:', {
          enrichedProfile,
          hasRawResponse: !!rawApolloResponse,
          firstName: enrichedProfile.firstName,
          lastName: enrichedProfile.lastName,
          email: enrichedProfile.email,
          title: enrichedProfile.title,
          companyName: enrichedProfile.companyName,
        });

        // Set enrichment data - enrichedProfile IS the normalized contact data
        const enrichmentDataToSet = {
          rawEnrichmentPayload: rawApolloResponse,
          normalizedContact: enrichedProfile, // enrichedProfile contains firstName, lastName, email, etc.
          normalizedCompany: {
            companyName: enrichedProfile.companyName,
            companyDomain: enrichedProfile.companyDomain,
          },
        };
        
        console.log('📦 Setting enrichment data:', enrichmentDataToSet);
        setEnrichmentData(enrichmentDataToSet);
        console.log('✅ Enrichment data state updated');
      } else {
        alert(response.data?.error || 'Enrichment failed');
      }
    } catch (err) {
      console.error('❌ Enrichment error:', err);
      console.error('❌ Error response:', err.response?.data);
      alert(err.response?.data?.error || err.message || 'Enrichment failed');
    } finally {
      setLoading(false);
    }
  }

  // Save path
  async function handleSave() {
    if (!enrichmentData) {
      alert('Please enrich the contact first');
      return;
    }

    if (!companyHQId) {
      alert('Company context required. Please refresh the page with a companyHQId parameter.');
      return;
    }

    setSaving(true);

    try {
      console.log('💾 Saving contact to CompanyHQ:', {
        companyHQId,
        contactEmail: enrichmentData.normalizedContact?.email,
        timestamp: new Date().toISOString(),
      });

      // Step 1: Create contact
      const contactData = {
        firstName: enrichmentData.normalizedContact?.firstName || null,
        lastName: enrichmentData.normalizedContact?.lastName || null,
        email: enrichmentData.normalizedContact?.email || null,
        phone: enrichmentData.normalizedContact?.phone || null,
        title: enrichmentData.normalizedContact?.title || null,
      };

      console.log('📤 Creating contact with data:', { crmId: companyHQId, ...contactData });

      const contactResponse = await api.post('/api/contacts', {
        crmId: companyHQId,
        ...contactData,
      });

      if (!contactResponse.data?.contact) {
        console.error('❌ Contact creation failed - no contact in response:', contactResponse.data);
        throw new Error('Failed to create contact');
      }

      const contactId = contactResponse.data.contact.id;
      const createdContact = contactResponse.data.contact;
      console.log('✅ Contact created:', {
        contactId,
        email: createdContact.email,
        crmId: createdContact.crmId,
        companyHQId,
        matches: createdContact.crmId === companyHQId,
      });

      // Step 2: Save enrichment - Fork: Basic contact OR Full intelligence
      console.log('📤 Saving enrichment for contact:', { contactId, companyHQId });
      const hasIntelligence = !!(enrichmentData.intelligenceScores && enrichmentData.companyIntelligence);
      
      const saveResponse = await api.post('/api/contacts/enrich/save', {
        contactId,
        rawEnrichmentPayload: enrichmentData.rawEnrichmentPayload,
        companyHQId,
        skipIntelligence: !hasIntelligence, // Skip intelligence if not available
        // Send intelligence data directly if available (enriched fork)
        ...(hasIntelligence ? {
          profileSummary: enrichmentData.profileSummary,
          tenureYears: enrichmentData.tenureYears,
          currentTenureYears: enrichmentData.currentTenureYears,
          totalExperienceYears: enrichmentData.totalExperienceYears,
          avgTenureYears: enrichmentData.avgTenureYears,
          careerTimeline: enrichmentData.careerTimeline,
          companyPositioning: enrichmentData.companyPositioning,
        } : {}),
      });

      console.log('✅ Enrichment saved:', {
        success: saveResponse.data?.success,
        contactId: saveResponse.data?.contact?.id,
        contactCrmId: saveResponse.data?.contact?.crmId,
        companyHQId,
        hasIntelligence,
        savedWithIntelligence: hasIntelligence && !saveResponse.data?.contact?.seniorityScore === undefined,
      });

      // Set appropriate success message based on fork
      setSaving(false);
      if (hasIntelligence) {
        setSuccessMessage('Contact Enriched Successfully!');
      } else {
        setSuccessMessage('Contact Saved Successfully!');
      }
      setShowSuccessModal(true);
      setSavedContactId(contactId);
    } catch (err) {
      console.error('❌ Save error:', err);
      alert(err.response?.data?.error || err.message || 'Failed to save contact');
      setSaving(false);
    }
  }

  // Enrich Full Profile - generates intelligence and displays inline (no navigation)
  async function handleEnrichFullProfile() {
    if (!url) {
      alert('Please enter a LinkedIn URL first');
      return;
    }

    if (!companyHQId) {
      alert('Company context required. Please refresh the page with a companyHQId parameter.');
      return;
    }

    setEnrichingFullProfile(true);

    try {
      console.log('🧠 Generating full intelligence profile for:', url);

      // Call generate-intel API - returns all data in response (no Redis needed)
      const intelResponse = await api.post('/api/contacts/enrich/generate-intel', {
        linkedinUrl: url,
      });

      if (!intelResponse.data?.success) {
        throw new Error(intelResponse.data?.error || 'Failed to generate intelligence');
      }

      console.log('✅ Intelligence generated, storing in state');

      // Store all intelligence data in component state (stays on same page)
      setEnrichmentData({
        rawEnrichmentPayload: intelResponse.data.rawEnrichmentPayload,
        normalizedContact: intelResponse.data.normalizedContact,
        normalizedCompany: intelResponse.data.normalizedCompany,
        intelligenceScores: intelResponse.data.intelligenceScores,
        companyIntelligence: intelResponse.data.companyIntelligence,
        profileSummary: intelResponse.data.profileSummary,
        tenureYears: intelResponse.data.tenureYears,
        currentTenureYears: intelResponse.data.currentTenureYears,
        totalExperienceYears: intelResponse.data.totalExperienceYears,
        avgTenureYears: intelResponse.data.avgTenureYears,
        careerTimeline: intelResponse.data.careerTimeline,
        companyPositioning: intelResponse.data.companyPositioning,
      });
    } catch (err) {
      console.error('❌ Full profile enrichment error:', err);
      alert(err.response?.data?.error || err.message || 'Failed to generate full profile');
    } finally {
      setEnrichingFullProfile(false);
    }
  }

  // Show error if company key is missing
  if (missingCompanyKey) {
    return <CompanyKeyMissingError />;
  }

  return (
    <div className="py-10">
      <div className="mx-auto max-w-4xl px-6">
        <h1 className="text-3xl font-bold mb-6">🔍 LinkedIn Enrich</h1>

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
                handleEnrich();
              }
            }}
            disabled={loading || saving || enrichingFullProfile}
          />
          <button
            onClick={handleEnrich}
            disabled={loading || !url || saving || enrichingFullProfile}
            className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <RefreshCw className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
            Enrich
          </button>
        </div>

        {/* Debug: Show enrichment data state */}
        {process.env.NODE_ENV === 'development' && enrichmentData && (
          <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
            <strong>Debug:</strong> enrichmentData exists: {JSON.stringify({
              hasNormalizedContact: !!enrichmentData.normalizedContact,
              normalizedContactKeys: enrichmentData.normalizedContact ? Object.keys(enrichmentData.normalizedContact) : [],
            })}
          </div>
        )}

        {/* Enrichment Results */}
        {enrichmentData && enrichmentData.normalizedContact && Object.keys(enrichmentData.normalizedContact).length > 0 && (
          <div className="bg-white p-5 rounded-lg shadow border mb-6">
            <div className="flex justify-between mb-4">
              <h2 className="font-semibold text-lg">Enrichment Results</h2>
              <button onClick={() => {
                setEnrichmentData(null);
                setUrl('');
              }}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-2">
              {/* Name - show fullName, or firstName + lastName, or email as fallback */}
              {(enrichmentData.normalizedContact.fullName || 
                enrichmentData.normalizedContact.firstName || 
                enrichmentData.normalizedContact.lastName ||
                enrichmentData.normalizedContact.email) && (
                <p className="font-semibold text-gray-900 text-lg">
                  {enrichmentData.normalizedContact.fullName || 
                   `${enrichmentData.normalizedContact.firstName || ''} ${enrichmentData.normalizedContact.lastName || ''}`.trim() ||
                   enrichmentData.normalizedContact.email ||
                   'Contact'}
                </p>
              )}

              {enrichmentData.normalizedContact.title && (
                <p className="text-gray-700 text-sm">
                  <span className="font-medium">Title:</span> {enrichmentData.normalizedContact.title}
                </p>
              )}
              
              {enrichmentData.normalizedContact.email && (
                <p className="text-gray-700 text-sm">
                  <span className="font-medium">Email:</span> {enrichmentData.normalizedContact.email}
                </p>
              )}

              {enrichmentData.normalizedContact.phone && (
                <p className="text-gray-700 text-sm">
                  <span className="font-medium">Phone:</span> {enrichmentData.normalizedContact.phone}
                </p>
              )}

              {enrichmentData.normalizedCompany?.companyName && (
                <p className="text-gray-700 text-sm">
                  <span className="font-medium">Company:</span> {enrichmentData.normalizedCompany.companyName}
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

            {/* Action Buttons - Fork: Save basic OR Enrich full */}
            {!enrichmentData.intelligenceScores && (
              <div className="mt-6 border-t pt-6 space-y-3">
                {/* Save Contact Button - Saves basic contact details only */}
                <button
                  onClick={handleSave}
                  disabled={saving || enrichingFullProfile}
                  className="w-full bg-green-600 text-white px-6 py-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold hover:bg-green-700 transition shadow-md"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="animate-spin h-5 w-5" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5" />
                      <span>Save Contact</span>
                    </>
                  )}
                </button>

                {/* Enrich Full Profile Button - Generates intelligence */}
                <button
                  onClick={handleEnrichFullProfile}
                  disabled={saving || enrichingFullProfile}
                  className="w-full bg-purple-600 text-white px-6 py-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold hover:bg-purple-700 transition shadow-md"
                >
                  {enrichingFullProfile ? (
                    <>
                      <RefreshCw className="animate-spin h-5 w-5" />
                      <span>Generating Intelligence...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      <span>Enrich Full Profile</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Intelligence Preview - Show when intelligence data is available */}
        {enrichmentData && enrichmentData.intelligenceScores && enrichmentData.companyIntelligence && (
          <div className="space-y-6 mb-6">
            <IntelligencePreview
              normalizedContact={enrichmentData.normalizedContact}
              normalizedCompany={enrichmentData.normalizedCompany}
              intelligenceScores={enrichmentData.intelligenceScores}
              companyIntelligence={enrichmentData.companyIntelligence}
              linkedinUrl={url}
              profileSummary={enrichmentData.profileSummary}
              tenureYears={enrichmentData.tenureYears}
              currentTenureYears={enrichmentData.currentTenureYears}
              totalExperienceYears={enrichmentData.totalExperienceYears}
              avgTenureYears={enrichmentData.avgTenureYears}
              careerTimeline={enrichmentData.careerTimeline}
              companyPositioning={enrichmentData.companyPositioning}
            />

          </div>
        )}

        {/* Save Button - Show at bottom after all intelligence data */}
        {enrichmentData && enrichmentData.intelligenceScores && enrichmentData.companyIntelligence && (
          <div className="flex justify-end gap-3 bg-white rounded-lg p-4 shadow">
            <button
              onClick={() => {
                setEnrichmentData(null);
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
        )}

        {/* Success Modal */}
        {showSuccessModal && savedContactId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-xl">
              <div className="p-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="rounded-full p-3 bg-green-100">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
                  {successMessage || 'Contact Saved Successfully!'}
                </h2>
                <p className="text-gray-600 text-center mb-6">
                  {successMessage.includes('Enriched') 
                    ? 'All intelligence scores, profile analysis, and company data have been saved. What would you like to do next?'
                    : 'Contact has been saved to your CRM. You can enrich it later to get intelligence scores and profile analysis.'}
                </p>
                
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setShowSuccessModal(false);
                      router.push(`/outreach/compose?contactId=${savedContactId}&companyHQId=${companyHQId}`);
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
                      router.push(`/contacts/${savedContactId}?companyHQId=${companyHQId}`);
                    }}
                    className="w-full flex items-center justify-between rounded-lg border-2 border-blue-600 bg-blue-50 px-6 py-4 text-left transition hover:bg-blue-100"
                  >
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-blue-600" />
                      <div>
                        <div className="font-semibold text-gray-900">View Contact</div>
                        <div className="text-sm text-gray-600">See contact details</div>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-blue-600" />
                  </button>

                  <button
                    onClick={() => {
                      setShowSuccessModal(false);
                      setEnrichmentData(null);
                      setUrl('');
                      setSavedContactId(null);
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
