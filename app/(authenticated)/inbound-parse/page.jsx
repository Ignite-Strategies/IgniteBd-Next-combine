'use client';

import { useState, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import {
  Inbox,
  Mail,
  Calendar,
  FileText,
  Trash2,
  Sparkles,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  History,
  Zap,
  User,
} from 'lucide-react';
import api from '@/lib/api';

const ACTIVITY_TYPE_CONFIG = {
  inbound_email:  { label: 'Inbound Email',  color: 'bg-blue-100 text-blue-800' },
  outbound_email: { label: 'Outbound Email', color: 'bg-emerald-100 text-emerald-800' },
  call_note:      { label: 'Call Note → Meeting', color: 'bg-purple-100 text-purple-800' },
  meeting_note:   { label: 'Meeting Note → Meeting', color: 'bg-purple-100 text-purple-800' },
  note:           { label: 'General Note',   color: 'bg-gray-100 text-gray-700' },
};

function ActivityTypeBadge({ type }) {
  const config = ACTIVITY_TYPE_CONFIG[type] || { label: type, color: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

/**
 * Inbound Parse Page
 *
 * Route: /inbound-parse
 *
 * View all emails received via SendGrid Inbound Parse (InboundEmail model).
 * Flow: Analyze (parse + AI interpret + contact lookup) → confirm contact → Record Activity.
 *
 * The standalone "Parse" button has been retired — the SendGrid webhook already saves
 * the full raw email at ingest, so there is nothing left to "cleanly save". Analyze
 * (formerly Interpret) is now the single preview step.
 */
export default function InboundParsePage() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  const [companyHQId, setCompanyHQId] = useState(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [parseResult, setParseResult] = useState(null);
  const [nextEngageOverride, setNextEngageOverride] = useState('');
  const [contactEmailOverride, setContactEmailOverride] = useState('');
  const [contactNameOverride, setContactNameOverride] = useState('');
  const [contactIdOverride, setContactIdOverride] = useState(null);
  const [confirmOrphan, setConfirmOrphan] = useState(false);
  const [computeLoading, setComputeLoading] = useState(false);
  const [recordedContactId, setRecordedContactId] = useState(null);
  const [createContactLoading, setCreateContactLoading] = useState(false);

  useEffect(() => {
    const crmId =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('companyHQId') ||
          window.localStorage.getItem('companyId') ||
          null
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
    const match =
      emailString.match(/<([^>]+)>/) || emailString.match(/([^\s<>]+@[^\s<>]+)/);
    return match ? match[1] : emailString;
  };

  const extractName = (emailString) => {
    if (!emailString) return null;
    const match = emailString.match(/^([^<]+)</);
    return match ? match[1].trim() : null;
  };

  const resetDetailState = () => {
    setParseResult(null);
    setContactEmailOverride('');
    setContactNameOverride('');
    setContactIdOverride(null);
    setNextEngageOverride('');
    setConfirmOrphan(false);
    setRecordedContactId(null);
    setActionMessage(null);
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
      resetDetailState();
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Delete failed',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  // Single "Analyze" step: parse + AI interpret + contact lookup + name fallback
  const handleAnalyze = async (e) => {
    e?.stopPropagation?.();
    if (!selectedEmail) return;
    setActionMessage(null);
    setAnalyzeLoading(true);
    setParseResult(null);
    setContactIdOverride(null);
    setConfirmOrphan(false);
    try {
      const res = await api.post('/api/inbound-parse/interpret', {
        inboundEmailId: selectedEmail.id,
      });
      if (res.data?.success) {
        setParseResult(res.data);
        setContactEmailOverride(res.data.parsed?.contactEmail || '');
        setContactNameOverride(res.data.parsed?.contactName || '');
        setNextEngageOverride(res.data.nextEngage?.recommended || '');
        if (res.data.alreadyIngested) {
          setActionMessage({
            type: 'error',
            text: 'This email may already be ingested. Check history below.',
          });
        }
      } else {
        setActionMessage({ type: 'error', text: res.data?.error || 'Analyze failed' });
      }
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Analyze failed',
      });
    } finally {
      setAnalyzeLoading(false);
    }
  };

  const handlePushToAi = async (e) => {
    e?.stopPropagation?.();
    if (!selectedEmail) return;

    // Orphan gate: no email and no name-match selected → require confirmation
    const hasContact = contactEmailOverride || contactIdOverride;
    if (!hasContact && !confirmOrphan) {
      setConfirmOrphan(true);
      return;
    }

    setActionMessage(null);
    setPushLoading(true);
    setRecordedContactId(null);
    setConfirmOrphan(false);
    try {
      const payload = { inboundEmailId: selectedEmail.id };
      if (nextEngageOverride) payload.nextEngagementDate = nextEngageOverride;
      if (contactEmailOverride) payload.contactEmail = contactEmailOverride;
      if (contactIdOverride) payload.contactIdOverride = contactIdOverride;
      if (parseResult?.interpretation) payload.interpretation = parseResult.interpretation;
      const res = await api.post('/api/inbound-parse/push-to-ai', payload);
      const { parsed, contactId, recordType } = res.data;
      if (contactId) setRecordedContactId(contactId);
      setEmails((prev) =>
        prev.map((x) =>
          x.id === selectedEmail.id ? { ...x, ingestionStatus: 'PROMOTED' } : x
        )
      );
      setSelectedEmail((prev) =>
        prev ? { ...prev, ingestionStatus: 'PROMOTED' } : null
      );
      const contactLabel = parsed?.contactEmail
        ? `Contact: ${parsed.contactEmail}`
        : contactId
        ? 'Contact linked by name'
        : 'No contact linked';
      const recordLabel = recordType || 'Activity';
      const summarySnip = parsed?.summary ? ` | ${parsed.summary.slice(0, 80)}` : '';
      setActionMessage({
        type: 'success',
        text: parsed?.nextEngagementDate
          ? `Recorded → ${recordLabel}. ${contactLabel} · Next engage: ${parsed.nextEngagementDate}${summarySnip}`
          : `Recorded → ${recordLabel}. ${contactLabel}${summarySnip}`,
      });
      setTimeout(() => setActionMessage(null), 8000);
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Record failed',
      });
    } finally {
      setPushLoading(false);
    }
  };

  const handleCreateContact = async () => {
    const nameParts = (contactNameOverride || parseResult?.parsed?.contactName || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    if (!firstName && !lastName) {
      setActionMessage({
        type: 'error',
        text: 'Please enter a contact name in Step 1 before creating a contact.',
      });
      return;
    }

    const email = contactEmailOverride || parseResult?.parsed?.contactEmail || '';
    if (!email) {
      setActionMessage({
        type: 'error',
        text: 'Email is required to create a contact. Please enter an email address in Step 1.',
      });
      return;
    }

    setCreateContactLoading(true);
    setActionMessage(null);
    try {
      const res = await api.post('/api/contacts/create', {
        crmId: companyHQId,
        firstName,
        lastName,
        email,
      });
      if (res.data?.success && res.data?.contact) {
        const newContactId = res.data.contact.id;
        setContactIdOverride(newContactId);
        setContactEmailOverride(email);
        setActionMessage({
          type: 'success',
          text: `Contact created: ${firstName} ${lastName} (${email})`,
        });
        // Refresh the analyze result to show the new contact
        setTimeout(() => {
          handleAnalyze({ stopPropagation: () => {} });
        }, 1000);
      } else {
        setActionMessage({
          type: 'error',
          text: res.data?.error || 'Failed to create contact',
        });
      }
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Create contact failed',
      });
    } finally {
      setCreateContactLoading(false);
    }
  };

  const handleComputeEngagement = async (e) => {
    e?.stopPropagation?.();
    const cId = recordedContactId || parseResult?.contact?.id;
    if (!cId) return;
    setComputeLoading(true);
    setActionMessage(null);
    try {
      const res = await api.post(`/api/contacts/${cId}/compute-engagement`);
      const { nextEngagementDate, source } = res.data;
      const sourceLabel =
        {
          ai_summary: 'inferred from activity summary',
          default_cadence: 'default +7 days',
          already_set: 'already set on contact',
          do_not_contact: 'do not contact',
          no_engagement: 'no prior engagement',
        }[source] ||
        source ||
        '';
      setActionMessage({
        type: 'success',
        text: nextEngagementDate
          ? `Engagement → ${nextEngagementDate} (${sourceLabel})`
          : `No engagement date computed (${sourceLabel})`,
      });
      setTimeout(() => setActionMessage(null), 6000);
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Compute failed',
      });
    } finally {
      setComputeLoading(false);
    }
  };

  const isPromoted = selectedEmail?.ingestionStatus === 'PROMOTED';
  const hasContent = !!(selectedEmail?.text || selectedEmail?.html || selectedEmail?.email);

  if (loading) {
    return (
      <div className="py-8">
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
    <div className="py-8">
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
                  onClick={() => fetchInboundEmails(companyHQId)}
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
                    onClick={() => {
                      setSelectedEmail(email);
                      resetDetailState();
                    }}
                    className={`p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition ${
                      selectedEmail?.id === email.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200'
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
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            email.ingestionStatus === 'PROMOTED'
                              ? 'bg-indigo-100 text-indigo-700'
                              : email.ingestionStatus === 'RECEIVED'
                              ? 'bg-green-100 text-green-700'
                              : email.ingestionStatus === 'FAILED'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
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
                {/* Action bar */}
                <div className="flex flex-wrap justify-between items-start gap-2 mb-4">
                  <h3 className="text-lg font-semibold">Email Details</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setShowRaw(!showRaw)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {showRaw ? 'Show Parsed' : 'Show Raw'}
                    </button>

                    {/* Analyze (formerly Parse + Interpret combined) */}
                    <button
                      onClick={handleAnalyze}
                      disabled={analyzeLoading || isPromoted || !hasContent}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Parse + AI interpret in one step. Shows contact match, history, and next engagement before you record."
                    >
                      <Sparkles className="h-4 w-4" />
                      {analyzeLoading ? 'Analyzing…' : 'Analyze'}
                    </button>

                    {/* Record Activity */}
                    <button
                      onClick={handlePushToAi}
                      disabled={pushLoading || isPromoted || !hasContent}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Write email activity to CRM and mark this email as Promoted."
                    >
                      <Sparkles className="h-4 w-4" />
                      {pushLoading ? 'Recording…' : 'Record Activity'}
                    </button>

                    {/* Calculate Engagement (post-record) */}
                    {(recordedContactId || parseResult?.contact?.id) && (
                      <button
                        onClick={handleComputeEngagement}
                        disabled={computeLoading}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Re-compute the contact's next engagement date from their activity history."
                      >
                        <Zap className="h-4 w-4" />
                        {computeLoading ? 'Computing…' : 'Calculate Engagement'}
                      </button>
                    )}

                    <button
                      onClick={handleDelete}
                      disabled={deleteLoading}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                      title="Permanently delete this inbound email record."
                    >
                      <Trash2 className="h-4 w-4" />
                      {deleteLoading ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>

                {/* Action message */}
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

                {/* View Contact link (shown after successful Record Activity) */}
                {recordedContactId && (
                  <a
                    href={`/contacts/${recordedContactId}`}
                    className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline mb-4"
                  >
                    <ArrowRight className="h-4 w-4" />
                    View Contact
                  </a>
                )}

                {/* Orphan confirmation gate */}
                {confirmOrphan && (
                  <div className="mb-4 p-3 rounded-lg border-2 border-orange-300 bg-orange-50">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-orange-800">No contact linked</p>
                        <p className="text-xs text-orange-700 mt-0.5">
                          This activity will be recorded without linking to any contact. You can
                          link it manually later from the contact record.
                        </p>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={handlePushToAi}
                            disabled={pushLoading}
                            className="px-3 py-1.5 text-xs font-medium rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
                          >
                            {pushLoading ? 'Recording…' : 'Record anyway'}
                          </button>
                          <button
                            onClick={() => setConfirmOrphan(false)}
                            className="px-3 py-1.5 text-xs font-medium rounded-md bg-white border border-orange-300 text-orange-700 hover:bg-orange-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Analyze preview panel — 4 steps */}
                {parseResult && (
                  <div className="mb-6 space-y-4">
                    {/* ── Step 1: Parse & Confirm Contact ── */}
                    <div className="p-4 rounded-lg border-2 border-indigo-200 bg-indigo-50/50">
                      <h4 className="text-sm font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold">
                          1
                        </span>
                        Email & Contact Details
                        {parseResult.parsed?.activityType && (
                          <ActivityTypeBadge type={parseResult.parsed.activityType} />
                        )}
                      </h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="text-gray-600 font-medium w-28">Contact Name:</label>
                          <input
                            type="text"
                            value={contactNameOverride}
                            onChange={(e) => setContactNameOverride(e.target.value)}
                            className="px-2 py-1 rounded border border-gray-300 text-sm flex-1 min-w-[200px]"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="text-gray-600 font-medium w-28">Contact Email:</label>
                          <input
                            type="email"
                            value={contactEmailOverride}
                            onChange={(e) => {
                              setContactEmailOverride(e.target.value);
                              // Typing an email clears any name-match selection
                              if (e.target.value) setContactIdOverride(null);
                            }}
                            className="px-2 py-1 rounded border border-gray-300 text-sm flex-1 min-w-[200px]"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-gray-600 font-medium w-28">Subject:</span>
                          <span>{parseResult.parsed?.subject || '(none)'}</span>
                        </div>
                        {parseResult.parsed?.activityDate && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-gray-600 font-medium w-28">Activity Date:</span>
                            <span className="text-sm font-medium text-purple-800">
                              {parseResult.parsed.activityDate}
                            </span>
                            <span className="text-xs text-gray-500">(extracted from content — not email received date)</span>
                          </div>
                        )}
                        {parseResult.parsed?.isResponse && (
                          <span className="inline-block px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800">
                            Detected as response to outreach
                          </span>
                        )}
                        {parseResult.parsed?.summary && (
                          <div className="p-2 rounded bg-indigo-100/60 border border-indigo-200">
                            <span className="text-xs font-semibold text-indigo-800">
                              AI Summary:
                            </span>
                            <div className="text-sm text-indigo-900 mt-0.5">
                              {parseResult.parsed.summary}
                            </div>
                          </div>
                        )}
                        {parseResult.parsed?.body && (
                          <div>
                            <span className="text-gray-600 font-medium">Body:</span>
                            <div className="mt-1 p-2 rounded bg-white/80 text-gray-700 max-h-20 overflow-auto text-xs whitespace-pre-wrap">
                              {parseResult.parsed.body.slice(0, 300)}
                              {parseResult.parsed.body.length > 300 ? '…' : ''}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Step 2: Contact Lookup ── */}
                    <div
                      className={`p-4 rounded-lg border-2 ${
                        parseResult.contact
                          ? 'border-green-200 bg-green-50/50'
                          : parseResult.nameMatches?.length > 0
                          ? 'border-amber-200 bg-amber-50/50'
                          : 'border-red-200 bg-red-50/50'
                      }`}
                    >
                      <h4
                        className={`text-sm font-semibold mb-3 flex items-center gap-2 ${
                          parseResult.contact
                            ? 'text-green-900'
                            : parseResult.nameMatches?.length > 0
                            ? 'text-amber-900'
                            : 'text-red-900'
                        }`}
                      >
                        <span
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold ${
                            parseResult.contact
                              ? 'bg-green-600'
                              : parseResult.nameMatches?.length > 0
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          }`}
                        >
                          2
                        </span>
                        Contact Lookup
                      </h4>

                      {parseResult.contact ? (
                        // Exact email match found
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="font-medium">
                              {parseResult.contact.name || parseResult.contact.email}
                            </span>
                            {parseResult.contact.title && (
                              <span className="text-gray-500">· {parseResult.contact.title}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                            {parseResult.contact.company && (
                              <span>Company: {parseResult.contact.company}</span>
                            )}
                            {parseResult.contact.pipeline && (
                              <span>
                                Pipeline:{' '}
                                <span className="font-medium">{parseResult.contact.pipeline}</span>
                              </span>
                            )}
                            {parseResult.contact.optedOut && (
                              <span className="text-red-600 font-medium">OPTED OUT</span>
                            )}
                          </div>
                        </div>
                      ) : parseResult.nameMatches?.length > 0 ? (
                        // No email match but name-based candidates found
                        <div className="space-y-3 text-sm">
                          <div className="flex items-center gap-2 text-amber-800 text-xs">
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                            <span>
                              No exact email match. Select a contact below, type their email above
                              to create a new contact, or record without linking.
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {parseResult.nameMatches.map((match) => (
                              <button
                                key={match.id}
                                onClick={() => {
                                  setContactIdOverride(
                                    contactIdOverride === match.id ? null : match.id
                                  );
                                  // Clear email override when picking by name
                                  setContactEmailOverride('');
                                }}
                                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                                  contactIdOverride === match.id
                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                                    : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50/50'
                                }`}
                              >
                                <div className="flex items-center gap-1.5">
                                  <User className="h-3 w-3" />
                                  <span>{match.name}</span>
                                </div>
                                {(match.company || match.email) && (
                                  <div className="text-gray-400 font-normal mt-0.5">
                                    {match.company || match.email}
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                          {contactIdOverride && (
                            <div className="flex items-center gap-1.5 text-xs text-indigo-700">
                              <CheckCircle className="h-3.5 w-3.5" />
                              Contact selected — will be linked on Record Activity
                            </div>
                          )}
                        </div>
                      ) : (
                        // Nothing found
                        <div className="space-y-3 text-sm">
                          <div className="flex items-center gap-2 text-red-800">
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                            <span>
                              No contact found for &ldquo;
                              {contactEmailOverride ||
                                parseResult.parsed?.contactEmail ||
                                parseResult.parsed?.contactName ||
                                '(unknown)'}
                              &rdquo;.
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(contactNameOverride || parseResult?.parsed?.contactName) &&
                              (contactEmailOverride || parseResult?.parsed?.contactEmail) && (
                                <button
                                  onClick={handleCreateContact}
                                  disabled={createContactLoading}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <User className="h-3.5 w-3.5" />
                                  {createContactLoading ? 'Creating…' : 'Create Contact'}
                                </button>
                              )}
                            {(!contactNameOverride && !parseResult?.parsed?.contactName) && (
                              <span className="text-xs text-gray-600">
                                Enter contact name in Step 1 to create a contact.
                              </span>
                            )}
                            {(!contactEmailOverride && !parseResult?.parsed?.contactEmail) && (
                              <span className="text-xs text-gray-600">
                                Enter email address in Step 1 to create a contact.
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            Or you can record this activity without linking to a contact and link it
                            manually later.
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Step 3: Email History ── */}
                    <div className="p-4 rounded-lg border-2 border-slate-200 bg-slate-50/50">
                      <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-600 text-white text-xs font-bold">
                          3
                        </span>
                        Email History
                        {parseResult.alreadyIngested && (
                          <span className="ml-2 px-2 py-0.5 rounded text-xs bg-red-100 text-red-700 font-medium">
                            Possible duplicate
                          </span>
                        )}
                      </h4>
                      {parseResult.emailHistory?.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-auto">
                          {parseResult.emailHistory.map((h) => (
                            <div
                              key={h.id}
                              className="flex items-start gap-2 text-xs p-2 rounded bg-white border border-slate-100"
                            >
                              <span
                                className={`mt-0.5 inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                                  h.direction === 'inbound' ? 'bg-blue-400' : 'bg-emerald-400'
                                }`}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center gap-2">
                                  <span className="font-medium truncate">
                                    {h.subject || '(No subject)'}
                                  </span>
                                  <span className="text-gray-400 whitespace-nowrap">
                                    {formatDate(h.date)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-gray-500">
                                  <span>{h.direction === 'inbound' ? '← Contact' : '→ Outbound'}</span>
                                  <span>·</span>
                                  <span>{h.type}</span>
                                  {h.platform && (
                                    <>
                                      <span>·</span>
                                      <span>{h.platform}</span>
                                    </>
                                  )}
                                  {h.hasResponse && (
                                    <span className="text-green-600 font-medium">Has response</span>
                                  )}
                                </div>
                                {h.body && (
                                  <div className="text-gray-500 mt-1 truncate">{h.body}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                          <History className="h-4 w-4" />
                          {parseResult.contact
                            ? 'No email history for this contact yet'
                            : 'No contact matched — select a contact above to see history'}
                        </div>
                      )}
                    </div>

                    {/* ── Step 4: Next Engagement ── */}
                    <div className="p-4 rounded-lg border-2 border-blue-200 bg-blue-50/50">
                      <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold">
                          4
                        </span>
                        Next Engagement
                      </h4>
                      <div className="space-y-3 text-sm">
                        {parseResult.nextEngage?.currentOnContact && (
                          <div className="text-xs text-gray-600">
                            Currently on contact:{' '}
                            <span className="font-medium">
                              {parseResult.nextEngage.currentOnContact}
                            </span>
                            {parseResult.nextEngage.currentPurpose &&
                              ` (${parseResult.nextEngage.currentPurpose})`}
                          </div>
                        )}
                        {parseResult.nextEngage?.aiSuggested && (
                          <div className="text-xs text-indigo-700">
                            AI extracted:{' '}
                            <span className="font-medium">
                              {parseResult.nextEngage.aiSuggested}
                            </span>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="text-gray-600 font-medium">Set to:</label>
                          <input
                            type="date"
                            value={nextEngageOverride}
                            onChange={(e) => setNextEngageOverride(e.target.value)}
                            className="px-2 py-1 rounded border border-gray-300 text-sm"
                          />
                          <span className="text-xs text-gray-500">
                            Will update contact when promoted
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Raw / Parsed email view */}
                {showRaw ? (
                  <div className="space-y-4">
                    {selectedEmail.email && (
                      <div>
                        <label className="text-sm font-semibold text-gray-600 block mb-2">
                          Raw MIME (SendGrid &ldquo;email&rdquo; field - full MIME when &ldquo;Include Raw&rdquo; enabled)
                        </label>
                        <pre className="p-3 bg-gray-100 rounded text-xs overflow-auto max-h-96 whitespace-pre-wrap">
                          {selectedEmail.email}
                        </pre>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-semibold text-gray-600 block mb-2">
                        Headers
                      </label>
                      <pre className="p-3 bg-gray-100 rounded text-xs overflow-auto max-h-64 whitespace-pre-wrap">
                        {selectedEmail.headers || '(No headers)'}
                      </pre>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-600 block mb-2">
                        Text Body
                      </label>
                      <pre className="p-3 bg-gray-100 rounded text-xs overflow-auto max-h-64 whitespace-pre-wrap">
                        {selectedEmail.text || '(No text body)'}
                      </pre>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-600 block mb-2">
                        HTML Body
                      </label>
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
                          {extractEmailAddress(selectedEmail.from) ||
                            selectedEmail.from ||
                            '(No sender)'}
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
                        <label className="text-sm font-semibold text-gray-600 block mb-1">
                          Text Body
                        </label>
                        <div className="p-3 bg-gray-50 rounded text-sm whitespace-pre-wrap max-h-64 overflow-auto">
                          {selectedEmail.text}
                        </div>
                      </div>
                    )}

                    {selectedEmail.html && (
                      <div>
                        <label className="text-sm font-semibold text-gray-600 block mb-1">
                          HTML Body
                        </label>
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
                            SendGrid sent this as raw MIME (no parsed text/html). Content is
                            base64-encoded inside the MIME body below. Switch to{' '}
                            <strong>Show Raw</strong> for the full MIME.
                          </p>
                        </div>
                        <pre className="p-3 bg-gray-50 rounded text-xs overflow-auto max-h-64 whitespace-pre-wrap">
                          {selectedEmail.email.substring(0, 2000)}
                          {selectedEmail.email.length > 2000
                            ? `\n\n... (${selectedEmail.email.length} chars total — click Show Raw for full content)`
                            : ''}
                        </pre>
                      </div>
                    )}

                    {selectedEmail.headers && (
                      <div>
                        <label className="text-sm font-semibold text-gray-600 block mb-1">
                          Headers
                        </label>
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
                        <label className="text-sm font-semibold text-gray-600 block mb-1">
                          Status
                        </label>
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            selectedEmail.ingestionStatus === 'PROMOTED'
                              ? 'bg-indigo-100 text-indigo-700'
                              : selectedEmail.ingestionStatus === 'RECEIVED'
                              ? 'bg-green-100 text-green-700'
                              : selectedEmail.ingestionStatus === 'FAILED'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {selectedEmail.ingestionStatus}
                        </span>
                        {selectedEmail.ingestionStatus === 'PROMOTED' && (
                          <p className="text-xs text-gray-500 mt-1">
                            This email has been recorded as a CRM activity. Buttons above are
                            disabled.
                          </p>
                        )}
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
