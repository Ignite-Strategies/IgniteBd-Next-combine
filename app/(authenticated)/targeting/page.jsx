'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Target, Plus, RefreshCw, User, Building2, ExternalLink, Sparkles, ArrowRight, UserCheck } from 'lucide-react';
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
  if (target.outreachPersonaSlug) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
        <Sparkles className="h-3 w-3" />
        Ready
      </span>
    );
  }
  if (target.enrichmentFetchedAt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
        <UserCheck className="h-3 w-3" />
        Enriched
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
      Needs setup
    </span>
  );
}

// ─── Target Queue ──────────────────────────────────────────────────────────────

function TargetQueue({ targets, loading, companyHQId }) {
  const router = useRouter();

  const goToContact = (t) => {
    const base = `/contacts/${t.id}`;
    router.push(companyHQId ? `${base}?companyHQId=${companyHQId}` : base);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Loading queue…
      </div>
    );
  }

  if (!targets.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Target className="h-12 w-12 text-gray-300 mb-4" />
        <p className="text-base font-semibold text-gray-600">No one in the queue</p>
        <p className="text-sm text-gray-400 mt-1">Submit targets and they'll appear here until first outreach is sent.</p>
      </div>
    );
  }

  const groups = groupByDate(targets);

  return (
    <div className="divide-y divide-gray-100">
      {groups.map(({ date, items }) => (
        <div key={date}>
          {/* Date group header */}
          <div className="flex items-center justify-between border-l-2 border-indigo-400 bg-indigo-50/50 px-5 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
              {formatGroupDate(date)}
            </span>
            <span className="text-xs text-indigo-500">
              {items.length} contact{items.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Target rows */}
          {items.map((t) => (
            <div
              key={t.id}
              className="group flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
            >
              <div
                onClick={() => goToContact(t)}
                className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 group-hover:bg-indigo-200 transition">
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
                  {t.outreachPersonaSlug && (
                    <div className="mt-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                        <Sparkles className="h-3 w-3" />
                        {t.outreachPersonaSlug}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <StatusBadge target={t} />
                <button
                  onClick={() => goToContact(t)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition"
                >
                  Edit
                </button>
                {t.linkedinUrl && (
                  <a
                    href={t.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                    title="Open LinkedIn (new tab)"
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
  const ready = targets.filter((t) => t.outreachPersonaSlug).length;
  const needsSetup = total - ready;

  return (
    <div className="grid grid-cols-3 divide-x divide-gray-200">
      <div className="px-6 py-4 text-center">
        <p className="text-2xl font-bold text-gray-900">{total}</p>
        <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">In Queue</p>
      </div>
      <div className="px-6 py-4 text-center">
        <p className="text-2xl font-bold text-purple-600">{ready}</p>
        <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">Persona Ready</p>
      </div>
      <div className="px-6 py-4 text-center">
        <p className="text-2xl font-bold text-amber-500">{needsSetup}</p>
        <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">Needs Setup</p>
      </div>
    </div>
  );
}

// ─── Inner page (needs useSearchParams) ───────────────────────────────────────

function TargetCockpitInner() {
  const searchParams = useSearchParams();
  const [companyHQId, setCompanyHQId] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Wait for Firebase auth to resolve — auth.currentUser is null on first render
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => setCurrentUser(user));
    return unsub;
  }, []);

  // Resolve companyHQId from URL or localStorage
  useEffect(() => {
    const url = searchParams?.get('companyHQId') || '';
    if (url) { setCompanyHQId(url); return; }
    const stored = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
    setCompanyHQId(stored);
  }, [searchParams]);

  const fetchTargets = useCallback(async () => {
    if (!companyHQId || !currentUser) return;

    setLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/targeting/list?companyHQId=${companyHQId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setTargets(data.targets || []);
      } else {
        console.error('Targeting list error:', data.error, data.details);
      }
    } catch (err) {
      console.error('Failed to fetch targets:', err);
    } finally {
      setLoading(false);
    }
  }, [companyHQId, currentUser]);

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets]);

  const handleSuccess = () => {
    fetchTargets();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">

        <PageHeader title="Target Cockpit" subtitle="Stage your weekly outreach targets" />

        {/* Hero: Add targets — staging ground, primary action */}
        <button
          onClick={() => setModalOpen(true)}
          className="mb-6 w-full rounded-xl border-2 border-dashed border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50 p-6 text-left transition hover:border-indigo-400 hover:from-indigo-100 hover:to-purple-100"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100">
              <Plus className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-indigo-900">Add targets for this week</p>
              <p className="text-sm text-indigo-600 mt-0.5">
                CSV upload, paste contacts, or quick notes — they land in need-to-engage until first outreach.
              </p>
            </div>
          </div>
        </button>

        {/* Queue — compact, secondary */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-700">Next Targets Queue</h2>
              {!loading && targets.length > 0 && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                  {targets.length}
                </span>
              )}
            </div>
            <button
              onClick={fetchTargets}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-500 transition hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {!loading && targets.length > 0 && (
            <>
              <StatsBar targets={targets} />
              <div className="border-t border-gray-100" />
            </>
          )}

          <TargetQueue targets={targets} loading={loading} companyHQId={companyHQId} />
        </div>
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
