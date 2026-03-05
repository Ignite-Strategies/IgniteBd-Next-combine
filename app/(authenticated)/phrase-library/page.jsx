'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Library, Plus, Edit2, Trash2, Check, X, Loader2, ChevronDown } from 'lucide-react';
import { auth } from '@/lib/firebase';
import PageHeader from '@/components/PageHeader.jsx';

// ─── Constants ────────────────────────────────────────────────────────────────

const POSITIONS = [
  { value: 'OPENING_GREETING', label: 'Opening Greeting', color: 'bg-blue-100 text-blue-700' },
  { value: 'CATCH_UP',         label: 'Catch Up',         color: 'bg-teal-100 text-teal-700' },
  { value: 'BUSINESS_CONTEXT', label: 'Business Context', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'VALUE_PROPOSITION',label: 'Value Proposition',color: 'bg-violet-100 text-violet-700' },
  { value: 'COMPETITOR_FRAME', label: 'Competitor Frame', color: 'bg-orange-100 text-orange-700' },
  { value: 'TARGET_ASK',       label: 'Target Ask',       color: 'bg-green-100 text-green-700' },
  { value: 'SOFT_CLOSE',       label: 'Soft Close',       color: 'bg-gray-100 text-gray-700' },
  { value: 'SUBJECT_LINE',     label: 'Subject Line',     color: 'bg-yellow-100 text-yellow-700' },
];

const positionMeta = Object.fromEntries(POSITIONS.map((p) => [p.value, p]));

const EMPTY_FORM = { snipName: '', snipText: '', templatePosition: 'BUSINESS_CONTEXT', personaSlug: '', bestUsedWhen: '' };

// ─── Position badge ───────────────────────────────────────────────────────────

