'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import CompanyKeyMissingError from '@/components/CompanyKeyMissingError';
import { Search, RefreshCw, Linkedin, X, Save, CheckCircle, User, ArrowRight } from 'lucide-react';

function GetContactFromLinkedInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  const hasRedirectedRef = useRef(false);
  
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [enrichmentData, setEnrichmentData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [missingCompanyKey, setMissingCompanyKey] = useState(false);

  // Check for companyHQId
  useEffect(() => {
    if (hasRedirectedRef.current) return;
    
    const checkAndSetError = () => {
      if (typeof window === 'undefined') return;
      
      const currentUrl = window.location.href;
      const urlHasCompanyHQId = currentUrl.includes('companyHQId=');
      
      if (urlHasCompanyHQId || companyHQId) {
        setMissingCompanyKey(false);
        return;
      }
      
      const stored = localStorage.getItem('companyHQId');
      if (stored) {
        hasRedirectedRef.current = true;
        router.replace(`/contacts/linkedin?companyHQId=${stored}`);
        return;
      }
      
      hasRedirectedRef.current = true;
      setMissingCompanyKey(true);
    };
    
    const timeoutId = setTimeout(checkAndSetError, 100);
    return () => clearTimeout(timeoutId);
  }, [companyHQId, router]);

  // Get contact info from LinkedIn
  async function handleGetContact() {
    if (!url) {
      alert('Please enter a LinkedIn URL');
      return;
    }

    setLoading(true);
    setEnrichmentData(null);

    try {
      const response = await api.post('/api/enrich/enrich', {
        linkedinUrl: url,
      });

      if (response.data?.success) {
        const enrichedProfile = response.data.enrichedProfile || {};
        const rawApolloResponse = response.data.rawApolloResponse;
        
        console.log('✅ Contact info retrieved:', {
          firstName: enrichedProfile.firstName,
          lastName: enrichedProfile.lastName,
          email: enrichedProfile.email,
          title: enrichedProfile.title,
          companyName: enrichedProfile.companyName,
        });
        
        if (!enrichedProfile.email) {
          alert('⚠️ Warning: Apollo did not return an email address for this LinkedIn profile. You can still save the contact, but email is required for outreach.');
        }

        setEnrichmentData({
          rawEnrichmentPayload: rawApolloResponse,
          normalizedContact: enrichedProfile,
        });
      } else {
        alert(response.data?.error || 'Failed to get contact info');
      }
    } catch (err) {
      console.error('❌ Error getting contact info:', err);
      alert(err.response?.data?.error || err.message || 'Failed to get contact info');
    } finally {
      setLoading(false);
    }
  }

  // Save contact
  async function handleSave() {
    if (!enrichmentData) {
      alert('Please get contact info first');
      return;
    }

    if (!companyHQId) {
      alert('Company context required. Please refresh the page with a companyHQId parameter.');
      return;
    }

    if (!enrichmentData.normalizedContact?.email) {
      alert('Email is required to save this contact. Apollo did not return an email address for this LinkedIn profile.');
      return;
    }

    setSaving(true);

    try {
      const saveResponse = await api.post('/api/contacts/linkedin/save', {
        crmId: companyHQId,
        firstName: enrichmentData.normalizedContact?.firstName || null,
        lastName: enrichmentData.normalizedContact?.lastName || null,
        email: enrichmentData.normalizedContact?.email || null,
        phone: enrichmentData.normalizedContact?.phone || null,
        title: enrichmentData.normalizedContact?.title || null,
        linkedinUrl: url,
        enrichedProfile: enrichmentData.normalizedContact,
        rawApolloResponse: enrichmentData.rawEnrichmentPayload,
      });

      if (saveResponse.data?.success && saveResponse.data?.contact) {
        const contactId = saveResponse.data.contact.id;
        // Redirect to contact detail page
        router.push(`/contacts/${contactId}?companyHQId=${companyHQId}`);
      } else {
        throw new Error('Failed to save contact');
      }
    } catch (err) {
      console.error('❌ Save error:', err);
      alert(err.response?.data?.error || err.message || 'Failed to save contact');
      setSaving(false);
    }
  }

  if (missingCompanyKey) {
    return <CompanyKeyMissingError />;
  }

  return (
    <div className="py-10">
      <div className="mx-auto max-w-4xl px-6">
        <h1 className="text-3xl font-bold mb-6">Get Contact from LinkedIn</h1>

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
                handleGetContact();
              }
            }}
            disabled={loading || saving}
          />
          <button
            onClick={handleGetContact}
            disabled={loading || !url || saving}
            className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <RefreshCw className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
            Get Contact Info
          </button>
        </div>

        {/* Contact Info Preview */}
        {enrichmentData && enrichmentData.normalizedContact && (
          <div className="bg-white p-5 rounded-lg shadow border mb-6">
            <div className="flex justify-between mb-4">
              <h2 className="font-semibold text-lg">Contact Info</h2>
              <button onClick={() => {
                setEnrichmentData(null);
                setUrl('');
              }}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-2">
              {(enrichmentData.normalizedContact.fullName || 
                enrichmentData.normalizedContact.firstName || 
                enrichmentData.normalizedContact.lastName) && (
                <p className="font-semibold text-gray-900 text-lg">
                  {enrichmentData.normalizedContact.fullName || 
                   `${enrichmentData.normalizedContact.firstName || ''} ${enrichmentData.normalizedContact.lastName || ''}`.trim()}
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

              {enrichmentData.normalizedContact.companyName && (
                <p className="text-gray-700 text-sm">
                  <span className="font-medium">Company:</span> {enrichmentData.normalizedContact.companyName}
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
      </div>
    </div>
  );
}

export default function GetContactFromLinkedIn() {
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
      <GetContactFromLinkedInContent />
    </Suspense>
  );
}

