'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Send, Mail, Loader2, CheckCircle2, Plus, X, Info, ChevronDown, ChevronUp, Eye, Code, Users, TrendingUp } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import ContactSelector from '@/components/ContactSelector.jsx';
import SenderIdentityPanel from '@/components/SenderIdentityPanel.jsx';
import api from '@/lib/api';
import { useOwner } from '@/hooks/useOwner';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';
import { VariableCatalogue, extractVariableNames } from '@/lib/services/variableMapperService';

function ComposeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ownerId, owner } = useOwner();
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
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateVariables, setTemplateVariables] = useState([]);
  // Always show variables - no need for state since it's always visible
  // const [showVariablesHelp, setShowVariablesHelp] = useState(true); // Always show - removed state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sentMessageId, setSentMessageId] = useState(null);
  
  // Signature state - TODO: Re-enable after relational model is implemented
  // const [emailSignature, setEmailSignature] = useState('');
  // const [includeSignature, setIncludeSignature] = useState(true); // Default to true if signature exists
  
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

  // Load templates when ownerId is available - NON-BLOCKING (load in background)
  useEffect(() => {
    if (!ownerId) return;

    // Load templates asynchronously without blocking render
    const loadTemplates = async () => {
      try {
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

    // Start loading (but don't wait for it)
    setLoadingTemplates(true);
    loadTemplates();
  }, [ownerId]); // Removed 'owner' from dependencies to avoid unnecessary re-renders

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
    if (!selectedTemplateId || !templates.length) {
      setSelectedTemplate(null);
      setTemplateVariables([]);
      return;
    }

    const template = templates.find(t => t.id === selectedTemplateId);
    if (template) {
      setSelectedTemplate(template);
      
      // Extract variables from template
      const subjectVars = extractVariableNames(template.subject || '');
      const bodyVars = extractVariableNames(template.body || '');
      const allVars = Array.from(new Set([...subjectVars, ...bodyVars]));
      setTemplateVariables(allVars);
      
      // Only populate if fields are empty (don't overwrite user edits)
      if (!subject) {
        setSubject(template.subject || '');
      }
      if (!body) {
        setBody(template.body || '');
      }
    }
  }, [selectedTemplateId, templates]);

  // Handle preview - builds payload, saves to Redis, shows hydration (reference: sandbox email-sandbox-preview)
  const handlePreview = async () => {
    // Validate required fields
    if (!selectedTemplateId && (!to || !subject || !body)) {
      setPreviewError('Please fill in all required fields or select a template');
      return;
    }

    if (!to) {
      setPreviewError('Please specify a recipient (To field or select a contact)');
      return;
    }

    if (!ownerId) {
      setPreviewError('Authentication required. Please sign in and try again.');
      return;
    }

    if (!hasVerifiedSender || !senderEmail) {
      setPreviewError('Please verify your sender email before previewing.');
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewData(null);

    try {
      // Append signature to body if enabled and signature exists - TODO: Re-enable after relational model
      // let finalBody = body || '';
      // if (includeSignature && emailSignature) {
      //   finalBody = finalBody + '\n\n' + emailSignature;
      // }
      
      // Hydrate template directly (like sandbox) - NO requestId
      let hydratedSubject = subject || '';
      let hydratedBody = body || '';
      
      // If template is selected, hydrate it with contact data
      if (selectedTemplateId && contactId) {
        const hydrateResponse = await api.post('/api/template/hydrate-with-contact', {
          templateId: selectedTemplateId,
          contactId: contactId,
          metadata: {},
        });
        
        if (hydrateResponse.data?.success) {
          hydratedSubject = hydrateResponse.data.hydratedSubject || subject;
          hydratedBody = hydrateResponse.data.hydratedBody || body;
        }
      }
      
      // Build preview data (no requestId - just hydrated content)
      setPreviewData({
        preview: {
          from: {
            email: senderEmail || '',
            name: senderName || undefined,
          },
          to: to,
          subject: hydratedSubject,
          body: hydratedBody,
          content: [{
            type: 'text/html',
            value: hydratedBody,
          }],
        },
        original: {
          subject: subject || '',
          body: body || '',
          templateId: selectedTemplateId,
        },
        hydrated: selectedTemplateId && contactId,
      });
      setShowPreviewModal(true);
    } catch (err) {
      console.error('Preview error:', err);
      setPreviewError(err.response?.data?.error || err.message || 'Failed to preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleBuildAndPreview = async (e) => {
    if (e) e.preventDefault();
    
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
      // Append signature to body if enabled and signature exists - TODO: Re-enable after relational model
      // let finalBody = body || '';
      // if (includeSignature && emailSignature) {
      //   finalBody = finalBody + '\n\n' + emailSignature;
      // }
      
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
        // Build payload successful, now send it
        const sendResponse = await api.post('/api/outreach/send', {
          requestId: response.data.requestId,
        });

        if (sendResponse.data?.success) {
          // Success! Show success page
          setSendSuccess(true);
          setSentMessageId(sendResponse.data.messageId || null);
          setSuccess(false); // Clear old success state
          setError(null);
        } else {
          setError(sendResponse.data?.error || 'Failed to send email');
        }
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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="1-to-1 Outreach"
          subtitle="Send personalized emails via SendGrid"
          backTo="/outreach"
          backLabel="Back to Outreach"
        />

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Compose Form - Left Column (2/3 width) */}
          <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white shadow-sm">
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

              {/* Template indicator if selected */}
              {selectedTemplateId && selectedTemplate && (
                <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">
                        Using template: {selectedTemplate.title}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTemplateId('');
                        setSelectedTemplate(null);
                        setTemplateVariables([]);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

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

              {/* Signature Option - TODO: Re-enable after relational model is implemented
              {emailSignature && (
                <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="includeSignature"
                    checked={includeSignature}
                    onChange={(e) => setIncludeSignature(e.target.checked)}
                    className="mt-1 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <label htmlFor="includeSignature" className="block text-sm font-medium text-gray-700 cursor-pointer">
                      Include email signature
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Your signature will be added at the end of the email
                    </p>
                    {includeSignature && (
                      <div 
                        className="mt-2 text-xs text-gray-600 border border-gray-200 rounded p-2 bg-white"
                        dangerouslySetInnerHTML={{ __html: emailSignature }}
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => window.open('/settings?section=profile', '_blank')}
                    className="text-xs text-blue-600 hover:text-blue-700 whitespace-nowrap"
                  >
                    Edit signature
                  </button>
                </div>
              )}
              */}

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
                    Template selected. Variables will be replaced with contact data when you build the payload.
                  </p>
                )}
              </div>

              {/* Variables Helper Section - Always Visible, Clickable */}
              <div className="border border-gray-200 rounded-lg bg-gray-50">
                <div className="px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">
                      {selectedTemplateId && templateVariables.length > 0
                        ? `Template Variables (${templateVariables.length} found) - Click to insert`
                        : 'Available Variables - Click to insert'}
                    </span>
                  </div>
                </div>
                
                <div className="px-4 pb-4 pt-4">
                  {selectedTemplateId && templateVariables.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-gray-700 mb-2">
                        Variables found in selected template (click to insert):
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {templateVariables.map((varName) => {
                          const varDef = VariableCatalogue[varName];
                          return (
                            <button
                              key={varName}
                              type="button"
                              onClick={() => {
                                // Insert variable at cursor position in body textarea
                                const textarea = document.getElementById('body');
                                if (textarea) {
                                  const start = textarea.selectionStart || 0;
                                  const end = textarea.selectionEnd || 0;
                                  const variableText = `{{${varName}}}`;
                                  const newBody = body.substring(0, start) + variableText + body.substring(end);
                                  setBody(newBody);
                                  // Set cursor position after inserted variable
                                  setTimeout(() => {
                                    textarea.focus();
                                    textarea.setSelectionRange(start + variableText.length, start + variableText.length);
                                  }, 0);
                                }
                              }}
                              className="text-left flex items-start gap-2 text-xs p-2 rounded hover:bg-blue-50 transition cursor-pointer border border-transparent hover:border-blue-200"
                            >
                              <code className="px-2 py-1 bg-blue-100 text-blue-800 rounded font-mono whitespace-nowrap">
                                {`{{${varName}}}`}
                              </code>
                              <span className="text-gray-600 flex-1">
                                {varDef?.description || `Variable: ${varName}`}
                                {contactId && varDef && (
                                  <span className="text-gray-400 ml-1">
                                    • Maps to: {varDef.dbField || varDef.source}
                                  </span>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {!contactId && (
                        <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                          💡 Select a contact to see how variables will be resolved from the database.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-medium text-gray-700 mb-2">
                        Available variables you can use (click to insert):
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {Object.entries(VariableCatalogue).map(([key, def]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              // Insert variable at cursor position in body textarea
                              const textarea = document.getElementById('body');
                              if (textarea) {
                                const start = textarea.selectionStart || 0;
                                const end = textarea.selectionEnd || 0;
                                const variableText = `{{${key}}}`;
                                const newBody = body.substring(0, start) + variableText + body.substring(end);
                                setBody(newBody);
                                // Set cursor position after inserted variable
                                setTimeout(() => {
                                  textarea.focus();
                                  textarea.setSelectionRange(start + variableText.length, start + variableText.length);
                                }, 0);
                              }
                            }}
                            className="text-left flex items-start gap-2 text-xs p-2 rounded hover:bg-blue-50 transition cursor-pointer border border-transparent hover:border-blue-200"
                          >
                            <code className="px-2 py-1 bg-blue-100 text-blue-800 rounded font-mono whitespace-nowrap">
                              {`{{${key}}}`}
                            </code>
                            <span className="text-gray-600">
                              {def.description}
                            </span>
                          </button>
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-gray-600">
                        💡 Variables are automatically resolved from the database when you select a contact and template.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={async (e) => {
                    e.preventDefault();
                    // First build payload, then show preview
                    await handleBuildAndPreview(e);
                  }}
                  disabled={previewLoading || sending || !ownerId || (!to || (!subject && !selectedTemplateId) || (!body && !selectedTemplateId))}
                  className="inline-flex items-center gap-2 rounded-md bg-red-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {previewLoading || sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Building...
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      Preview
                    </>
                  )}
                </button>
              </div>
              </form>
            </div>
          </div>

          {/* Template Selector Sidebar - Right Column (1/3 width) */}
          <div className="lg:col-span-1 rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Choose from Template</h3>
              <p className="text-xs text-gray-500 mt-1">
                Select a template to fill subject and body
              </p>
            </div>
            <div className="p-4">
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-600">Loading templates...</span>
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No templates available</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Create templates in the Templates section
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => {
                        setSelectedTemplateId(template.id);
                        // Fill subject and body with template content (variables shown as-is)
                        setSubject(template.subject || '');
                        setBody(template.body || '');
                      }}
                      className={`w-full text-left p-3 rounded-lg border-2 transition ${
                        selectedTemplateId === template.id
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-medium text-sm text-gray-900 mb-1">
                        {template.title}
                      </div>
                      {template.subject && (
                        <div className="text-xs text-gray-600 truncate mb-1" title={template.subject}>
                          {template.subject}
                        </div>
                      )}
                      {template.body && (
                        <div className="text-xs text-gray-500 line-clamp-2">
                          {template.body.replace(/\{\{(\w+)\}\}/g, '[var]').substring(0, 60)}...
                        </div>
                      )}
                      {selectedTemplateId === template.id && (
                        <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Selected</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal - Shows hydrated email (reference: sandbox email-sandbox-preview) */}
      {showPreviewModal && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Email Preview</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedTemplateId && contactId 
                    ? 'Template hydrated with contact data from database'
                    : selectedTemplateId
                    ? 'Template preview (select a contact to see hydration)'
                    : 'Manual email preview'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewData(null);
                  setPreviewError(null);
                }}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto max-h-[calc(90vh-180px)] p-6">
              {previewError && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-sm font-medium text-red-900">{previewError}</p>
                </div>
              )}

              {previewData?.preview && (
                <div className="space-y-6">
                  {/* Hydration Comparison - Show original vs hydrated if template is used */}
                  {selectedTemplateId && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {/* Original Template with Variables */}
                      <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                        <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                          <Code className="h-4 w-4" />
                          Original Template (with variables)
                        </h3>
                        <div className="space-y-3 text-xs">
                          <div>
                            <label className="block font-medium text-blue-800 mb-1">Subject:</label>
                            <div className="bg-white rounded p-2 border border-blue-200 font-mono text-xs whitespace-pre-wrap break-words">
                              {previewData.original.subject}
                            </div>
                          </div>
                          <div>
                            <label className="block font-medium text-blue-800 mb-1">Body:</label>
                            <div className="bg-white rounded p-2 border border-blue-200 font-mono text-xs whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                              {previewData.original.body}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Hydrated Version */}
                      <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                        <h3 className="text-sm font-semibold text-green-900 mb-3 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          Hydrated Version {contactId ? '(from database)' : '(no contact selected)'}
                        </h3>
                        <div className="space-y-3 text-xs">
                          <div>
                            <label className="block font-medium text-green-800 mb-1">Subject:</label>
                            <div className="bg-white rounded p-2 border border-green-200">
                              {previewData.preview.subject || previewData.preview.personalizations?.[0]?.subject}
                            </div>
                          </div>
                          <div>
                            <label className="block font-medium text-green-800 mb-1">Body:</label>
                            <div 
                              className="bg-white rounded p-2 border border-green-200 max-h-64 overflow-y-auto prose prose-xs max-w-none"
                              dangerouslySetInnerHTML={{ 
                                __html: previewData.preview.body || previewData.preview.content?.[0]?.value || '' 
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Final Email Preview */}
                  <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Final Email Preview
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                          From
                        </label>
                        <div className="text-sm text-gray-900">
                          {previewData.preview.from?.name && (
                            <span className="font-medium">{previewData.preview.from.name} </span>
                          )}
                          <span className="text-gray-600">&lt;{previewData.preview.from?.email || 'N/A'}&gt;</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                          To
                        </label>
                        <p className="text-sm text-gray-900">
                          {previewData.preview.to || previewData.preview.personalizations?.[0]?.to?.[0]?.email || 'N/A'}
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                          Subject
                        </label>
                        <p className="text-sm font-medium text-gray-900">
                          {previewData.preview.subject || previewData.preview.personalizations?.[0]?.subject || 'N/A'}
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                          Message
                        </label>
                        <div 
                          className="text-sm text-gray-900 prose prose-sm max-w-none border border-gray-200 rounded-md p-4 bg-white"
                          dangerouslySetInnerHTML={{ 
                            __html: previewData.preview.body || previewData.preview.content?.[0]?.value || 'N/A' 
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Variables Info - Shows how variables map */}
                  {selectedTemplateId && templateVariables.length > 0 && (
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Variable Hydration</h3>
                      <div className="space-y-2">
                        {templateVariables.map((varName) => {
                          const varDef = VariableCatalogue[varName];
                          // Check if variable was resolved (no {{}} in hydrated version)
                          const hydratedSubject = previewData.preview.subject || previewData.preview.personalizations?.[0]?.subject || '';
                          const hydratedBody = previewData.preview.body || previewData.preview.content?.[0]?.value || '';
                          const isResolved = !hydratedSubject.includes(`{{${varName}}}`) && !hydratedBody.includes(`{{${varName}}}`);
                          
                          return (
                            <div key={varName} className="flex items-start gap-3 p-2 bg-white rounded border border-gray-200">
                              <code className="px-2 py-1 bg-blue-100 text-blue-800 rounded font-mono text-xs whitespace-nowrap">
                                {`{{${varName}}}`}
                              </code>
                              <div className="flex-1 text-xs">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-gray-600">→</span>
                                  {contactId ? (
                                    <span className={isResolved ? 'text-green-600 font-medium' : 'text-amber-600'}>
                                      {isResolved ? '✓ Resolved from database' : '⚠ Not found in database'}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">Select contact to resolve</span>
                                  )}
                                </div>
                                {varDef && (
                                  <div className="text-gray-500 text-xs">
                                    Maps to: <code className="bg-gray-100 px-1 rounded">{varDef.dbField || varDef.source}</code>
                                    {varDef.description && ` • ${varDef.description}`}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {!contactId && (
                        <p className="text-xs text-amber-700 mt-3 bg-amber-50 border border-amber-200 rounded p-2">
                          💡 Select a contact to see how variables are resolved from the database. Variables will be replaced with actual contact data when you send.
                        </p>
                      )}
                      {contactId && selectedContact && (
                        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
                          <p className="text-xs font-medium text-green-900 mb-2">Contact Data (from database):</p>
                          <div className="grid grid-cols-2 gap-2 text-xs text-green-800">
                            {selectedContact.firstName && (
                              <div><strong>firstName:</strong> {selectedContact.firstName}</div>
                            )}
                            {selectedContact.lastName && (
                              <div><strong>lastName:</strong> {selectedContact.lastName}</div>
                            )}
                            {selectedContact.companyName && (
                              <div><strong>companyName:</strong> {selectedContact.companyName}</div>
                            )}
                            {selectedContact.title && (
                              <div><strong>title:</strong> {selectedContact.title}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 bg-gray-50">
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewData(null);
                  setPreviewError(null);
                }}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    // Build payload and send
                    try {
                      setPreviewLoading(true);
                      const buildResponse = await api.post('/api/outreach/build-payload', {
                        to,
                        subject: subject || '',
                        body: body || '',
                        senderEmail,
                        senderName: senderName || undefined,
                        contactId: contactId || undefined,
                        tenantId: tenantId || undefined,
                        templateId: selectedTemplateId || undefined,
                      });

                      if (buildResponse.data?.success) {
                        const sendResponse = await api.post('/api/outreach/send', {
                          requestId: buildResponse.data.requestId,
                        });
                        
                        if (sendResponse.data?.success) {
                          setShowPreviewModal(false);
                          setSendSuccess(true);
                          setSentMessageId(sendResponse.data.messageId || null);
                        } else {
                          setPreviewError(sendResponse.data?.error || 'Failed to send email');
                        }
                      } else {
                        setPreviewError(buildResponse.data?.error || 'Failed to build payload');
                      }
                    } catch (err) {
                      setPreviewError(err.response?.data?.error || 'Failed to send email');
                    } finally {
                      setPreviewLoading(false);
                    }
                  }}
                  disabled={previewLoading || !hasVerifiedSender || !senderEmail}
                  className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {previewLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Now
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-red-600" />
            <p className="text-sm text-gray-600">Loading compose page...</p>
          </div>
        </div>
      </div>
    }>
      <ComposeContent />
    </Suspense>
  );
}
