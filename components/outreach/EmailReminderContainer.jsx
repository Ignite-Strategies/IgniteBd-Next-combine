'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Calendar, ChevronRight } from 'lucide-react';
import api from '@/lib/api';

/**
 * Email reminder container: hydrates by date, chronological.
 * Shows "next email sends" for a date range (default: today through +7 days).
 * Each row: date, contact name, follow-up type (manual/automatic), optional note; link to contact or compose.
 * For dashboard: compact. "See all" links to tracker (chronological by date).
 */
export default function EmailReminderContainer({
  companyHQId,
  dateFrom,
  dateTo,
  limit = 50,
  compact = false,
  showSeeAll = true,
}) {
  const router = useRouter();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolvedCompanyId, setResolvedCompanyId] = useState(companyHQId || null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = dateFrom || today.toISOString().slice(0, 10);
  const to = dateTo || (() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();

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
    api.get(`/api/outreach/reminders`, {
      params: { companyHQId: resolvedCompanyId, dateFrom: from, dateTo: to, limit },
    })
      .then((res) => {
        if (!cancelled && res.data?.success) {
          setReminders(res.data.reminders || []);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.error || 'Failed to load reminders');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [resolvedCompanyId, from, to, limit]);

  const formatDateLabel = (isoDate) => {
    const d = new Date(isoDate);
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const diff = Math.round((d - t) / (1000 * 60 * 60 * 24));
    const actualDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (diff === 0) return { label: 'Today', actual: actualDate };
    if (diff === 1) return { label: 'Tomorrow', actual: actualDate };
    if (diff === -1) return { label: 'Yesterday', actual: actualDate };
    return { label: actualDate, actual: actualDate };
  };

  const formatDateRangeSubtitle = (fromStr, toStr) => {
    const from = new Date(fromStr);
    const to = new Date(toStr);
    return `${from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: to.getFullYear() !== from.getFullYear() ? 'numeric' : undefined })}`;
  };

  const groupByDate = (list) => {
    const groups = {};
    for (const r of list) {
      const key = r.dueDate;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  };

  const name = (r) => [r.firstName, r.lastName].filter(Boolean).join(' ').trim() || r.email || '—';

  if (!resolvedCompanyId) return null;

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2 text-gray-500">
          <Mail className="h-5 w-5" />
          <span className="text-sm">Loading next email sends…</span>
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

  const grouped = groupByDate(reminders);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-amber-600" />
            <h3 className="text-base font-semibold text-gray-900">Next email sends</h3>
          </div>
          <p className="mt-0.5 text-xs font-medium text-amber-700/90">
            Due {formatDateRangeSubtitle(from, to)}
          </p>
        </div>
        {showSeeAll && (
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams({ companyHQId: resolvedCompanyId });
              params.set('followUpDateFrom', from);
              params.set('followUpDateTo', to);
              router.push(`/outreach/tracker?${params.toString()}`);
            }}
            className="text-sm font-medium text-amber-600 hover:text-amber-700"
          >
            See all
          </button>
        )}
      </div>
      <div className={compact ? 'max-h-64 overflow-y-auto' : ''}>
        {grouped.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            No follow-ups due between {from} and {to}.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {grouped.map(([dateKey, items]) => {
              const { label, actual } = formatDateLabel(dateKey);
              return (
              <li key={dateKey}>
                <div className="bg-amber-50/80 px-4 py-2.5 text-xs font-semibold text-gray-700 border-l-2 border-amber-400">
                  <Calendar className="mr-1.5 inline h-3.5 w-3.5 text-amber-600" />
                  <span className="text-amber-800">{label}</span>
                  {label !== actual && (
                    <span className="ml-1.5 font-normal text-gray-500">· {actual}</span>
                  )}
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
                            {r.reminderType === 'manual' ? 'Manual reminder' : 'Follow-up'}
                            {r.nextContactNote && ` · ${r.nextContactNote}`}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
