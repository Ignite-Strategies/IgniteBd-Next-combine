'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Calendar, ChevronRight, Download, Send, X, Loader2, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import { getTodayEST, formatDateLabelEST, formatDateEST } from '@/lib/dateEst';

/**
 * nextEngagementDate is date-only "YYYY-MM-DD". Group by that string; labels use EST "today" for Due today/tomorrow.
 * Hydrate: all contacts with nextEngagementDate set. Show all, grouped by date (Due today, Tomorrow, or date).
 * No "alerts" / notifications yet — just the list. See docs/NEXT_ENGAGEMENT_UX_ROADMAP.md for future (email, in-app).
 */
export default function NextEngagementContainer({
  companyHQId,
  limit = 500,
  compact = false,
  showSeeAll = true,
}) {
  const router = useRouter();
  const [nextEngagements, setNextEngagements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolvedCompanyId, setResolvedCompanyId] = useState(companyHQId || null);
  const [showSendEmailModal, setShowSendEmailModal] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState(null);
  const [emailSuccess, setEmailSuccess] = useState(false);

  const todayEST = getTodayEST();

  useEffect(() => {
    const id = companyHQId || (typeof window !== 'undefined' && (window.localStorage?.getItem('companyHQId') || window.localStorage?.getItem('companyId')));
    setResolvedCompanyId(id || null);
  }, [companyHQId]);

  useEffect(() => {
    if (!resolvedCompanyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.get(`/api/outreach/next-engagements`, {
      params: { companyHQId: resolvedCompanyId, limit },
    })
      .then((res) => {
        if (!cancelled && res.data?.success) {
          setNextEngagements(res.data.nextEngagements || []);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.error || 'Failed to load next engagements');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [resolvedCompanyId, limit]);

  const groupByDate = (list) => {
    const groups = {};
    for (const r of list) {
      const key = r.nextEngagementDate || '';
      if (!key) continue;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  };

  const sectionTitle = (estDateKey) => {
    const { label, actual } = formatDateLabelEST(todayEST, estDateKey);
    if (label === 'Today') return 'Due today';
    if (label === 'Tomorrow') return 'Due tomorrow';
    if (label === 'Yesterday') return 'Yesterday';
    return actual || estDateKey;
  };

  const name = (r) => [r.firstName, r.lastName].filter(Boolean).join(' ').trim() || r.email || '—';

  const purposeLabel = (purpose) => {
    if (!purpose) return 'Follow-up';
    const labels = {
      GENERAL_CHECK_IN: 'General check-in',
      UNRESPONSIVE: 'Unresponsive',
      PERIODIC_CHECK_IN: 'Periodic check-in',
      REFERRAL_NO_CONTACT: 'Referral (no contact)',
    };
    return labels[purpose] || purpose;
  };

  const engagementTypeLabel = (type) => {
    const labels = {
      OUTBOUND_EMAIL: 'outbound',
      CONTACT_RESPONSE: 'response',
      MEETING: 'meeting',
      MANUAL: 'manual',
    };
    return labels[type] || type;
  };

  const lastEngagementSnippet = (r) => {
    if (!r.lastEngagementDate) return null;
    const dateStr = formatDateEST(r.lastEngagementDate.slice(0, 10), { month: 'short', day: 'numeric' });
    const typeStr = r.lastEngagementType ? engagementTypeLabel(r.lastEngagementType) : '';
    return `Last: ${dateStr}${typeStr ? ` (${typeStr})` : ''}`;
  };

  const handleExport = () => {
    if (nextEngagements.length === 0) return;
    const headers = ['Name', 'Email', 'Date', 'Purpose', 'Note'];
    const rows = nextEngagements.map((r) => [
      name(r),
      r.email || '',
      r.nextEngagementDate || '',
      purposeLabel(r.nextEngagementPurpose),
      (r.nextContactNote || '').replace(/"/g, '""'),
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.map((c) => `"${String(c)}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `next-engagements-${todayEST}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendEmail = async () => {
    if (!resolvedCompanyId) {
      setEmailError('Company ID is required');
      return;
    }

    if (!recipientEmail) {
      setEmailError('Recipient email is required');
      return;
    }

    try {
      setSendingEmail(true);
      setEmailError(null);
      setEmailSuccess(false);

      const response = await api.post('/api/outreach/send-next-engagement-email', {
        recipientName: recipientName || undefined,
        recipientEmail,
        companyHQId: resolvedCompanyId,
        customMessage: customMessage || undefined,
      });

      if (response.data?.success) {
        setEmailSuccess(true);
        setRecipientName('');
        setRecipientEmail('');
        setCustomMessage('');
        setTimeout(() => {
          setShowSendEmailModal(false);
          setEmailSuccess(false);
        }, 2000);
      } else {
        setEmailError(response.data?.error || 'Failed to send email');
      }
    } catch (err) {
      console.error('Failed to send next engagement email:', err);
      setEmailError(err.response?.data?.error || err.message || 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  if (!resolvedCompanyId) return null;

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8">
        <div className="flex items-center gap-3 text-gray-500">
          <Mail className="h-6 w-6" />
          <span className="text-base">Loading next engagements…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-5">
        <p className="text-base text-red-800">{error}</p>
      </div>
    );
  }

  const grouped = groupByDate(nextEngagements);

  // Dashboard = compact preview (day-only labels). Tracker = full page uses this with compact=false.
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className={`flex items-center justify-between border-b border-gray-100 ${compact ? 'px-4 py-2.5' : 'px-5 py-4'}`}>
        <div>
          <div className="flex items-center gap-2">
            <Mail className={`text-amber-600 ${compact ? 'h-5 w-5' : 'h-6 w-6'}`} />
            <h3 className={compact ? 'text-base font-semibold text-gray-900' : 'text-lg font-semibold text-gray-900'}>Next engagements</h3>
          </div>
          <p className={compact ? 'mt-0.5 text-xs font-medium text-amber-700/90' : 'mt-1 text-sm font-medium text-amber-700/90'}>Sorted by date</p>
        </div>
        <div className={`flex items-center ${compact ? 'gap-2' : 'gap-4'}`}>
          <button
            type="button"
            onClick={handleExport}
            disabled={nextEngagements.length === 0}
            className={`flex items-center gap-1.5 font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed ${compact ? 'text-sm' : 'gap-2 text-base'}`}
            title="Download as CSV"
          >
            <Download className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
            Export
          </button>
          <button
            type="button"
            onClick={() => setShowSendEmailModal(true)}
            disabled={nextEngagements.length === 0}
            className={`flex items-center gap-1.5 font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed ${compact ? 'text-sm' : 'gap-2 text-base'}`}
            title="Send next engagement report via email"
          >
            <Send className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
            Email
          </button>
          {showSeeAll && (
            <button
              type="button"
              onClick={() => router.push(`/outreach/tracker?companyHQId=${resolvedCompanyId}`)}
              className={`font-medium text-amber-600 hover:text-amber-700 ${compact ? 'text-sm' : 'text-base'}`}
            >
              See all
            </button>
          )}
        </div>
      </div>
      <div className={compact ? 'max-h-64 overflow-y-auto' : ''}>
        {grouped.length === 0 ? (
          <div className={compact ? 'p-4 text-center text-sm text-gray-500' : 'p-8 text-center text-base text-gray-500'}>
            No next engagements.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {grouped.map(([dateKey, items]) => (
              <li key={dateKey}>
                <div className={compact ? 'bg-amber-50/80 px-4 py-2 text-xs font-semibold text-gray-700 border-l-2 border-amber-400' : 'bg-amber-50/80 px-5 py-3 text-sm font-semibold text-gray-700 border-l-2 border-amber-400'}>
                  <Calendar className={compact ? 'mr-1.5 inline h-3.5 w-3.5 text-amber-600' : 'mr-2 inline h-4 w-4 text-amber-600'} />
                  <span className="text-amber-800">{sectionTitle(dateKey)}</span>
                </div>
                <ul className="divide-y divide-gray-50">
                  {items.map((r) => (
                    <li key={r.contactId}>
                      <button
                        type="button"
                        onClick={() => router.push(`/contacts/${r.contactId}`)}
                        className={`flex w-full items-center justify-between text-left hover:bg-gray-50 ${compact ? 'px-4 py-2.5' : 'px-5 py-4'}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className={`truncate font-medium text-gray-900 ${compact ? 'text-sm' : 'text-base'}`}>{name(r)}</p>
                            {r.title && !compact && (
                              <span className="text-xs text-gray-400 truncate max-w-[180px]">{r.title}</span>
                            )}
                          </div>
                          <p className={`truncate text-gray-500 ${compact ? 'text-xs' : 'text-sm'}`}>
                            {r.company && <span className="font-medium text-gray-600">{r.company}</span>}
                            {r.company && ' · '}
                            {purposeLabel(r.nextEngagementPurpose)}
                            {r.nextContactNote && ` · ${r.nextContactNote}`}
                          </p>
                          {!compact && (
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-gray-400">
                              {lastEngagementSnippet(r) && <span>{lastEngagementSnippet(r)}</span>}
                              {r.stage && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-500">{r.stage}</span>}
                            </div>
                          )}
                          {r.engagementSummary && !compact && (
                            <p className="mt-0.5 truncate text-xs font-medium text-indigo-700">
                              {r.engagementSummary}
                            </p>
                          )}
                        </div>
                        <ChevronRight className={`shrink-0 text-gray-400 ${compact ? 'h-4 w-4' : 'h-5 w-5'}`} />
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Send Email Modal */}
      {showSendEmailModal && (() => {
        // Same as 1:1 compose: resolve sender from localStorage owner
        const owner = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('owner') || 'null') : null;
        const senderEmail = owner?.sendgridVerifiedEmail || null;
        const senderName = owner?.sendgridVerifiedName || null;
        const hasVerifiedSender = !!senderEmail;

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Send Next Engagement Report</h3>
              <button
                type="button"
                onClick={() => {
                  setShowSendEmailModal(false);
                  setEmailError(null);
                  setEmailSuccess(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-4">
              {/* From — same as 1:1 compose */}
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 mb-1">From</p>
                {!hasVerifiedSender ? (
                  <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
                    <p className="text-sm text-amber-800">Sender email not configured</p>
                    <a
                      href="/outreach/sender-verify"
                      className="text-sm font-medium text-amber-700 hover:text-amber-800 mt-1 inline-block"
                    >
                      Verify sender email →
                    </a>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    <span className="text-sm text-gray-900">{senderName || senderEmail}</span>
                    <span className="text-gray-500">&lt;{senderEmail}&gt;</span>
                  </div>
                )}
              </div>

              {emailSuccess && (
                <div className="mb-4 rounded-md bg-green-50 border border-green-200 p-3">
                  <p className="text-sm text-green-800">✅ Email sent successfully!</p>
                </div>
              )}

              {emailError && (
                <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3">
                  <p className="text-sm text-red-800">{emailError}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="recipientName" className="block text-sm font-medium text-gray-700 mb-1">
                    Recipient Name (Optional)
                  </label>
                  <input
                    type="text"
                    id="recipientName"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 text-sm"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label htmlFor="recipientEmail" className="block text-sm font-medium text-gray-700 mb-1">
                    Recipient Email *
                  </label>
                  <input
                    type="email"
                    id="recipientEmail"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 text-sm"
                    placeholder="recipient@example.com"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="customMessage" className="block text-sm font-medium text-gray-700 mb-1">
                    Custom Message (Optional)
                  </label>
                  <textarea
                    id="customMessage"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 text-sm"
                    placeholder="e.g., See below for your weekly reminders"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    This message will appear at the top of the email
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleSendEmail}
                    disabled={sendingEmail || !hasVerifiedSender || !recipientEmail || !resolvedCompanyId}
                    className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingEmail ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Email
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSendEmailModal(false);
                      setEmailError(null);
                      setEmailSuccess(false);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