function PositionBadge({ position }) {
  const meta = positionMeta[position];
  if (!meta) return <span className="text-xs text-gray-400">{position}</span>;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.color}`}>
      {meta.label}
    </span>
  );
}

// ─── Snip row ─────────────────────────────────────────────────────────────────

function SnipRow({ snip, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <div
        className="flex items-start justify-between px-5 py-3 hover:bg-gray-50 cursor-pointer transition"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <PositionBadge position={snip.templatePosition} />
            {snip.personaSlug && (
              <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                {snip.personaSlug}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold text-gray-900">{snip.snipName?.replace(/_/g, ' ')}</p>
          {!expanded && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 italic">"{snip.snipText}"</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(snip); }}
            className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(snip.snipId); }}
            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <ChevronDown className={`h-4 w-4 text-gray-300 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>
      {expanded && (
        <div className="px-5 pb-4 space-y-2">
          <p className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 border border-gray-200">
            {snip.snipText}
          </p>
          {snip.bestUsedWhen && (
            <p className="text-xs text-gray-500">
              <span className="font-semibold">Best used when:</span> {snip.bestUsedWhen}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Snip form (create / edit) ────────────────────────────────────────────────

function SnipForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4 rounded-2xl border border-purple-200 bg-purple-50/40 p-5">
      <p className="text-sm font-semibold text-purple-900">{initial?.snipId ? 'Edit phrase' : 'New phrase block'}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Name (internal)</label>
          <input
            type="text"
            value={form.snipName}
            onChange={(e) => set('snipName', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Email position</label>
          <select
            value={form.templatePosition}
            onChange={(e) => set('templatePosition', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
          >
            {POSITIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Phrase text</label>
        <textarea
          value={form.snipText}
          onChange={(e) => set('snipText', e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Persona slug (optional)</label>
          <input
            type="text"
            value={form.personaSlug}
            onChange={(e) => set('personaSlug', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Best used when</label>
          <input
            type="text"
            value={form.bestUsedWhen}
            onChange={(e) => set('bestUsedWhen', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.snipText.trim() || !form.snipName.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save phrase'}
        </button>
        <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function PhraseLibraryInner() {
  const searchParams = useSearchParams();
  const [companyHQId, setCompanyHQId] = useState('');
  const [snips, setSnips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterPosition, setFilterPosition] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editSnip, setEditSnip] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const url = searchParams?.get('companyHQId') || '';
    if (url) { setCompanyHQId(url); return; }
    setCompanyHQId(localStorage.getItem('companyHQId') || '');
  }, [searchParams]);

  const fetchSnips = useCallback(async () => {
    if (!companyHQId) return;
    const token = await auth.currentUser?.getIdToken();
    setLoading(true);
    try {
      const qs = new URLSearchParams({ companyHQId });
      if (filterPosition) qs.set('templatePosition', filterPosition);
      const res = await fetch(`/api/outreach/content-snips?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setSnips(data.snips || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [companyHQId, filterPosition]);

  useEffect(() => { fetchSnips(); }, [fetchSnips]);

  const handleSave = async (form) => {
    setSaving(true);
    setError('');
    try {
      const token = await auth.currentUser?.getIdToken();
      const isEdit = Boolean(form.snipId);
      const url = isEdit
        ? `/api/outreach/content-snips/${form.snipId}`
        : '/api/outreach/content-snips';
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, companyHQId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Save failed');
      setShowForm(false);
      setEditSnip(null);
      fetchSnips();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this phrase block?')) return;
    const token = await auth.currentUser?.getIdToken();
    try {
      await fetch(`/api/outreach/content-snips/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchSnips();
    } catch (e) {
      console.error(e);
    }
  };

  // Group by position for display
  const grouped = POSITIONS.map((p) => ({
    ...p,
    items: snips.filter((s) => s.templatePosition === p.value),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-6">

        <PageHeader
          title="Phrase Library"
          subtitle="Atomic building blocks for AI email assembly — each phrase knows its position in the email skeleton"
          actions={
            <button
              onClick={() => { setShowForm(true); setEditSnip(null); }}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 transition"
            >
              <Plus className="h-4 w-4" />
              Add phrase
            </button>
          }
        />

        {/* Email skeleton explainer */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-4">
          <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">Email skeleton order</p>
          <div className="flex flex-wrap gap-1.5">
            {POSITIONS.map((p) => (
              <button
                key={p.value}
                onClick={() => setFilterPosition(filterPosition === p.value ? '' : p.value)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                  filterPosition === p.value
                    ? 'ring-2 ring-purple-500 ' + p.color
                    : p.color + ' opacity-70 hover:opacity-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {filterPosition && (
            <button onClick={() => setFilterPosition('')} className="mt-2 text-xs text-indigo-500 hover:underline">
              Clear filter
            </button>
          )}
        </div>

        {/* New / Edit form */}
        {(showForm || editSnip) && (
          <SnipForm
            initial={editSnip}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditSnip(null); }}
            saving={saving}
          />
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Snip list */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading phrase library…
            </div>
          ) : snips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <Library className="h-12 w-12 text-gray-200" />
              <p className="font-semibold text-gray-500">No phrases yet</p>
              <p className="text-sm text-gray-400">Add phrase blocks to power the AI email generator.</p>
            </div>
          ) : (
            <div>
              {grouped.map((group) => (
                <div key={group.value}>
                  <div className={`flex items-center justify-between px-5 py-2.5 border-b border-gray-100 ${group.color.replace('text-', 'border-l-4 border-l-').split(' ')[0]} bg-gray-50/60`}>
                    <span className={`text-xs font-bold uppercase tracking-wider ${group.color.split(' ')[1]}`}>
                      {group.label}
                    </span>
                    <span className="text-xs text-gray-400">{group.items.length} phrase{group.items.length !== 1 ? 's' : ''}</span>
                  </div>
                  {group.items.map((s) => (
                    <SnipRow
                      key={s.snipId}
                      snip={s}
                      onEdit={(snip) => { setEditSnip(snip); setShowForm(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center">
          {snips.length} phrase{snips.length !== 1 ? 's' : ''} in library
          {filterPosition && ` · filtered by ${positionMeta[filterPosition]?.label}`}
        </p>
      </div>
    </div>
  );
}

export default function PhraseLibraryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-4" />
          <div className="h-64 bg-white rounded-2xl border border-gray-200 animate-pulse" />
        </div>
      </div>
    }>
      <PhraseLibraryInner />
    </Suspense>
  );
}
