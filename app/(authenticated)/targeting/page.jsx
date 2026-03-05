'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Target, Plus, RefreshCw, User, Building2, ExternalLink, Clock } from 'lucide-react';
import { auth } from '@/lib/firebase';
import PageHeader from '@/components/PageHeader.jsx';
import TargetSubmissionModal from '@/components/targeting/TargetSubmissionModal.jsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByDate(targets) {
  const groups = {};
  for (const t of targets) {
    const d = new Date(t.createdAt);
    const key = d.toDateString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }
  return Object.entries(groups).map(([date, items]) => ({ date, items }));
}

function formatGroupDate(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function displayName(t) {
  return t.fullName || [t.firstName, t.lastName].filter(Boolean).join(' ') || '—';
}

function StatusBadge({ target }) {
  if (target.enrichmentFetchedAt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
        Enriched
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
      <Clock className="h-3 w-3" />
      Queued
    </span>
  );
}

// ─── Target Queue ──────────────────────────────────────────────────────────────

function TargetQueue({ targets, loading, onRefresh }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Loading targets…
      </div>
    );
  }

  if (!targets.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Target className="h-12 w-12 text-gray-300 mb-4" />
        <p className="text-base font-semibold text-gray-600">No targets in queue</p>
        <p className="text-sm text-gray-400 mt-1">Submit your first batch to get started.</p>
      </div>
    );
  }

  const groups = groupByDate(targets);

  return (
    <div className="divide-y divide-gray-100">
      {groups.map(({ date, items }) => (
        <div key={date}>
          {/* Date group header */}
          <div className="flex items-center justify-between border-l-2 border-blue-400 bg-blue-50/60 px-5 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              {formatGroupDate(date)}
            </span>
            <span className="text-xs text-blue-500">
              {items.length} target{items.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Target rows */}
          {items.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100">
                  <User className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{displayName(t)}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5 flex-wrap">
                    {t.title && <span>{t.title}</span>}
                    {t.title && t.companyName && <span>·</span>}
                    {t.companyName && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {t.companyName}
                      </span>
                    )}
                    {t.howMet && (
                      <>
                        <span>·</span>
                        <span className="font-medium text-blue-600">{t.howMet}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                <StatusBadge target={t} />
                {t.linkedinUrl && (
                  <a
                    href={t.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg p-1.5 text-gray-400 transition hover:bg-blue-50 hover:text-blue-600"
                    title="View LinkedIn"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ targets }) {
  const total = targets.length;
  const enriched = targets.filter((t) => t.enrichmentFetchedAt).length;
  const queued = total - enriched;

  return (
    <div className="grid grid-cols-3 divide-x divide-gray-200">
      <div className="px-6 py-4 text-center">
        <p className="text-2xl font-bold text-gray-900">{total}</p>
        <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">Total</p>
      </div>
      <div className="px-6 py-4 text-center">
        <p className="text-2xl font-bold text-amber-600">{queued}</p>
        <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">Queued</p>
      </div>
      <div className="px-6 py-4 text-center">
        <p className="text-2xl font-bold text-blue-600">{enriched}</p>
        <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">Enriched</p>
      </div>
    </div>
  );
}

// ─── Inner page (needs useSearchParams) ───────────────────────────────────────

function TargetCockpitInner() {
  const searchParams = useSearchParams();
  const [companyHQId, setCompanyHQId] = useState('');
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Resolve companyHQId
  useEffect(() => {
    const url = searchParams?.get('companyHQId') || '';
    if (url) { setCompanyHQId(url); return; }
    const stored = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
    setCompanyHQId(stored);
  }, [searchParams]);

  const fetchTargets = useCallback(async () => {
    if (!companyHQId) return;
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/targeting/list?companyHQId=${companyHQId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setTargets(data.targets || []);
    } catch (err) {
      console.error('Failed to fetch targets:', err);
    } finally {
      setLoading(false);
    }
  }, [companyHQId]);

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets]);

  const handleSuccess = () => {
    fetchTargets();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">

        <PageHeader
          title="Target Cockpit"
          subtitle="Submit weekly outreach targets for template generation"
          actions={
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Submit Targets
            </button>
          }
        />

        {/* Intro banner */}
        <div className="mb-6 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-5">
          <div className="flex items-start gap-3">
            <Target className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-900">Weekly targeting workflow</p>
              <p className="text-sm text-blue-700 mt-0.5">
                Submit 5–10 intentional contacts per batch. Add relationship context so templates
                can be generated for each target's cadence.
              </p>
            </div>
          </div>
        </div>

        {/* Stats + Queue card */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">

          {/* Stats bar */}
          {!loading && targets.length > 0 && (
            <>
              <StatsBar targets={targets} />
              <div className="border-t border-gray-100" />
            </>
          )}

          {/* Queue header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-900">Next Targets Queue</h2>
              {targets.length > 0 && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {targets.length}
                </span>
              )}
            </div>
            <button
              onClick={fetchTargets}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Queue list */}
          <TargetQueue targets={targets} loading={loading} onRefresh={fetchTargets} />
        </div>

        {/* Empty call-to-action */}
        {!loading && targets.length === 0 && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-8 py-4 text-sm font-semibold text-gray-500 transition hover:border-blue-400 hover:text-blue-600"
            >
              <Plus className="h-4 w-4" />
              Submit your first batch of targets
            </button>
          </div>
        )}
      </div>

      {/* Submission modal */}
      <TargetSubmissionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
        companyHQId={companyHQId}
      />
    </div>
  );
}

// ─── Page export ───────────────────────────────────────────────────────────────

export default function TargetingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-4" />
          <div className="h-64 bg-white rounded-2xl border border-gray-200 animate-pulse" />
        </div>
      </div>
    }>
      <TargetCockpitInner />
    </Suspense>
  );
}
