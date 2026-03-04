'use client';

import { useState, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import { Inbox, Mail, Calendar, FileText, Trash2, Sparkles } from 'lucide-react';
import api from '@/lib/api';

/**
 * Inbound Parse Page
 *
 * Route: /inbound-parse
 *
 * View all emails received via SendGrid Inbound Parse (InboundEmail model).
 * Actions: Delete, Push to AI (parse → create EmailActivity).
 */
export default function InboundParsePage() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  const [companyHQId, setCompanyHQId] = useState(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  useEffect(() => {
    // Get companyHQId from localStorage (company-scoped like rest of repo)
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
      const res = await api.get(`/api/inbound-parse?companyHQId=${tenantId}`);
      if (res.data?.success) {
        setEmails(res.data.emails || []);
      }
    } catch (error) {
      console.error('Error fetching inbound parse emails:', error);
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

  const extractEmailAddress = (emailString) => {
    if (!emailString) return null;
    // Extract email from "Name <email@domain.com>" format
    const match = emailString.match(/<([^>]+)>/) || emailString.match(/([^\s<>]+@[^\s<>]+)/);
    return match ? match[1] : emailString;
  };

  const extractName = (emailString) => {
    if (!emailString) return null;
    const match = emailString.match(/^([^<]+)</);
    return match ? match[1].trim() : null;
  };

  const handleDelete = async (e) => {
    e?.stopPropagation?.();
    if (!selectedEmail) return;
    if (!confirm('Delete this inbound email? This cannot be undone.')) return;
    setActionMessage(null);
    setDeleteLoading(true);
    try {
      await api.delete(`/api/inbound-parse/${selectedEmail.id}`);
      setEmails((prev) => prev.filter((x) => x.id !== selectedEmail.id));
      setSelectedEmail(null);
      setActionMessage({ type: 'success', text: 'Deleted' });
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Delete failed',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handlePushToAi = async (e) => {
    e?.stopPropagation?.();
    if (!selectedEmail) return;
    setActionMessage(null);
    setPushLoading(true);
    try {
      const res = await api.post('/api/inbound-parse/push-to-ai', {
        inboundEmailId: selectedEmail.id,
      });
      const { emailActivityId, parsed } = res.data;
      setEmails((prev) =>
        prev.map((x) =>
          x.id === selectedEmail.id ? { ...x, ingestionStatus: 'PROMOTED' } : x
        )
      );
      setSelectedEmail((prev) =>
        prev ? { ...prev, ingestionStatus: 'PROMOTED' } : null
      );
      setActionMessage({
        type: 'success',
        text: parsed?.contactEmail
          ? `Promoted → EmailActivity. Contact: ${parsed.contactEmail}`
          : `Promoted → EmailActivity`,
      });
      setTimeout(() => setActionMessage(null), 5000);
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Push to AI failed',
      });
    } finally {
      setPushLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <PageHeader title="Inbound Parse" subtitle="Loading..." />
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
          title="Inbound Parse"
          subtitle="Raw emails received via SendGrid Inbound Parse"
        />

        {emails.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 shadow-lg text-center">
            <Inbox className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No inbound emails yet</h3>
            <p className="text-sm text-gray-500">
              Emails sent to your SendGrid Inbound Parse address will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Email List */}
            <div className="space-y-2">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Recent Emails ({emails.length})</h2>
                <button
                  onClick={fetchInboundEmails}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Refresh
                </button>
              </div>
              {emails.map((email) => {
                const fromEmail = extractEmailAddress(email.from);
                const fromName = extractName(email.from);
                return (
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
                          {fromName || fromEmail || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {fromEmail || email.from || 'No sender'}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                        {formatDate(email.createdAt)}
                      </div>
                    </div>
                    <div className="text-sm text-gray-700 truncate">
                      {email.subject || '(No subject)'}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                      {email.text && (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          Text
                        </span>
                      )}
                      {email.html && (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          HTML
                        </span>
                      )}
                      {email.email && (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          Raw MIME
                        </span>
                      )}
                      {email.ingestionStatus && (
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          email.ingestionStatus === 'PROMOTED'
                            ? 'bg-indigo-100 text-indigo-700'
                            : email.ingestionStatus === 'RECEIVED'
                            ? 'bg-green-100 text-green-700'
                            : email.ingestionStatus === 'FAILED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {email.ingestionStatus}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Email Detail */}
            {selectedEmail && (
              <div className="border rounded-lg p-6 bg-white">
                <div className="flex flex-wrap justify-between items-start gap-2 mb-4">
                  <h3 className="text-lg font-semibold">Email Details</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setShowRaw(!showRaw)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {showRaw ? 'Show Parsed' : 'Show Raw'}
                    </button>
                    <button
                      onClick={handlePushToAi}
                      disabled={
                        pushLoading ||
                        selectedEmail.ingestionStatus === 'PROMOTED' ||
                        !(selectedEmail.text || selectedEmail.html || selectedEmail.email)
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sparkles className="h-4 w-4" />
                      {pushLoading ? 'Parsing…' : 'Push to AI'}
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleteLoading}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deleteLoading ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
                {actionMessage && (
                  <div
                    className={`mb-4 px-3 py-2 rounded text-sm ${
                      actionMessage.type === 'success'
                        ? 'bg-green-50 text-green-800'
                        : 'bg-red-50 text-red-800'
                    }`}
                  >
                    {actionMessage.text}
                  </div>
                )}

                {showRaw ? (
                  <div className="space-y-4">
                    {selectedEmail.email && (
                      <div>
                        <label className="text-sm font-semibold text-gray-600 block mb-2">Raw MIME (SendGrid "email" field - full MIME when "Include Raw" enabled)</label>
                        <pre className="p-3 bg-gray-100 rounded text-xs overflow-auto max-h-96 whitespace-pre-wrap">
                          {selectedEmail.email}
                        </pre>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-semibold text-gray-600 block mb-2">Headers</label>
                      <pre className="p-3 bg-gray-100 rounded text-xs overflow-auto max-h-64 whitespace-pre-wrap">
                        {selectedEmail.headers || '(No headers)'}
                      </pre>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-600 block mb-2">Text Body</label>
                      <pre className="p-3 bg-gray-100 rounded text-xs overflow-auto max-h-64 whitespace-pre-wrap">
                        {selectedEmail.text || '(No text body)'}
                      </pre>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-600 block mb-2">HTML Body</label>
                      <div className="p-3 bg-gray-100 rounded text-xs overflow-auto max-h-64">
                        {selectedEmail.html ? (
                          <div dangerouslySetInnerHTML={{ __html: selectedEmail.html }} />
                        ) : (
                          '(No HTML body)'
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-600 block mb-1 flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        From
                      </label>
                      <div>
                        {extractName(selectedEmail.from) && (
                          <div className="font-medium">{extractName(selectedEmail.from)}</div>
                        )}
                        <div className="text-sm text-gray-600">
                          {extractEmailAddress(selectedEmail.from) || selectedEmail.from || '(No sender)'}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-600 block mb-1 flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        To
                      </label>
                      <div className="text-sm text-gray-600">
                        {selectedEmail.to || '(No recipient)'}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-600 block mb-1 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Subject
                      </label>
                      <div>{selectedEmail.subject || '(No subject)'}</div>
                    </div>

                    {selectedEmail.text && (
                      <div>
                        <label className="text-sm font-semibold text-gray-600 block mb-1">Text Body</label>
                        <div className="p-3 bg-gray-50 rounded text-sm whitespace-pre-wrap max-h-64 overflow-auto">
                          {selectedEmail.text}
                        </div>
                      </div>
                    )}

                    {selectedEmail.html && (
                      <div>
                        <label className="text-sm font-semibold text-gray-600 block mb-1">HTML Body</label>
                        <div className="p-3 bg-gray-50 rounded text-sm max-h-64 overflow-auto border">
                          <div dangerouslySetInnerHTML={{ __html: selectedEmail.html }} />
                        </div>
                      </div>
                    )}

                    {/* Forwarded emails (e.g. from Outlook) skip text/html — full content is in the 'email' MIME field */}
                    {!selectedEmail.text && !selectedEmail.html && selectedEmail.email && (
                      <div>
                        <label className="text-sm font-semibold text-gray-600 block mb-1">
                          Content (Raw MIME — forwarded email)
                        </label>
                        <div className="rounded border border-amber-200 bg-amber-50 p-2 mb-2">
                          <p className="text-xs text-amber-700">
                            SendGrid sent this as raw MIME (no parsed text/html). Content is base64-encoded inside the MIME body below. Switch to <strong>Show Raw</strong> for the full MIME.
                          </p>
                        </div>
                        <pre className="p-3 bg-gray-50 rounded text-xs overflow-auto max-h-64 whitespace-pre-wrap">
                          {selectedEmail.email.substring(0, 2000)}{selectedEmail.email.length > 2000 ? `\n\n... (${selectedEmail.email.length} chars total — click Show Raw for full content)` : ''}
                        </pre>
                      </div>
                    )}

                    {selectedEmail.headers && (
                      <div>
                        <label className="text-sm font-semibold text-gray-600 block mb-1">Headers</label>
                        <pre className="p-3 bg-gray-50 rounded text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                          {selectedEmail.headers}
                        </pre>
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-semibold text-gray-600 block mb-1 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Received
                      </label>
                      <div className="text-sm text-gray-600">
                        {formatDate(selectedEmail.createdAt)}
                      </div>
                    </div>

                    {selectedEmail.ingestionStatus && (
                      <div>
                        <label className="text-sm font-semibold text-gray-600 block mb-1">Status</label>
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          selectedEmail.ingestionStatus === 'PROMOTED'
                            ? 'bg-indigo-100 text-indigo-700'
                            : selectedEmail.ingestionStatus === 'RECEIVED'
                            ? 'bg-green-100 text-green-700'
                            : selectedEmail.ingestionStatus === 'FAILED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {selectedEmail.ingestionStatus}
                        </span>
                      </div>
                    )}
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
