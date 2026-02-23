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
} from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';

const TEMPLATE_POSITIONS = ['SUBJECT_LINE', 'OPENING_GREETING', 'CATCH_UP', 'BUSINESS_CONTEXT', 'VALUE_PROPOSITION', 'COMPETITOR_FRAME', 'TARGET_ASK', 'SOFT_CLOSE'];
const TEMPLATE_POSITION_LABELS = {
  SUBJECT_LINE: 'Subject line', OPENING_GREETING: 'Opening greeting', CATCH_UP: 'Catch up', BUSINESS_CONTEXT: 'Business context',
  VALUE_PROPOSITION: 'Value proposition', COMPETITOR_FRAME: 'Competitor frame', TARGET_ASK: 'Target ask (CTA)', SOFT_CLOSE: 'Soft close',
};

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
    snipSlug: '',
    snipText: '',
    templatePosition: 'SOFT_CLOSE',
    personaSlug: '',
    bestUsedWhen: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filterPosition, setFilterPosition] = useState('');

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
    if (filterPosition) params.set('templatePosition', filterPosition);
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
  }, [companyHQId, filterPosition]);

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
          snipSlug: form.snipSlug?.trim() || undefined,
          snipText: form.snipText,
          templatePosition: form.templatePosition,
          personaSlug: form.personaSlug?.trim() || null,
          bestUsedWhen: form.bestUsedWhen?.trim() || null,
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
          snipSlug: form.snipSlug?.trim() || undefined,
          snipText: form.snipText,
          templatePosition: form.templatePosition,
          personaSlug: form.personaSlug?.trim() || null,
          bestUsedWhen: form.bestUsedWhen?.trim() || null,
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

  const handleDelete = async (snip) => {
    if (!window.confirm('Delete this snippet? This cannot be undone.')) return;
    try {
      await api.delete(`/api/outreach/content-snips/${snip.snipId}`);
      loadSnips();
      if (editingId === snip.snipId) {
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

  const resetForm = () => {
    setForm({
      snipName: '',
      snipSlug: '',
      snipText: '',
      templatePosition: 'SOFT_CLOSE',
      personaSlug: '',
      bestUsedWhen: '',
    });
    setError('');
  };

  const startEdit = (s) => {
    setEditingId(s.snipId);
    setShowForm(true);
    setForm({
      snipName: s.snipName,
      snipSlug: s.snipSlug || '',
      snipText: s.snipText || '',
      templatePosition: s.templatePosition || 'SOFT_CLOSE',
      personaSlug: s.personaSlug || '',
      bestUsedWhen: s.bestUsedWhen || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowForm(false);
    resetForm();
  };

  const addToTemplate = (snipSlug) => {
    const q = new URLSearchParams();
    if (companyHQId) q.set('companyHQId', companyHQId);
    q.set('insertSnippet', snipSlug);
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
          subtitle="Content snips: ingest via CSV or add manually. Use in templates as {{snippet:snipSlug}}."
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
                <code className="rounded bg-gray-200 px-1">template_position</code> (optional, default SOFT_CLOSE),{' '}
                <code className="rounded bg-gray-200 px-1">assembly_helper_personas</code> (optional, comma-separated persona slugs).{' '}
                <a
                  href={`data:text/csv;charset=utf-8,${encodeURIComponent([
                    'snip_name,snip_text,template_position,assembly_helper_personas',
                    'subject_company_only,{{Company}},SUBJECT_LINE,',
                    'opening_reconnect,Following up on our conversation about {{topic}}.,OPENING_GREETING,FormerColleagueNowReachingoutAgainAfterLongTime',
                    'cta_brief_call,Please let me know if a brief call would be worthwhile.,TARGET_ASK,',
                  ].join('\n'))}`}
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
                  <label className="mb-1 block text-xs font-medium text-gray-500">Slug (for {{snippet:slug}})</label>
                  <input
                    type="text"
                    value={form.snipSlug}
                    onChange={(e) => setForm((f) => ({ ...f, snipSlug: e.target.value }))}
                    placeholder="optional, derived from name"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Template position</label>
                  <select
                    value={form.templatePosition}
                    onChange={(e) => setForm((f) => ({ ...f, templatePosition: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  >
                    {TEMPLATE_POSITIONS.map((p) => (
                      <option key={p} value={p}>{TEMPLATE_POSITION_LABELS[p]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Persona slug</label>
                  <input
                    type="text"
                    value={form.personaSlug}
                    onChange={(e) => setForm((f) => ({ ...f, personaSlug: e.target.value }))}
                    placeholder="optional"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Best used when</label>
                  <input
                    type="text"
                    value={form.bestUsedWhen}
                    onChange={(e) => setForm((f) => ({ ...f, bestUsedWhen: e.target.value }))}
                    placeholder="optional"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
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

          {/* Hydrate / Show toggle: all positions or one segment */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-700">Show:</span>
            <select
              value={filterPosition}
              onChange={(e) => setFilterPosition(e.target.value)}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white"
              title="Hydrate all or only snippets for one position"
            >
              <option value="">Hydrate all</option>
              {TEMPLATE_POSITIONS.map((p) => (
                <option key={p} value={p}>Hydrate {TEMPLATE_POSITION_LABELS[p].toLowerCase()} only</option>
              ))}
            </select>
            <span className="text-xs text-gray-500">
              {filterPosition ? `Showing ${TEMPLATE_POSITION_LABELS[filterPosition] || filterPosition} only` : 'Showing all positions (segmented below)'}
            </span>
          </div>

          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : snips.length === 0 ? (
            <p className="text-gray-500">
              No snippets yet. Upload a CSV or add one above. Use in templates as{' '}
              <code className="rounded bg-gray-100 px-1">{'{{snippet:snipSlug}}'}</code>.
            </p>
          ) : filterPosition ? (
            /* Single segment: flat table */
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr>
                    <th className="py-2 text-left font-medium text-gray-700">Name</th>
                    <th className="py-2 text-left font-medium text-gray-700">Slug</th>
                    <th className="py-2 text-left font-medium text-gray-700">Persona / Best used when</th>
                    <th className="py-2 text-left font-medium text-gray-700">Text</th>
                    <th className="py-2 text-right font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {snips.map((s) => (
                    <tr key={s.snipId}>
                      <td className="py-2 font-mono text-gray-900">{s.snipName}</td>
                      <td className="py-2 font-mono text-gray-700">{s.snipSlug}</td>
                      <td className="py-2 text-gray-600">
                        {[s.personaSlug, s.bestUsedWhen].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="max-w-xs py-2 text-gray-600 line-clamp-2" title={s.snipText}>
                        {s.snipText}
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => addToTemplate(s.snipSlug)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-600" title="Add to template"><Mail className="h-4 w-4" /></button>
                          <button type="button" onClick={() => startEdit(s)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700" title="Edit"><Pencil className="h-4 w-4" /></button>
                          <button type="button" onClick={() => handleDelete(s)} className="rounded p-1.5 text-red-500 hover:bg-red-50" title="Delete"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Segmented by position: one section per position */
            <div className="space-y-8">
              {TEMPLATE_POSITIONS.map((position) => {
                const positionSnips = snips.filter((s) => s.templatePosition === position);
                if (positionSnips.length === 0) return null;
                return (
                  <div key={position} className="rounded-lg border border-gray-200 bg-gray-50/50 overflow-hidden">
                    <div className="px-4 py-2 border-b border-gray-200 bg-white">
                      <h3 className="text-sm font-semibold text-gray-800">
                        {TEMPLATE_POSITION_LABELS[position]}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {positionSnips.length} snippet{positionSnips.length !== 1 ? 's' : ''} — or{' '}
                        <button type="button" onClick={() => setFilterPosition(position)} className="text-red-600 hover:underline font-medium">
                          hydrate this position only
                        </button>
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead>
                          <tr>
                            <th className="py-2 text-left font-medium text-gray-700">Name</th>
                            <th className="py-2 text-left font-medium text-gray-700">Slug</th>
                            <th className="py-2 text-left font-medium text-gray-700">Persona / Best used when</th>
                            <th className="py-2 text-left font-medium text-gray-700">Text</th>
                            <th className="py-2 text-right font-medium text-gray-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {positionSnips.map((s) => (
                            <tr key={s.snipId}>
                              <td className="py-2 font-mono text-gray-900">{s.snipName}</td>
                              <td className="py-2 font-mono text-gray-700">{s.snipSlug}</td>
                              <td className="py-2 text-gray-600">
                                {[s.personaSlug, s.bestUsedWhen].filter(Boolean).join(' · ') || '—'}
                              </td>
                              <td className="max-w-xs py-2 text-gray-600 line-clamp-2" title={s.snipText}>
                                {s.snipText}
                              </td>
                              <td className="py-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button type="button" onClick={() => addToTemplate(s.snipSlug)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-600" title="Add to template"><Mail className="h-4 w-4" /></button>
                                  <button type="button" onClick={() => startEdit(s)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700" title="Edit"><Pencil className="h-4 w-4" /></button>
                                  <button type="button" onClick={() => handleDelete(s)} className="rounded p-1.5 text-red-500 hover:bg-red-50" title="Delete"><Trash2 className="h-4 w-4" /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-gray-500">
          Snippets can be inserted in campaign email body as {`{{snippet:snipSlug}}`}. Use &quot;Add to template&quot; to
          open campaigns and insert there, or keep them free-floating in this library.
        </p>
      </div>
    </div>
  );
}
