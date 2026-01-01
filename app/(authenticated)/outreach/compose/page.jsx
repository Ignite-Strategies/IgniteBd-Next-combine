'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Send, Mail, Loader2, CheckCircle2, Plus, X, Info, ChevronDown, ChevronUp, Eye, Code, Users, TrendingUp } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import ContactSelector from '@/components/ContactSelector.jsx';
import CompanyKeyMissingError from '@/components/CompanyKeyMissingError';
import api from '@/lib/api';
import { VariableCatalogue, extractVariableNames } from '@/lib/services/variableMapperService';
import { formatContactEmail, formatEmailWithName, parseEmailString } from '@/lib/utils/emailFormat';

function ComposeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Read companyHQId from URL params, with fallback to localStorage
  const urlCompanyHQId = searchParams?.get('companyHQId') || '';
  const [companyHQId, setCompanyHQId] = useState(urlCompanyHQId);
  const hasRedirectedRef = useRef(false);
  
  // Fallback: If not in URL, check localStorage and redirect (preserving all existing params)
  useEffect(() => {
    if (hasRedirectedRef.current) return;
    if (urlCompanyHQId) {
      console.log('📧 Compose: companyHQId from URL:', urlCompanyHQId);
      setCompanyHQId(urlCompanyHQId);
      return;
    }
    
    // No companyHQId in URL - check localStorage
    if (typeof window === 'undefined') return;
    
    const storedCompanyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId');
    console.log('📧 Compose: Checking localStorage for companyHQId:', storedCompanyHQId);
    if (storedCompanyHQId) {
      hasRedirectedRef.current = true;
      console.log('✅ Compose: Found companyHQId in localStorage, redirecting with:', storedCompanyHQId);
      // Preserve all existing search params and add companyHQId
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('companyHQId', storedCompanyHQId);
      router.replace(currentUrl.pathname + currentUrl.search);
      setCompanyHQId(storedCompanyHQId);
    } else {
      console.warn('⚠️ Compose: No companyHQId found in URL or localStorage');
    }
  }, [urlCompanyHQId, router]);
  
  // STEP 1: Load sender info FIRST (from localStorage - no API calls)
  // This happens synchronously on page load
  const owner = typeof window !== 'undefined' 
    ? JSON.parse(localStorage.getItem('owner') || 'null')
    : null;
  
  // Extract sender info from owner (no API calls) - read from sendgridVerifiedEmail
  const senderEmail = owner?.sendgridVerifiedEmail || null;
  const senderName = owner?.sendgridVerifiedName || null;
  const hasVerifiedSender = !!senderEmail;
  
  // Log sender info (first thing loaded)
  useEffect(() => {
    if (senderEmail) {
      console.log('✅ STEP 1: Sender info loaded from localStorage:', {
        email: senderEmail,
        name: senderName,
        hasVerifiedSender,
      });
    } else {
      console.warn('⚠️ STEP 1: No sender email found in localStorage');
      console.warn('⚠️ Owner object:', owner ? {
        id: owner.id,
        email: owner.email,
        hasSendgridVerifiedEmail: !!owner.sendgridVerifiedEmail,
        sendgridVerifiedEmail: owner.sendgridVerifiedEmail,
        allKeys: Object.keys(owner),
      } : 'null');
      console.warn('⚠️ If sendgridVerifiedEmail is missing, owner object may need rehydration from /api/owner/hydrate');
    }
  }, [senderEmail, senderName, hasVerifiedSender, owner]);
  
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
  const [templatesError, setTemplatesError] = useState(false);
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
  
  // Quick contact creation modal
  const [showQuickContactModal, setShowQuickContactModal] = useState(false);
  const [quickContactData, setQuickContactData] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });
  const [savingQuickContact, setSavingQuickContact] = useState(false);
  const [quickContactError, setQuickContactError] = useState(null);
  
  // Live preview state - hydrated email preview
  const [hydratedPreview, setHydratedPreview] = useState({
    subject: '',
    body: '',
    loading: false,
  });
  
  // Check if companyHQId is missing from URL params - just show error, no redirect
  const missingCompanyKey = !companyHQId;

  // Log CompanyHQ from URL params
  useEffect(() => {
    if (companyHQId) {
      console.log('🏢 Outreach Compose: CompanyHQ from URL params:', {
        companyHQId,
        timestamp: new Date().toISOString(),
      });
    }
  }, [companyHQId]);

  // STEP 2: Load templates (sequential loading) - scoped from companyHQId params
  // Trust axios interceptor to handle auth - no auth waiting in page
  useEffect(() => {
    if (!companyHQId) {
      console.log('📧 STEP 2: Templates - Waiting for companyHQId...', { companyHQId });
      return;
    }
    
    let cancelled = false;
    
    console.log('📧 Fetching templates for company:', companyHQId);
    setLoadingTemplates(true);
    setTemplatesError(false);
    
    api
      .get(`/api/templates?companyHQId=${companyHQId}`)
      .then((response) => {
        if (cancelled) return;
        
        console.log('📦 STEP 2: Templates - API response received:', {
          status: response.status,
          hasSuccess: !!response.data?.success,
          templatesCount: response.data?.templates?.length || 0,
        });
        
        if (response.data?.success) {
          const templates = response.data.templates || [];
          console.log('✅ STEP 2: Templates - Loaded', templates.length, 'templates');
          setTemplates(templates);
          setTemplatesError(false);
        } else {
          console.warn('⚠️ STEP 2: Templates - API response not successful:', response.data);
          setTemplates([]);
          setTemplatesError(true);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        
        console.error('❌ STEP 2: Templates - API call failed:', err);
        console.error('❌ Error details:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status,
        });
        setTemplates([]);
        setTemplatesError(true);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingTemplates(false);
        console.log('✅ STEP 2: Templates - Loading complete');
      });
    
    return () => {
      cancelled = true;
    };
  }, [companyHQId]);

  // Handle contactId from URL params (when navigating from success modal)
  // Note: ContactSelector will handle loading this contact when it mounts
  useEffect(() => {
    const urlContactId = searchParams?.get('contactId');
    if (urlContactId && urlContactId !== contactId) {
      // ContactSelector will handle loading this contact
      // Just set the contactId so ContactSelector knows to load it
      setContactId(urlContactId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  
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
    // Format as "Name <email>" for display
    const formattedEmail = formatContactEmail(contact);
    setTo(formattedEmail);
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

    if (!hasVerifiedSender || !senderEmail) {
      setPreviewError('Please verify your sender email before previewing.');
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewData(null);

    try {
      // Hydrate variables - works for both template and manual content
      // Uses variableMapperService (extractVariableNames)
      let hydratedSubject = subject || '';
      let hydratedBody = body || '';
      
      // Check if there are variables in content
      const subjectVars = extractVariableNames(subject || '');
      const bodyVars = extractVariableNames(body || '');
      const hasVariables = subjectVars.length > 0 || bodyVars.length > 0;
      
      // Always hydrate variables if we have content and contact info
      if ((subject || body) && (contactId || to)) {
        if (selectedTemplateId && contactId) {
          // Use template hydration API if template is selected
          try {
            const hydrateResponse = await api.post('/api/template/hydrate-with-contact', {
              templateId: selectedTemplateId,
              contactId: contactId,
              to: to, // Pass 'to' field as fallback if contactId is invalid
              metadata: {},
            });
            
            if (hydrateResponse.data?.success) {
              hydratedSubject = hydrateResponse.data.hydratedSubject || subject;
              hydratedBody = hydrateResponse.data.hydratedBody || body;
            }
          } catch (err) {
            console.warn('Failed to hydrate template, falling back to universal hydration:', err);
            // Fall through to universal hydration
          }
        }
        
        // Use universal variable hydration for manual content or as fallback
        // This works whether content came from template or was manually typed
        if (hydratedSubject === subject && hydratedBody === body) {
          // Hydrate subject if it has content and wasn't already hydrated
          if (subject) {
            try {
              const subjectResponse = await api.post('/api/variables/hydrate', {
                content: subject,
                contactId: contactId || undefined,
                to: to || undefined,
                metadata: {},
              });
              
              if (subjectResponse.data?.success) {
                hydratedSubject = subjectResponse.data.hydratedContent || subject;
              }
            } catch (err) {
              console.warn('Failed to hydrate subject variables:', err);
              // Keep original subject if hydration fails
            }
          }
          
          // Hydrate body if it has content and wasn't already hydrated
          if (body) {
            try {
              const bodyResponse = await api.post('/api/variables/hydrate', {
                content: body,
                contactId: contactId || undefined,
                to: to || undefined,
                metadata: {},
              });
              
              if (bodyResponse.data?.success) {
                hydratedBody = bodyResponse.data.hydratedContent || body;
              }
            } catch (err) {
              console.warn('Failed to hydrate body variables:', err);
              // Keep original body if hydration fails
            }
          }
        }
        
        // Check if variables weren't fully resolved (still contain {{variable}} tags)
        const unresolvedSubjectVars = extractVariableNames(hydratedSubject);
        const unresolvedBodyVars = extractVariableNames(hydratedBody);
        const hasUnresolvedVars = unresolvedSubjectVars.length > 0 || unresolvedBodyVars.length > 0;
        
        // Show warning if variables exist but contact not found
        if (hasUnresolvedVars && !contactId && to) {
          // Try to parse email to see if we can at least get name
          const parsed = parseEmailString(to);
          if (!parsed.name || parsed.name.trim() === parsed.email) {
            // No name in 'to' field, show helpful message
            setPreviewError(
              '⚠️ Variables like {{firstName}} cannot be resolved until you make this person a contact. ' +
              'You can either select an existing contact or use the "Quick Save" button to create one.'
            );
          }
        }
      } else if (hasVariables && !contactId && !to) {
        // Variables in content but no contact info at all
        setPreviewError(
          '⚠️ Variables like {{firstName}} require a contact. Please select a contact or enter an email address.'
        );
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
      // Show preview below instead of modal
      setShowPreviewModal(false);
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

  // Show error if company key is missing
  if (missingCompanyKey) {
    return <CompanyKeyMissingError />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="1-to-1 Outreach"
          subtitle="Send personalized emails via SendGrid"
          backTo={companyHQId ? `/outreach?companyHQId=${companyHQId}` : '/outreach'}
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
              {/* Sender Identity - Read from localStorage (no API calls) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  From
                </label>
                {!hasVerifiedSender ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-medium text-amber-900 mb-2">
                      Sender email not configured
                    </p>
                    <a
                      href="/outreach/sender-verify"
                      className="text-xs text-amber-700 hover:text-amber-900 underline"
                    >
                      Verify sender email →
                    </a>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span className="text-gray-900 font-medium">
                      {senderName || senderEmail}
                    </span>
                    <span className="text-gray-500">&lt;{senderEmail}&gt;</span>
                  </div>
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
                  companyHQId={companyHQId}
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
                          {to && !contactId && (
                            <span className="block mt-1">
                              ⚠️ Variables like {{firstName}} cannot be fully resolved until you make this person a contact. 
                              Use "Quick Save" to create a contact.
                            </span>
                          )}
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
                      {to && !contactId && (extractVariableNames(subject || '').length > 0 || extractVariableNames(body || '').length > 0) && (
                        <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                          ⚠️ Variables like {{firstName}} cannot be fully resolved until you make this person a contact. 
                          Use "Quick Save" to create a contact, or select an existing contact.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={previewLoading || sending || !hasVerifiedSender || !senderEmail || (!to || (!subject && !selectedTemplateId) || (!body && !selectedTemplateId))}
                  className="inline-flex items-center gap-2 rounded-md bg-gray-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {previewLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      Preview
                    </>
                  )}
                </button>
                <button
                  type="submit"
                  disabled={sending || !hasVerifiedSender || !senderEmail || !to || !subject || !body}
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

          {/* Template Selector Sidebar - Right Column (1/3 width) */}
          <div className="lg:col-span-1 rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Choose Template</h3>
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
              ) : templatesError ? (
                <div className="text-center py-8">
                  <Mail className="h-8 w-8 text-amber-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-amber-900">Failed to load templates</p>
                  <p className="text-xs text-amber-700 mt-1">
                    You can still compose manually
                  </p>
                </div>
              ) : templates.length === 0 && !loadingTemplates ? (
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

        {/* Preview Section - Shows below when preview is loaded */}
        {previewData && !showPreviewModal && (
          <div className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Email Preview</h2>
                <button
                  onClick={() => {
                    setPreviewData(null);
                    setPreviewError(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              {previewError && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-sm font-medium text-red-900">{previewError}</p>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                  <div className="text-sm text-gray-900">
                    {previewData.preview.from?.name 
                      ? `${previewData.preview.from.name} <${previewData.preview.from.email}>`
                      : previewData.preview.from?.email}
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                  <div className="text-sm text-gray-900">{previewData.preview.to}</div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
                  <div className="text-sm text-gray-900 font-medium">{previewData.preview.subject}</div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Message</label>
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 min-h-[200px]">
                    <div 
                      className="text-sm text-gray-900 whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ __html: previewData.preview.body || previewData.preview.content?.[0]?.value || '' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal - Split Screen, Inline Editable (like sandbox) */}
      {showPreviewModal && previewData && (
        <div className="fixed inset-0 z-50 bg-gray-50">
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
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
            
            {/* Split Screen Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left: Editable Fields */}
              <div className="w-1/2 border-r border-gray-200 bg-white overflow-y-auto p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Email</h3>
                
                {previewError && (
                  <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
                    <p className="text-sm font-medium text-red-900">{previewError}</p>
                  </div>
                )}
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                    <div className="text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded px-3 py-2">
                      {previewData.preview.from?.name 
                        ? `${previewData.preview.from.name} <${previewData.preview.from.email}>`
                        : previewData.preview.from?.email}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                    <input
                      type="text"
                      value={formatEmailWithName(previewData.preview.to, previewData.preview.toName)}
                      onChange={(e) => {
                        const parsed = parseEmailString(e.target.value);
                        // Update preview data
                        setPreviewData({
                          ...previewData,
                          preview: {
                            ...previewData.preview,
                            to: parsed.email,
                            toName: parsed.name || undefined,
                          },
                        });
                        // Update form state
                        setTo(e.target.value);
                        setToName(parsed.name || '');
                      }}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                    <input
                      type="text"
                      value={previewData.preview.subject}
                      onChange={(e) => {
                        setPreviewData({
                          ...previewData,
                          preview: {
                            ...previewData.preview,
                            subject: e.target.value,
                          },
                          original: {
                            ...previewData.original,
                            subject: e.target.value,
                          },
                        });
                        setSubject(e.target.value);
                      }}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
                    <textarea
                      value={previewData.preview.body}
                      onChange={(e) => {
                        setPreviewData({
                          ...previewData,
                          preview: {
                            ...previewData.preview,
                            body: e.target.value,
                            content: [{
                              type: 'text/html',
                              value: e.target.value,
                            }],
                          },
                          original: {
                            ...previewData.original,
                            body: e.target.value,
                          },
                        });
                        setBody(e.target.value);
                      }}
                      rows={15}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
                    />
                  </div>
                </div>
              </div>
              
              {/* Right: Preview Display */}
              <div className="w-1/2 bg-gray-50 overflow-y-auto p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview</h3>
                
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                      <p className="text-sm text-gray-900">
                        {previewData.preview.from?.name 
                          ? `${previewData.preview.from.name} <${previewData.preview.from.email}>`
                          : previewData.preview.from?.email}
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                      <p className="text-sm text-gray-900">
                        {formatEmailWithName(previewData.preview.to, previewData.preview.toName)}
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
                      <p className="text-sm text-gray-900 font-medium">{previewData.preview.subject}</p>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Body</label>
                      <div 
                        className="text-sm text-gray-900 border border-gray-200 rounded p-4 bg-gray-50 whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: previewData.preview.body || previewData.preview.content?.[0]?.value || '' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Footer with Send Button */}
            <div className="flex items-center justify-end border-t border-gray-200 px-6 py-4 bg-white">
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    // Build payload and send (use current preview data)
                    try {
                      setPreviewLoading(true);
                      const parsedTo = parseEmailString(previewData.preview.to || to);
                      const toEmail = parsedTo.email || previewData.preview.to || to;
                      
                      const buildResponse = await api.post('/api/outreach/build-payload', {
                        to: toEmail,
                        toName: parsedTo.name || previewData.preview.toName || toName || undefined,
                        subject: previewData.preview.subject || subject || '',
                        body: previewData.preview.body || body || '',
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
                  className="inline-flex items-center gap-2 rounded-md bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {previewLoading ? (
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
