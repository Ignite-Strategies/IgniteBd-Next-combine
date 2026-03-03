'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { Inbox, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';

/**
 * Inbound Email Review Page
 * 
 * Route: /outreach/inbound
 * 
 * Full page view of inbound emails received via SendGrid Inbound Parse.
 */
export default function InboundEmailPage() {
  const router = useRouter();
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  const [companyHQId, setCompanyHQId] = useState(null);

  useEffect(() => {
    // Get companyHQId from localStorage
    const crmId = typeof window !== 'undefined' 
      ? window.localStorage.getItem('companyHQId') || window.localStorage.getItem('companyId') || null
      : null;
    
    if (crmId) {
      setCompanyHQId(crmId);
      fetchInboundEmails(crmId);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchInboundEmails = async (tenantId) => {
    try {
      setLoading(true);
      const res = await api.get(`/api/inbound-emails?tenantId=${tenantId}`);
      if (res.data?.success) {
        setEmails(res.data.emails || []);
      }
    } catch (error) {
      console.error('Error fetching inbound emails:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <PageHeader title="Inbound Emails" subtitle="Loading..." />
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-gray-500">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Inbound Emails"
          subtitle="Emails received via SendGrid Inbound Parse"
          backTo="/outreach"
          backLabel="Back to Outreach"
        />

        {emails.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 shadow-lg text-center">
            <Inbox className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No inbound emails yet</h3>
            <p className="text-sm text-gray-500">
              Emails sent to your company address will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Email List */}
            <div className="space-y-2">
              <h2 className="text-lg font-semibold mb-4">Recent Emails ({emails.length})</h2>
              {emails.map((email) => (
                <div
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  className={`p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition ${
                    selectedEmail?.id === email.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">
                        {email.contacts?.fullName || email.email || 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {email.email}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 ml-2">
                      {formatDate(email.createdAt)}
                    </div>
                  </div>
                  <div className="text-sm text-gray-700 truncate">
                    {email.subject || '(No subject)'}
                  </div>
                  {email.responseFromEmail && (
                    <div className="text-xs text-blue-600 mt-1">↩️ Response</div>
                  )}
                </div>
              ))}
            </div>

            {/* Email Detail */}
            {selectedEmail && (
              <div className="border rounded-lg p-6 bg-white">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold">Email Details</h3>
                  <button
                    onClick={() => setShowRaw(!showRaw)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {showRaw ? 'Show Parsed' : 'Show Raw'}
                  </button>
                </div>

                {showRaw ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-600 block mb-2">Raw Email</label>
                      <pre className="p-3 bg-gray-100 rounded text-xs overflow-auto max-h-96 whitespace-pre-wrap">
                        {selectedEmail.emailRawText || '(No raw text)'}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Show when we have raw text but nothing was parsed — parsing failed or no content */}
                    {selectedEmail.emailRawText && !selectedEmail.subject && !selectedEmail.body && !selectedEmail.email && (
                      <div className="rounded-md bg-amber-50 border border-amber-200 p-3 mb-4">
                        <p className="text-sm text-amber-800">
                          <strong>Parsing pending or failed.</strong> This inbound had no body (or the parser failed). Check server logs for <code className="text-xs bg-amber-100 px-1">[inbound-email] Parsed result</code> and <code className="text-xs bg-amber-100 px-1">Parse failed</code>.
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-semibold text-gray-600 block mb-1">From</label>
                      <div>
                        {selectedEmail.contacts?.fullName && (
                          <div className="font-medium">{selectedEmail.contacts.fullName}</div>
                        )}
                        <div className="text-sm text-gray-600">{selectedEmail.email || '(No email parsed)'}</div>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-600 block mb-1">Subject</label>
                      <div>{selectedEmail.subject || '(No subject)'}</div>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-600 block mb-1">Body</label>
                      <div className="p-3 bg-gray-50 rounded text-sm whitespace-pre-wrap max-h-64 overflow-auto">
                        {selectedEmail.body || '(No body)'}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-600 block mb-1">Contact</label>
                      <div>
                        {selectedEmail.contacts ? (
                          <a
                            href={`/contacts/${selectedEmail.contacts.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {selectedEmail.contacts.fullName || selectedEmail.contacts.email}
                          </a>
                        ) : (
                          <span className="text-gray-500">Not matched</span>
                        )}
                      </div>
                    </div>

                    {selectedEmail.responseFromEmail && (
                      <div>
                        <label className="text-sm font-semibold text-gray-600 block mb-1">Status</label>
                        <div className="text-blue-600">↩️ Response to previous email</div>
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-semibold text-gray-600 block mb-1">Received</label>
                      <div className="text-sm text-gray-600">
                        {formatDate(selectedEmail.createdAt)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
