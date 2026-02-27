'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Calendar, ChevronRight, Download, Send } from 'lucide-react';
import api from '@/lib/api';
import { getTodayEST, formatDateLabelEST } from '@/lib/dateEst';

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
          <span className={`flex items-center gap-1.5 font-medium text-gray-400 ${compact ? 'text-sm' : 'gap-2 text-base'}`} title="Email digest (coming soon)">
            <Send className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
            Email <span className={compact ? 'text-xs' : 'text-sm'}>(soon)</span>
          </span>
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
                          <p className={`truncate font-medium text-gray-900 ${compact ? 'text-sm' : 'text-base'}`}>{name(r)}</p>
                          <p className={`truncate text-gray-500 ${compact ? 'text-xs' : 'text-sm'}`}>
                            {purposeLabel(r.nextEngagementPurpose)}
                            {r.nextContactNote && ` · ${r.nextContactNote}`}
                          </p>
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
    </div>
  );
}
