'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Send, Mail, Loader2, CheckCircle2, Plus, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import ContactSelector from '@/components/ContactSelector.jsx';
import SenderIdentityPanel from '@/components/SenderIdentityPanel.jsx';
import api from '@/lib/api';
import { useOwner } from '@/hooks/useOwner';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';

function ComposeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ownerId } = useOwner();
  const { companyHQId } = useCompanyHQ();
  
  // Form state
  const [selectedContact, setSelectedContact] = useState(null);
  const [to, setTo] = useState('');
  const [toName, setToName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [contactId, setContactId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  
  // UI state
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  
  // Verified sender state - managed by SenderIdentityPanel, we just track it for validation
  const [hasVerifiedSender, setHasVerifiedSender] = useState(false);
  const [senderEmail, setSenderEmail] = useState(null);
  const [senderName, setSenderName] = useState(null);
  
  // Quick contact creation modal
  const [showQuickContactModal, setShowQuickContactModal] = useState(false);
  const [quickContactData, setQuickContactData] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });
  const [savingQuickContact, setSavingQuickContact] = useState(false);
  const [quickContactError, setQuickContactError] = useState(null);
  
  // Handle auth state changes - reset form if ownerId changes
  useEffect(() => {
    if (!ownerId) {
      // Auth state changed - user logged out or not authenticated
      setHasVerifiedSender(false);
      setSenderEmail(null);
      setSenderName(null);
      setError(null);
      setSuccess(false);
      // Don't clear form fields - let user keep their work
    }
  }, [ownerId]);

  // Load templates when ownerId is available
  useEffect(() => {
    if (!ownerId) return;

    const loadTemplates = async () => {
      try {
        setLoadingTemplates(true);
        const response = await api.get(`/api/templates?ownerId=${ownerId}`);
        if (response.data?.success) {
          setTemplates(response.data.templates || []);
        }
      } catch (err) {
        console.error('Failed to load templates:', err);
      } finally {
        setLoadingTemplates(false);
      }
    };

    loadTemplates();
  }, [ownerId]);

  // Load sender email (needed for build-payload)
  useEffect(() => {
    if (!ownerId) return;

    const loadSender = async () => {
      try {
        const response = await api.get('/api/outreach/verified-senders');
        if (response.data?.success) {
          setSenderEmail(response.data.verifiedEmail);
          setSenderName(response.data.verifiedName);
        }
      } catch (err) {
        console.error('Failed to load sender:', err);
      }
    };

    loadSender();
  }, [ownerId]);

  // Handle contactId from URL params (when navigating from success modal)
  useEffect(() => {
    const urlContactId = searchParams?.get('contactId');
    if (urlContactId && urlContactId !== contactId && ownerId) {
      // Fetch contact and select it
      const fetchAndSelectContact = async () => {
        try {
          const response = await api.get(`/api/contacts/${urlContactId}`);
          if (response.data?.success && response.data?.contact) {
            const contact = response.data.contact;
            handleContactSelect(contact, null);
          }
        } catch (err) {
          console.error('Failed to load contact from URL:', err);
        }
      };
      fetchAndSelectContact();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, ownerId]);
  
  // Quick contact creation
  const handleQuickSaveContact = async () => {
    if (!quickContactData.firstName || !quickContactData.lastName || !quickContactData.email) {
      setQuickContactError('Please fill in all fields');
      return;
    }
    
    if (!companyHQId) {
      setQuickContactError('Company context is required');
      return;
    }
    
    setSavingQuickContact(true);
    setQuickContactError(null);
    
    try {
      const response = await api.post('/api/contacts/create', {
        firstName: quickContactData.firstName,
        lastName: quickContactData.lastName,
        email: quickContactData.email,
        companyHQId,
      });
      
      if (response.data?.success) {
        const contact = response.data.contact;
        handleContactSelect(contact, null);
        setShowQuickContactModal(false);
        setQuickContactData({ firstName: '', lastName: '', email: '' });
      } else {
        setQuickContactError(response.data?.error || 'Failed to save contact');
      }
    } catch (err) {
      console.error('Failed to save contact:', err);
      setQuickContactError(err.response?.data?.error || 'Failed to save contact');
    } finally {
      setSavingQuickContact(false);
    }
  };
  
  // Handle contact selection
  const handleContactSelect = (contact, company) => {
    setSelectedContact(contact);
    setContactId(contact.id);
    setTo(contact.email || '');
    setToName(contact.goesBy || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || '');
    
    if (contact.crmId) {
      setTenantId(contact.crmId);
    } else if (companyHQId) {
      setTenantId(companyHQId);
    }
  };

  // Handle template selection - populate subject and body if template selected
  useEffect(() => {
    if (!selectedTemplateId || !templates.length) return;

    const template = templates.find(t => t.id === selectedTemplateId);
    if (template) {
      // Only populate if fields are empty (don't overwrite user edits)
      if (!subject) {
        setSubject(template.subject || '');
      }
      if (!body) {
        setBody(template.body || '');
      }
    }
  }, [selectedTemplateId, templates]);

  const handleBuildAndPreview = async (e) => {
    e.preventDefault();
    
    // If template is selected, validate that we have required fields
    // Otherwise, validate manual input
    if (!selectedTemplateId && (!to || !subject || !body)) {
      setError('Please fill in all required fields or select a template');
      return;
    }

    // If template is selected but no to/contact, still need recipient
    if (!to) {
      setError('Please specify a recipient (To field or select a contact)');
      return;
    }

    // Auth check - ensure user is authenticated
    if (!ownerId) {
      setError('Authentication required. Please sign in and try again.');
      return;
    }

    // Check for verified sender
    if (!hasVerifiedSender || !senderEmail) {
      setError('Please verify your sender email before sending. Click "Add" next to From field.');
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(false);

    try {
      // Step 1: Build payload and save to Redis
      // Template (if selected) will be hydrated in build-payload route
      const response = await api.post('/api/outreach/build-payload', {
        to,
        subject: subject || '', // May be empty if using template
        body: body || '', // May be empty if using template
        senderEmail,
        senderName: senderName || undefined,
        contactId: contactId || undefined,
        tenantId: tenantId || undefined,
        templateId: selectedTemplateId || undefined, // Optional: template becomes part of JSON payload
      });

      if (response.data?.success) {
        // Step 2: Navigate to preview page
        window.location.href = `/outreach/compose/preview?requestId=${response.data.requestId}`;
      } else {
        setError(response.data?.error || 'Failed to build payload');
        setSending(false);
      }
    } catch (err) {
      console.error('Build payload error:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to build payload';
      const statusCode = err.response?.status;
      
      // Handle auth errors separately
      if (statusCode === 401 || errorMessage.includes('Authentication failed') || errorMessage.includes('Unauthorized')) {
        setError('Your session has expired. Please sign in again and try sending.');
        setHasVerifiedSender(false);
        return;
      }
      
      setError(errorMessage);
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="1-to-1 Outreach"
          subtitle="Send personalized emails via SendGrid"
          backTo="/outreach"
          backLabel="Back to Outreach"
        />

        <div className="mt-8 rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Compose Email</h2>
            
            {success && (
              <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                <p className="text-sm font-medium text-green-900">✅ Email sent successfully!</p>
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm font-medium text-red-900">{error}</p>
              </div>
            )}

            <form onSubmit={handleBuildAndPreview} className="space-y-4">
              {/* Sender Identity - SenderIdentityPanel handles all sender logic */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  From
                </label>
                <SenderIdentityPanel 
                  onSenderChange={(hasSender) => {
                    // Callback to track if sender is verified
                    setHasVerifiedSender(hasSender);
                    // Reload sender email when sender changes
                    if (hasSender && ownerId) {
                      api.get('/api/outreach/verified-senders').then((response) => {
                        if (response.data?.success) {
                          setSenderEmail(response.data.verifiedEmail);
                          setSenderName(response.data.verifiedName);
                        }
                      }).catch(console.error);
                    }
                  }}
                />
              </div>
              
              {/* Contact Selector */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Select Contact
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowQuickContactModal(true)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="h-3 w-3" />
                    Quick Save
                  </button>
                </div>
                <ContactSelector
                  contactId={contactId}
                  onContactSelect={handleContactSelect}
                  selectedContact={selectedContact}
                  showLabel={false}
                />
              </div>

              {/* To (auto-filled from contact) */}
              <div>
                <label htmlFor="to" className="block text-sm font-medium text-gray-700 mb-1">
                  To <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="to"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              {/* To Name (auto-filled from contact) */}
              <div>
                <label htmlFor="toName" className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient Name (Optional)
                </label>
                <input
                  type="text"
                  id="toName"
                  value={toName}
                  onChange={(e) => setToName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              {/* Template Selector (Optional) */}
              <div>
                <label htmlFor="template" className="block text-sm font-medium text-gray-700 mb-1">
                  Template (Optional)
                </label>
                <select
                  id="template"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  <option value="">None - Write manually</option>
                  {loadingTemplates ? (
                    <option disabled>Loading templates...</option>
                  ) : templates.length === 0 ? (
                    <option disabled>No templates available</option>
                  ) : (
                    templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.title}
                      </option>
                    ))
                  )}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Select a template to auto-fill subject and body. Template variables will be hydrated with contact data.
                </p>
              </div>

              {/* Subject */}
              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required={!selectedTemplateId}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              {/* Body */}
              <div>
                <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-1">
                  Message <span className="text-red-500">*</span>
                </label>
                
                <textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required={!selectedTemplateId}
                  rows={10}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
                {selectedTemplateId && (
                  <p className="mt-1 text-xs text-gray-500">
                    Template selected. Variables like {`{{firstName}}`}, {`{{companyName}}`} will be replaced with contact data.
                  </p>
                )}
              </div>

              {/* Send Button */}
              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={sending || !ownerId}
                  className="inline-flex items-center gap-2 rounded-md bg-red-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Building...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Build & Preview
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Quick Contact Modal */}
      {showQuickContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="rounded-lg bg-white p-6 shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Quick Save Contact</h3>
              <button onClick={() => setShowQuickContactModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            {quickContactError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm font-medium text-red-900">{quickContactError}</p>
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); handleQuickSaveContact(); }} className="space-y-4">
              <div>
                <label htmlFor="quickFirstName" className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  type="text"
                  id="quickFirstName"
                  value={quickContactData.firstName}
                  onChange={(e) => setQuickContactData({ ...quickContactData, firstName: e.target.value })}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="quickLastName" className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  type="text"
                  id="quickLastName"
                  value={quickContactData.lastName}
                  onChange={(e) => setQuickContactData({ ...quickContactData, lastName: e.target.value })}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="quickEmail" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  id="quickEmail"
                  value={quickContactData.email}
                  onChange={(e) => setQuickContactData({ ...quickContactData, email: e.target.value })}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickContactModal(false);
                    setQuickContactError(null);
                    setQuickContactData({ firstName: '', lastName: '', email: '' });
                  }}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingQuickContact || !quickContactData.firstName || !quickContactData.lastName || !quickContactData.email}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingQuickContact ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Contact'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComposePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ComposeContent />
    </Suspense>
  );
}
