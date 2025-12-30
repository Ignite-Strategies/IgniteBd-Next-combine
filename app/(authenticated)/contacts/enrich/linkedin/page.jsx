'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Search, RefreshCw, Linkedin, X, Save, CheckCircle, User, ArrowRight, Mail } from 'lucide-react';

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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedContactId, setSavedContactId] = useState(null);

  // Log CompanyHQ from URL params
  useEffect(() => {
    if (companyHQId) {
      console.log('🏢 LinkedIn Enrich: CompanyHQ from URL params:', {
        companyHQId,
        timestamp: new Date().toISOString(),
      });
    }
  }, [companyHQId]);

  // Redirect if no companyHQId in URL - URL param is the ONLY source of truth
  // NO localStorage fallback - if missing, go to welcome where it gets set
  // Add small delay to let searchParams load
  useEffect(() => {
    if (hasRedirectedRef.current) return;
    
    const checkAndRedirect = () => {
      if (typeof window === 'undefined') return;
      
      // Check if URL actually has companyHQId
      const currentUrl = window.location.href;
      const urlHasCompanyHQId = currentUrl.includes('companyHQId=');
      
      // If URL has companyHQId or searchParams has it, we're good
      if (urlHasCompanyHQId || companyHQId) {
        return; // No redirect needed
      }
      
      // URL truly doesn't have companyHQId - redirect to welcome
      hasRedirectedRef.current = true;
      console.warn('⚠️ LinkedIn Enrich: No companyHQId in URL - redirecting to welcome');
      router.push('/welcome');
    };
    
    // Small delay to let searchParams load
    const timeoutId = setTimeout(checkAndRedirect, 100);
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

      if (response.data?.success) {
        setEnrichmentData({
          rawEnrichmentPayload: response.data.rawApolloResponse || response.data.rawEnrichmentPayload,
          normalizedContact: response.data.enrichedData?.normalizedContact || response.data.normalizedContact,
          normalizedCompany: response.data.enrichedData?.normalizedCompany || response.data.normalizedCompany,
        });
        console.log('✅ Apollo enrichment successful');
      } else {
        alert(response.data?.error || 'Enrichment failed');
      }
    } catch (err) {
      console.error('❌ Enrichment error:', err);
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

      // Step 2: Save enrichment
      console.log('📤 Saving enrichment for contact:', { contactId, companyHQId });
      const saveResponse = await api.post('/api/contacts/enrich/save', {
        contactId,
        rawEnrichmentPayload: enrichmentData.rawEnrichmentPayload,
        companyHQId,
        skipIntelligence: true, // Skip intelligence for now
      });

      console.log('✅ Enrichment saved:', {
        success: saveResponse.data?.success,
        contactId: saveResponse.data?.contact?.id,
        contactCrmId: saveResponse.data?.contact?.crmId,
        companyHQId,
        matches: saveResponse.data?.contact?.crmId === companyHQId,
      });

      setSaving(false);
      setShowSuccessModal(true);
      setSavedContactId(contactId);
    } catch (err) {
      console.error('❌ Save error:', err);
      alert(err.response?.data?.error || err.message || 'Failed to save contact');
      setSaving(false);
    }
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
            disabled={loading || saving}
          />
          <button
            onClick={handleEnrich}
            disabled={loading || !url || saving}
            className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <RefreshCw className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
            Enrich
          </button>
        </div>

        {/* Enrichment Results */}
        {enrichmentData && enrichmentData.normalizedContact && (
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
              {enrichmentData.normalizedContact.firstName || enrichmentData.normalizedContact.lastName ? (
                <p className="font-semibold text-gray-900 text-lg">
                  {enrichmentData.normalizedContact.firstName} {enrichmentData.normalizedContact.lastName}
                </p>
              ) : null}

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

            {/* Save Button */}
            <div className="mt-6 border-t pt-6">
              <button
                onClick={handleSave}
                disabled={saving}
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
            </div>
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
                  Contact Saved Successfully!
                </h2>
                <p className="text-gray-600 text-center mb-6">
                  Contact has been saved to your CRM.
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
