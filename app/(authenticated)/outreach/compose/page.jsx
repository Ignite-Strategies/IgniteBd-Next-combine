'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Send, Mail, Loader2, CheckCircle2, Clock, Eye, MousePointerClick, FileText, User, Sparkles, Settings, Megaphone } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import ContactSelector from '@/components/ContactSelector.jsx';
import api from '@/lib/api';
import { useOwner } from '@/hooks/useOwner';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';

// Component that uses useSearchParams - needs to be separate for Suspense
function ComposeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ownerId } = useOwner();
  const { companyHQId } = useCompanyHQ();
  
  // Form state
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [to, setTo] = useState('');
  const [toName, setToName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [contactId, setContactId] = useState('');
  const [tenantId, setTenantId] = useState('');
  
  // Template & hydration state
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [hydratedContent, setHydratedContent] = useState(null);
  
  // UI state
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('compose');
  
  // Verified sender state
  const [senderEmail, setSenderEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  const [loadingSender, setLoadingSender] = useState(true);
  const [showSenderSettings, setShowSenderSettings] = useState(false);
  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [newSenderName, setNewSenderName] = useState('');
  const [savingSender, setSavingSender] = useState(false);
  
  // Check for contactId in URL params
  useEffect(() => {
    const contactIdParam = searchParams?.get('contactId');
    if (contactIdParam) {
      setContactId(contactIdParam);
    }
  }, [searchParams]);

  // Load templates
  useEffect(() => {
    if (companyHQId) {
      loadTemplates();
    }
  }, [companyHQId]);
  
  // Load verified sender
  useEffect(() => {
    if (ownerId) {
      loadVerifiedSender();
    }
  }, [ownerId]);

  // Load verified sender from API
  const loadVerifiedSender = async () => {
    try {
      setLoadingSender(true);
      const response = await api.get('/api/outreach/verified-senders');
      if (response.data?.success) {
        setSenderEmail(response.data.email || response.data.verifiedEmail || '');
        setSenderName(response.data.name || response.data.verifiedName || '');
        setNewSenderEmail(response.data.email || response.data.verifiedEmail || '');
        setNewSenderName(response.data.name || response.data.verifiedName || '');
      }
    } catch (err) {
      console.error('Failed to load verified sender:', err);
      // Fallback to env vars
      setSenderEmail(process.env.NEXT_PUBLIC_SENDGRID_FROM_EMAIL || 'adam@ignitestrategies.co');
      setSenderName(process.env.NEXT_PUBLIC_SENDGRID_FROM_NAME || 'Adam - Ignite Strategies');
    } finally {
      setLoadingSender(false);
    }
  };

  // Save verified sender
  const handleSaveSender = async () => {
    if (!newSenderEmail) {
      setError('Email is required');
      return;
    }

    try {
      setSavingSender(true);
      const response = await api.put('/api/outreach/verified-senders', {
        email: newSenderEmail,
        name: newSenderName || undefined,
      });

      if (response.data?.success) {
        setSenderEmail(response.data.verifiedEmail);
        setSenderName(response.data.verifiedName || newSenderName);
        setShowSenderSettings(false);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to save verified sender:', err);
      setError(err.response?.data?.error || 'Failed to save verified sender');
    } finally {
      setSavingSender(false);
    }
  };
  
  // Handle contact selection
  const handleContactSelect = (contact, company) => {
    setSelectedContact(contact);
    setContactId(contact.id);
    setTo(contact.email || '');
    setToName(contact.goesBy || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || '');
    
    // If template is selected, auto-hydrate
    if (selectedTemplate) {
      hydrateTemplate(contact);
    }
  };
  
  // Load templates
  const loadTemplates = async () => {
    if (!companyHQId) return;
    
    try {
      setLoadingTemplates(true);
      const response = await api.get(`/api/template/saved?companyHQId=${companyHQId}`);
      if (response.data?.success && response.data.templates) {
        setTemplates(response.data.templates);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  };
  
  // Handle template selection
  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setSubject(template.template_bases?.title || '');
    setBody(template.content || '');
    
    // If contact is selected, auto-hydrate
    if (selectedContact) {
      hydrateTemplate(selectedContact, template);
    }
  };
  
  // Hydrate template with contact data
  const hydrateTemplate = async (contact, template = selectedTemplate) => {
    if (!template || !contact) return;
    
    try {
      setHydrating(true);
      const response = await api.post('/api/template/hydrate-with-contact', {
        templateId: template.id,
        contactId: contact.id,
      });
      
      if (response.data?.success && response.data.hydratedContent) {
        setHydratedContent(response.data.hydratedContent);
        setBody(response.data.hydratedContent);
        
        // Update subject if template has one
        if (template.template_bases?.title) {
          setSubject(template.template_bases.title);
        }
      }
    } catch (err) {
      console.error('Failed to hydrate template:', err);
      setError('Failed to hydrate template with contact data');
    } finally {
      setHydrating(false);
    }
  };


  const handleSend = async (e) => {
    e.preventDefault();
    
    if (!to || !subject || !body) {
      setError('Please fill in all required fields');
      return;
    }

    if (!ownerId) {
      setError('Owner ID not found. Please refresh the page.');
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await api.post('/api/outreach/send', {
        to,
        toName: toName || undefined,
        subject,
        body,
        contactId: contactId || undefined,
        tenantId: tenantId || undefined,
      });

      if (response.data.success) {
        setSuccess(true);
        // Clear form
        setTo('');
        setToName('');
        setSubject('');
        setBody('');
        setContactId('');
        setTenantId('');
        setSelectedContact(null);
        setSelectedTemplate(null);
        setHydratedContent(null);
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(response.data.error || 'Failed to send email');
      }
    } catch (err) {
      console.error('Send error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to send email');
    } finally {
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

        {/* Tabs */}
        <div className="mt-8 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('compose')}
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
                activeTab === 'compose'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              <Send className="inline h-4 w-4 mr-2" />
              Compose
            </button>
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
                activeTab === 'campaigns'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              <Megaphone className="inline h-4 w-4 mr-2" />
              Campaigns
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'compose' && (
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

              <form onSubmit={handleSend} className="space-y-4">
                {/* Sender with Settings */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      From
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowSenderSettings(!showSenderSettings)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                    >
                      <Settings className="h-3 w-3" />
                      {showSenderSettings ? 'Hide' : 'Change'}
                    </button>
                  </div>
                  
                  {showSenderSettings ? (
                    <div className="space-y-3 rounded-md border border-gray-300 bg-gray-50 p-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Verified Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          value={newSenderEmail}
                          onChange={(e) => setNewSenderEmail(e.target.value)}
                          placeholder="your-email@example.com"
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          This email must be verified in SendGrid
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Display Name (Optional)
                        </label>
                        <input
                          type="text"
                          value={newSenderName}
                          onChange={(e) => setNewSenderName(e.target.value)}
                          placeholder="Your Name"
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSaveSender}
                          disabled={savingSender || !newSenderEmail}
                          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {savingSender ? (
                            <>
                              <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                              Saving...
                            </>
                          ) : (
                            'Save'
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowSenderSettings(false);
                            setNewSenderEmail(senderEmail);
                            setNewSenderName(senderName);
                          }}
                          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {loadingSender ? (
                        <div className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-400">
                          <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                          Loading sender...
                        </div>
                      ) : (
                        <div className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                          {senderName ? `${senderName} <${senderEmail}>` : senderEmail}
                        </div>
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        Verified sender identity
                      </p>
                    </>
                  )}
                </div>

                {/* Contact Selector */}
                <div>
                  <ContactSelector
                    contactId={contactId}
                    onContactSelect={handleContactSelect}
                    selectedContact={selectedContact}
                    showLabel={true}
                  />
                </div>

                {/* Template Selector */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Select Template (Optional)
                  </label>
                  <div className="relative">
                    <select
                      value={selectedTemplate?.id || ''}
                      onChange={(e) => {
                        const template = templates.find(t => t.id === e.target.value);
                        if (template) {
                          handleTemplateSelect(template);
                        } else {
                          setSelectedTemplate(null);
                        }
                      }}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-200"
                      disabled={loadingTemplates}
                    >
                      <option value="">-- No template (compose manually) --</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.template_bases?.title || 'Untitled Template'}
                        </option>
                      ))}
                    </select>
                    {loadingTemplates && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      </div>
                    )}
                  </div>
                  {selectedTemplate && selectedContact && (
                    <button
                      type="button"
                      onClick={() => hydrateTemplate(selectedContact)}
                      disabled={hydrating}
                      className="mt-2 flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700"
                    >
                      {hydrating ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Hydrating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3" />
                          Re-hydrate with contact data
                        </>
                      )}
                    </button>
                  )}
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
                    placeholder="prospect@example.com"
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
                    placeholder="John Doe"
                  />
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
                    required
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    placeholder="Quick intro"
                  />
                </div>

                {/* Body */}
                <div>
                  <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-1">
                    Message <span className="text-red-500">*</span>
                    {hydratedContent && (
                      <span className="ml-2 text-xs font-normal text-green-600">
                        (Variables hydrated)
                      </span>
                    )}
                  </label>
                  <textarea
                    id="body"
                    value={body}
                    onChange={(e) => {
                      setBody(e.target.value);
                      setHydratedContent(null); // Clear hydration flag if manually edited
                    }}
                    required
                    rows={10}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    placeholder="Hey, saw your work on... (or select a template to auto-fill)"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {selectedTemplate 
                      ? 'Template loaded. Variables will be filled when you select a contact.'
                      : 'HTML is supported. Plain text will be auto-formatted. Select a template to use variables.'}
                  </p>
                </div>

                {/* Optional Fields */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-medium text-gray-700 mb-3">Optional Tracking Fields</p>
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="contactId" className="block text-xs font-medium text-gray-600 mb-1">
                        Contact ID
                      </label>
                      <input
                        type="text"
                        id="contactId"
                        value={contactId}
                        onChange={(e) => setContactId(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                        placeholder="c_123"
                      />
                    </div>
                    <div>
                      <label htmlFor="tenantId" className="block text-xs font-medium text-gray-600 mb-1">
                        Tenant ID
                      </label>
                      <input
                        type="text"
                        id="tenantId"
                        value={tenantId}
                        onChange={(e) => setTenantId(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                        placeholder="t_001"
                      />
                    </div>
                  </div>
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
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Email
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'campaigns' && (
          <div className="mt-8 rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="p-6">
              <div className="text-center py-12">
                <Megaphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Manage Your Campaigns</h3>
                <p className="text-sm text-gray-500 mb-6">
                  View and manage your 1-to-1 email campaigns
                </p>
                <button
                  onClick={() => router.push('/outreach/campaigns')}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Go to Campaigns
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Main page component wrapped in Suspense
export default function ComposePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <PageHeader
            title="Compose Outreach Email"
            subtitle="Send 1-to-1 personalized emails via SendGrid"
            backTo="/outreach"
            backLabel="Back to Outreach"
          />
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </div>
      </div>
    }>
      <ComposeContent />
    </Suspense>
  );
}

