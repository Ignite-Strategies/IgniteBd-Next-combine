'use client';

import { useState, useEffect, Suspense } from 'react';
import { Send, Mail, Loader2, CheckCircle2, Plus, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import ContactSelector from '@/components/ContactSelector.jsx';
import SenderIdentityPanel from '@/components/SenderIdentityPanel.jsx';
import api from '@/lib/api';
import { useOwner } from '@/hooks/useOwner';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';

function ComposeContent() {
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
  
  // UI state
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  
  // Verified sender state (for display only - SenderIdentityPanel manages verification)
  const [senderEmail, setSenderEmail] = useState('');
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
        
        if (email) {
          setSenderEmail(email);
        }
      }
    } catch (err) {
      console.error('Failed to load sender status:', err);
    } finally {
      setLoadingSender(false);
    }
  };
  
  // Load data on mount
  useEffect(() => {
    if (ownerId) {
      loadVerifiedSender();
    }
  }, [ownerId]);
  
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
      // Send email directly - no template variable replacement
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
                
                <textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                  rows={10}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="Type your message here..."
                />
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
