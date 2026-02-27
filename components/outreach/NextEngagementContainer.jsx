'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Calendar, ChevronRight } from 'lucide-react';
import api from '@/lib/api';

// User's local today (YYYY-MM-DD) so "Due today" matches their calendar, not EST
function getTodayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayDiff(dateKey, todayStr) {
  if (!dateKey || !todayStr) return null;
  const a = new Date(dateKey + 'T12:00:00');
  const b = new Date(todayStr + 'T12:00:00');
  return Math.round((a - b) / (24 * 60 * 60 * 1000));
}

/**
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

  const todayLocal = getTodayLocal();

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

  const datePart = (iso) => (iso && iso.slice) ? iso.slice(0, 10) : '';
  const groupByDate = (list) => {
    const groups = {};
    for (const r of list) {
      const key = datePart(r.nextEngagementDate);
      if (!key) continue;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  };

  const sectionTitle = (dateKey) => {
    const diff = dayDiff(dateKey, todayLocal);
    if (diff === 0) return 'Due today';
    if (diff === 1) return 'Due tomorrow';
    if (diff === -1) return 'Yesterday';
    if (!dateKey) return '';
    const d = new Date(dateKey + 'T12:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
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

  if (!resolvedCompanyId) return null;

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2 text-gray-500">
          <Mail className="h-5 w-5" />
          <span className="text-sm">Loading next engagements…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-4">
        <p className="text-sm text-red-800">{error}</p>
      </div>
    );
  }

  const grouped = groupByDate(nextEngagements);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-amber-600" />
            <h3 className="text-base font-semibold text-gray-900">Next engagements</h3>
          </div>
          <p className="mt-0.5 text-xs font-medium text-amber-700/90">Sorted by date</p>
        </div>
        {showSeeAll && (
          <button
            type="button"
            onClick={() => router.push(`/outreach/tracker?companyHQId=${resolvedCompanyId}`)}
            className="text-sm font-medium text-amber-600 hover:text-amber-700"
          >
            See all
          </button>
        )}
      </div>
      <div className={compact ? 'max-h-64 overflow-y-auto' : ''}>
        {grouped.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            No next engagements.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {grouped.map(([dateKey, items]) => (
              <li key={dateKey}>
                <div className="bg-amber-50/80 px-4 py-2.5 text-xs font-semibold text-gray-700 border-l-2 border-amber-400">
                  <Calendar className="mr-1.5 inline h-3.5 w-3.5 text-amber-600" />
                  <span className="text-amber-800">{sectionTitle(dateKey)}</span>
                </div>
                <ul className="divide-y divide-gray-50">
                  {items.map((r) => (
                    <li key={r.contactId}>
                      <button
                        type="button"
                        onClick={() => router.push(`/contacts/${r.contactId}`)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-gray-900">{name(r)}</p>
                          <p className="truncate text-xs text-gray-500">
                            {purposeLabel(r.nextEngagementPurpose)}
                            {r.nextContactNote && ` · ${r.nextContactNote}`}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
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
