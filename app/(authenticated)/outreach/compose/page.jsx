'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Send, Mail, Loader2, CheckCircle2, Sparkles, Plus, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import ContactSelector from '@/components/ContactSelector.jsx';
import SenderIdentityPanel from '@/components/SenderIdentityPanel.jsx';
import api from '@/lib/api';
import { useOwner } from '@/hooks/useOwner';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';
import { hydrateTemplate as replaceTemplateVariables } from '@/lib/templateVariables';

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
  
  // UI state
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  
  // Verified sender state (for display only - SenderIdentityPanel manages verification)
  const [senderEmail, setSenderEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  const [loadingSender, setLoadingSender] = useState(true);
  
  // Quick contact creation modal
  const [showQuickContactModal, setShowQuickContactModal] = useState(false);
  const [quickContactData, setQuickContactData] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });
  const [savingQuickContact, setSavingQuickContact] = useState(false);
  const [quickContactError, setQuickContactError] = useState(null);
  
  // Load verified sender status on mount
  const loadVerifiedSender = async () => {
    if (!ownerId) return;
    
    try {
      setLoadingSender(true);
      const response = await api.get('/api/outreach/verified-senders');
      
      if (response.data?.success) {
        const email = response.data.verifiedEmail;
        const name = response.data.verifiedName;
        
        if (email) {
          setSenderEmail(email);
          setSenderName(name);
        }
      }
    } catch (err) {
      console.error('Failed to load sender status:', err);
    } finally {
      setLoadingSender(false);
    }
  };
  
  // Load templates on mount
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
  
  // Load data on mount
  useEffect(() => {
    if (ownerId) {
      loadVerifiedSender();
    }
    if (companyHQId) {
      loadTemplates();
    }
  }, [ownerId, companyHQId]);
  
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
  
  // Handle template selection
  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setSubject(template.template_bases?.title || '');
    setBody(template.content || '');
  };
  
  // Hydrate template with contact data (manual trigger only)
  const hydrateTemplate = async (contact, template = selectedTemplate) => {
    if (!template || !contact) {
      setError('Please select both a template and a contact to hydrate.');
      return;
    }
    
    try {
      setHydrating(true);
      const response = await api.post('/api/template/hydrate-with-contact', {
        templateId: template.id,
        contactId: contact.id,
      });
      
      if (response.data?.success && response.data.hydratedContent) {
        setBody(response.data.hydratedContent);
        
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

    // Check for verified sender
    if (!senderEmail) {
      setError('Please verify your sender email before sending. Click "Add" next to From field.');
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(false);

    try {
      // Replace variables in subject and body
      // Always provide contactData (even if empty) to prevent undefined errors
      const contactData = selectedContact ? {
        firstName: selectedContact.firstName || '',
        lastName: selectedContact.lastName || '',
        fullName: selectedContact.fullName || `${selectedContact.firstName || ''} ${selectedContact.lastName || ''}`.trim() || '',
        companyName: selectedContact.companyName || selectedContact.company?.companyName || '',
        company: selectedContact.companyName || selectedContact.company?.companyName || '', // Alias for company
        email: selectedContact.email || '',
        title: selectedContact.title || '',
      } : {
        // Default empty values when no contact is selected
        firstName: '',
        lastName: '',
        fullName: '',
        companyName: '',
        company: '',
        email: '',
        title: '',
      };
      
      // Replace variables in subject (always call, even with empty data)
      let finalSubject = replaceTemplateVariables(subject, contactData);
      // Also handle {{company}} as alias for {{companyName}}
      finalSubject = finalSubject.replace(/\{\{company\}\}/g, contactData.companyName || '');
      
      // Replace variables in body (always call, even with empty data)
      let finalBody = replaceTemplateVariables(body, contactData);
      // Also handle {{company}} as alias for {{companyName}}
      finalBody = finalBody.replace(/\{\{company\}\}/g, contactData.companyName || '');

      const response = await api.post('/api/outreach/send', {
        to,
        toName: toName || undefined,
        subject: finalSubject,
        body: finalBody,
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
        
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(response.data.error || 'Failed to send email');
      }
    } catch (err) {
      console.error('Send error:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to send email';
      
      if (errorMessage.includes('credits') || errorMessage.includes('exceeded')) {
        setError('SendGrid account has exceeded email credits. Please upgrade your plan or wait for credits to reset. Contact your administrator for help.');
      } else if (errorMessage.includes('authentication') || errorMessage.includes('Unauthorized')) {
        setError('SendGrid authentication failed. Please contact your administrator to check API key configuration.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setSending(false);
    }
  };

  const variableOptions = [
    { name: 'firstName', label: 'First Name' },
    { name: 'lastName', label: 'Last Name' },
    { name: 'fullName', label: 'Full Name' },
    { name: 'company', label: 'Company' },
    { name: 'companyName', label: 'Company Name' },
    { name: 'email', label: 'Email' },
    { name: 'title', label: 'Title' },
  ];

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

            <form onSubmit={handleSend} className="space-y-4">
              {/* Sender Identity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  From
                </label>
                
                {!senderEmail && !loadingSender ? (
                  <div className="rounded-lg border-2 border-dashed border-yellow-300 bg-yellow-50 p-4">
                    <div className="flex items-start gap-3">
                      <Mail className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-yellow-900 mb-1">
                          Add a verified sender email with SendGrid
                        </p>
                        <p className="text-xs text-yellow-700 mb-3">
                          You need to verify your business email address with SendGrid before sending emails. 
                          This ensures your emails are delivered successfully.
                        </p>
                        <SenderIdentityPanel />
                      </div>
                    </div>
                  </div>
                ) : (
                  <SenderIdentityPanel />
                )}
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
                </label>
                
                {/* Template Variables Helper */}
                <div className="mb-2 flex flex-wrap gap-2">
                  <span className="text-xs text-gray-500">Insert Variables:</span>
                  {variableOptions.map((variable) => (
                    <button
                      key={variable.name}
                      type="button"
                      onClick={() => {
                        const textarea = document.getElementById('body');
                        if (!textarea) return;

                        const variableTag = `{{${variable.name}}}`;
                        const cursorPos = textarea.selectionStart || body.length;
                        const textBefore = body.substring(0, cursorPos);
                        const textAfter = body.substring(cursorPos);
                        setBody(`${textBefore}${variableTag}${textAfter}`);
                        
                        setTimeout(() => {
                          const newPos = cursorPos + variableTag.length;
                          textarea.setSelectionRange(newPos, newPos);
                          textarea.focus();
                        }, 0);
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-white px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition"
                      title={`Insert ${variable.label}`}
                    >
                      {`{{${variable.name}}}`}
                    </button>
                  ))}
                </div>
                
                <textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                  rows={10}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="Hey {{firstName}}, saw your work at {{company}}..."
                />
                <p className="mt-1 text-xs text-gray-500">
                  Use variables like {{firstName}}, {{company}}, etc. They'll be replaced when sending.
                </p>
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
                  placeholder="John"
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
                  placeholder="Doe"
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
                  placeholder="john.doe@example.com"
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
