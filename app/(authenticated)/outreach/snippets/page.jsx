'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Upload,
  Mail,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';

const SNIP_TYPES = [
  'subject',
  'intent',
  'service',
  'competitor',
  'value',
  'cta',
  'relationship',
  'generic',
];
const CONTEXT_TYPES = ['email', 'blog', 'linkedin', 'internal', 'multi'];
const INTENT_TYPES = ['reactivation', 'prior_contact', 'intro', 'competitor', 'seasonal', 'relationship_only'];

export default function SnippetHomePage() {
  const router = useRouter();
  const [snips, setSnips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [companyHQId, setCompanyHQId] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [form, setForm] = useState({
    snipName: '',
    snipText: '',
    snipType: 'generic',
    contextType: '',
    intentType: '',
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filterSnipType, setFilterSnipType] = useState('');
  const [filterContextType, setFilterContextType] = useState('');
  const [filterIntentType, setFilterIntentType] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    const id =
      typeof window !== 'undefined'
        ? localStorage.getItem('companyHQId') || localStorage.getItem('companyId')
        : '';
    setCompanyHQId(id || '');
  }, []);

  const loadSnips = () => {
    if (!companyHQId) {
      setLoading(false);
      setSnips([]);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ companyHQId });
    if (filterSnipType) params.set('snipType', filterSnipType);
    if (filterContextType) params.set('contextType', filterContextType);
    if (filterIntentType) params.set('intentType', filterIntentType);
    if (showInactive) params.set('activeOnly', 'false');
    api
      .get(`/api/outreach/content-snips?${params.toString()}`)
      .then((res) => {
        if (res.data?.success) setSnips(res.data.snips || []);
      })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load snippets'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSnips();
  }, [companyHQId, filterSnipType, filterContextType, filterIntentType, showInactive]);

  const handleSave = async () => {
    if (!companyHQId || !form.snipName?.trim() || form.snipText === undefined) {
      setError('Name and text are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        const res = await api.put(`/api/outreach/content-snips/${editingId}`, {
          snipName: form.snipName.trim(),
          snipText: form.snipText,
          snipType: form.snipType,
          contextType: form.contextType || null,
          intentType: form.intentType || null,
          isActive: form.isActive,
        });
        if (res.data?.success) {
          loadSnips();
          setEditingId(null);
          setShowForm(false);
          resetForm();
        }
      } else {
        const res = await api.post('/api/outreach/content-snips', {
          companyHQId,
          snipName: form.snipName.trim(),
          snipText: form.snipText,
          snipType: form.snipType,
          contextType: form.contextType || null,
          intentType: form.intentType || null,
          isActive: form.isActive,
        });
        if (res.data?.success) {
          loadSnips();
          setShowForm(false);
          resetForm();
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this snippet? This cannot be undone.')) return;
    try {
      await api.delete(`/api/outreach/content-snips/${id}`);
      loadSnips();
      if (editingId === id) {
        setEditingId(null);
        setShowForm(false);
        resetForm();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !companyHQId) {
      setError('Select a CSV file.');
      return;
    }
    setUploading(true);
    setError('');
    setUploadResult(null);
    const fd = new FormData();
    fd.append('file', uploadFile);
    fd.append('companyHQId', companyHQId);
    try {
      const res = await api.post('/api/outreach/content-snips/csv', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success) {
        setUploadResult(res.data);
        loadSnips();
        setUploadFile(null);
        setShowUpload(false);
      } else {
        setError(res.data?.error || 'Upload failed');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const toggleActive = async (snip) => {
    try {
      await api.put(`/api/outreach/content-snips/${snip.id}`, {
        isActive: !snip.isActive,
      });
      loadSnips();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update');
    }
  };

  const resetForm = () => {
    setForm({
      snipName: '',
      snipText: '',
      snipType: 'generic',
      contextType: '',
      intentType: '',
      isActive: true,
    });
    setError('');
  };

  const startEdit = (s) => {
    setEditingId(s.id);
    setShowForm(true);
    setForm({
      snipName: s.snipName,
      snipText: s.snipText || '',
      snipType: s.snipType || 'generic',
      contextType: s.contextType || '',
      intentType: s.intentType || '',
      isActive: s.isActive !== false,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowForm(false);
    resetForm();
  };

  const addToTemplate = (snipName) => {
    const q = new URLSearchParams();
    if (companyHQId) q.set('companyHQId', companyHQId);
    q.set('insertSnippet', snipName);
    router.push(`/outreach/campaigns/create?${q.toString()}`);
  };

  if (!companyHQId) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-3xl px-4">
          <p className="text-gray-600">Select a company first (company context required).</p>
          <button
            type="button"
            onClick={() => router.push('/people')}
            className="mt-4 text-red-600 hover:underline"
          >
            Back to People
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Snippet home"
          subtitle="Content snips: ingest via CSV or add manually. Use in templates as {{snippet:snipName}} or keep free-floating."
          backTo="/outreach"
          backLabel="Back to Outreach"
        />

        <div className="mt-6 rounded-xl bg-white p-6 shadow">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Content snips</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Upload className="h-4 w-4" />
                Upload CSV
              </button>
              {!editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(true);
                    resetForm();
                  }}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  <Plus className="h-4 w-4" />
                  Add snippet
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
              {error}
            </div>
          )}
          {uploadResult && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
              Uploaded: {uploadResult.created} created, {uploadResult.updated} updated.
              {uploadResult.errors?.length > 0 && (
                <div className="mt-1 text-amber-700">
                  {uploadResult.errors.slice(0, 5).join(' ')}
                  {uploadResult.errors.length > 5 && ` +${uploadResult.errors.length - 5} more`}
                </div>
              )}
            </div>
          )}

          {/* CSV Upload modal */}
          {showUpload && (
            <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Upload CSV</h3>
              <p className="mb-2 text-xs text-gray-600">
                Columns: <code className="rounded bg-gray-200 px-1">snip_name</code>,{' '}
                <code className="rounded bg-gray-200 px-1">snip_text</code>,{' '}
                <code className="rounded bg-gray-200 px-1">snip_type</code> (optional, default generic),{' '}
                <code className="rounded bg-gray-200 px-1">context_type</code>,{' '}
                <code className="rounded bg-gray-200 px-1">intent_type</code> (optional).{' '}
                <a
                  href="data:text/csv;charset=utf-8,snip_name,snip_text,snip_type,context_type,intent_type%0Aintent_reach_out,I wanted to reach out,intent,email,prior_contact%0Aintent_follow_up,I wanted to follow up,intent,email,reactivation"
                  download="content-snips-template.csv"
                  className="text-red-600 hover:underline"
                >
                  Download template CSV
                </a>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="text-sm"
                />
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading || !uploadFile}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowUpload(false); setUploadFile(null); setUploadResult(null); }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Add/Edit form */}
          {(showForm || editingId) && (
            <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">
                {editingId ? 'Edit snippet' : 'New snippet'}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Snip name (unique)</label>
                  <input
                    type="text"
                    value={form.snipName}
                    onChange={(e) => setForm((f) => ({ ...f, snipName: e.target.value }))}
                    placeholder="intent_reach_out"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    disabled={!!editingId}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Snip type</label>
                  <select
                    value={form.snipType}
                    onChange={(e) => setForm((f) => ({ ...f, snipType: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  >
                    {SNIP_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Context type</label>
                  <select
                    value={form.contextType}
                    onChange={(e) => setForm((f) => ({ ...f, contextType: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {CONTEXT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Intent type</label>
                  <select
                    value={form.intentType}
                    onChange={(e) => setForm((f) => ({ ...f, intentType: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {INTENT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    Active
                  </label>
                </div>
              </div>
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-gray-500">Snip text (supports {{firstName}}, etc.)</label>
                <textarea
                  value={form.snipText}
                  onChange={(e) => setForm((f) => ({ ...f, snipText: e.target.value }))}
                  placeholder="I wanted to reach out..."
                  rows={4}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
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

          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Filter:</span>
            <select
              value={filterSnipType}
              onChange={(e) => setFilterSnipType(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-xs"
            >
              <option value="">All types</option>
              {SNIP_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={filterContextType}
              onChange={(e) => setFilterContextType(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-xs"
            >
              <option value="">All contexts</option>
              {CONTEXT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={filterIntentType}
              onChange={(e) => setFilterIntentType(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-xs"
            >
              <option value="">All intents</option>
              {INTENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-gray-300"
              />
              Show inactive
            </label>
          </div>

          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : snips.length === 0 ? (
            <p className="text-gray-500">
              No snippets yet. Upload a CSV or add one above. Use in templates as{' '}
              <code className="rounded bg-gray-100 px-1">{{'{{snippet:snip_name}}'}}</code>.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr>
                    <th className="py-2 text-left font-medium text-gray-700">Name</th>
                    <th className="py-2 text-left font-medium text-gray-700">Type</th>
                    <th className="py-2 text-left font-medium text-gray-700">Context / Intent</th>
                    <th className="py-2 text-left font-medium text-gray-700">Text</th>
                    <th className="py-2 text-right font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {snips.map((s) => (
                    <tr key={s.id} className={!s.isActive ? 'bg-gray-50 opacity-75' : ''}>
                      <td className="py-2 font-mono text-gray-900">{s.snipName}</td>
                      <td className="py-2">
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{s.snipType}</span>
                      </td>
                      <td className="py-2 text-gray-600">
                        {[s.contextType, s.intentType].filter(Boolean).join(' / ') || '—'}
                      </td>
                      <td className="max-w-xs py-2 text-gray-600 line-clamp-2" title={s.snipText}>
                        {s.snipText}
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => addToTemplate(s.snipName)}
                            className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                            title="Add to template"
                          >
                            <Mail className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleActive(s)}
                            className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                            title={s.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {s.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                          </button>
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-gray-500">
          Snippets can be inserted in campaign email body as {`{{snippet:snip_name}}`}. Use &quot;Add to template&quot; to
          open campaigns and insert there, or keep them free-floating in this library.
        </p>
      </div>
    </div>
  );
}
