'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';

export default function OutreachSnippetsPage() {
  const router = useRouter();
  const [snippets, setSnippets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [companyHQId, setCompanyHQId] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const INTENT_TYPES = [
    { value: '', label: '— None —' },
    { value: 'reactivation', label: 'Reactivation' },
    { value: 'prior_contact', label: 'Prior contact' },
    { value: 'intro_positioning', label: 'Intro / positioning' },
    { value: 'seasonal', label: 'Seasonal' },
    { value: 'neutral_polite', label: 'Neutral / polite' },
    { value: 'other', label: 'Other' },
  ];
  const [form, setForm] = useState({ variableName: '', name: '', body: '', intentType: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const id = typeof window !== 'undefined'
      ? (localStorage.getItem('companyHQId') || localStorage.getItem('companyId'))
      : '';
    setCompanyHQId(id || '');
  }, []);

  useEffect(() => {
    if (!companyHQId) {
      setLoading(false);
      setSnippets([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .get(`/api/outreach/snippets?companyHQId=${companyHQId}`)
      .then((res) => {
        if (!cancelled && res.data?.success) setSnippets(res.data.snippets || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.error || 'Failed to load snippets');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [companyHQId]);

  const handleSave = async () => {
    if (!companyHQId || !form.variableName?.trim() || !form.name?.trim()) {
      setError('Variable name and label are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        const res = await api.put(`/api/outreach/snippets/${editingId}`, {
          name: form.name.trim(),
          body: form.body,
          variableName: form.variableName.trim(),
          intentType: form.intentType || null,
        });
        if (res.data?.success) {
          setSnippets((prev) =>
            prev.map((s) => (s.id === editingId ? res.data.snippet : s)),
          );
          setEditingId(null);
          setShowForm(false);
          setForm({ variableName: '', name: '', body: '', intentType: '' });
        }
      } else {
        const res = await api.post('/api/outreach/snippets', {
          companyHQId,
          variableName: form.variableName.trim(),
          name: form.name.trim(),
          body: form.body,
          intentType: form.intentType || null,
        });
        if (res.data?.success) {
          setSnippets((prev) => [...prev, res.data.snippet].sort((a, b) => a.variableName.localeCompare(b.variableName)));
          setShowForm(false);
          setForm({ variableName: '', name: '', body: '', intentType: '' });
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save snippet');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this snippet? It cannot be undone.')) return;
    try {
      await api.delete(`/api/outreach/snippets/${id}`);
      setSnippets((prev) => prev.filter((s) => s.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setShowForm(false);
        setForm({ variableName: '', name: '', body: '' });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete');
    }
  };

  const startEdit = (s) => {
    setEditingId(s.id);
    setShowForm(true);
    setForm({
      variableName: s.variableName,
      name: s.name,
      body: s.body || '',
      intentType: s.intentType || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowForm(false);
    setForm({ variableName: '', name: '', body: '', intentType: '' });
    setError('');
  };

  if (!companyHQId) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-3xl px-4">
          <p className="text-gray-600">Select a company first (company context required).</p>
          <button
            type="button"
            onClick={() => router.push('/people')}
            className="mt-4 text-blue-600 hover:underline"
          >
            Back to People
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Outreach snippets"
          subtitle="Reusable blocks (e.g. mypitch, warm_intro) for emails. Use in templates as {{snippet:variableName}} later."
          backTo="/outreach"
          backLabel="Back to Outreach"
        />

        <div className="mt-6 rounded-xl bg-white p-6 shadow">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2 className="text-lg font-semibold text-gray-900">All snippets</h2>
            {!editingId && (
              <button
                type="button"
                onClick={() => { setShowForm(true); setForm({ variableName: '', name: '', body: '', intentType: '' }); }}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add snippet
              </button>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Inline form for add/edit */}
          {(showForm || editingId) && (
            <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                {editingId ? 'Edit snippet' : 'New snippet'}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Variable name (e.g. mypitch)</label>
                  <input
                    type="text"
                    value={form.variableName}
                    onChange={(e) => setForm((f) => ({ ...f, variableName: e.target.value }))}
                    placeholder="mypitch"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    disabled={!!editingId}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Label (display name)</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="My pitch"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Intent type</label>
                  <select
                    value={form.intentType}
                    onChange={(e) => setForm((f) => ({ ...f, intentType: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  >
                    {INTENT_TYPES.map((opt) => (
                      <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">Content (can use {{firstName}}, {{companyName}}, etc.)</label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  placeholder="Hi {{firstName}}, ..."
                  rows={4}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-gray-500">Loading snippets…</p>
          ) : snippets.length === 0 ? (
            <p className="text-gray-500">
              No snippets yet. Add one above (e.g. variable name <code className="rounded bg-gray-100 px-1">mypitch</code>, label &quot;My pitch&quot;) to store outreach copy in one place.
            </p>
          ) : (
            <ul className="space-y-3">
              {snippets.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-sm font-medium text-gray-900">{s.variableName}</span>
                      <span className="ml-2 text-sm text-gray-600">{s.name}</span>
                      {s.intentType && (
                        <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{s.intentType}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(s.id)}
                        className="rounded p-1.5 text-red-500 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {s.body && (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-3">{s.body}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-4 text-xs text-gray-500">
          Snippets are stored per company. You can reference them in email templates later (e.g. {{snippet:mypitch}}) once that’s wired up.
        </p>
      </div>
    </div>
  );
}
