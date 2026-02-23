'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Code,
  Plus,
  Upload,
  Sparkles,
  Edit,
  Pencil,
  Trash2,
  CheckCircle,
  X,
  Lock,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';

const SOURCES = ['CONTACT', 'OWNER', 'COMPUTED', 'CUSTOM'];

function VariablesLandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';

  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateOptions, setShowCreateOptions] = useState(false);
  const [createMode, setCreateMode] = useState(null); // 'manual', 'ai', 'upload'
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state for manual creation
  const [form, setForm] = useState({
    variableKey: '',
    description: '',
    source: 'CUSTOM',
    dbField: '',
    computedRule: '',
    isActive: true,
  });
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    if (!companyHQId && typeof window !== 'undefined') {
      const stored = localStorage.getItem('companyHQId');
      if (stored) {
        router.replace(`/variables?companyHQId=${stored}`);
      }
    }
  }, [companyHQId, router]);

  useEffect(() => {
    if (companyHQId) {
      loadVariables();
    } else {
      setLoading(false);
    }
  }, [companyHQId]);

  const loadVariables = async () => {
    if (!companyHQId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/template-variables?companyHQId=${companyHQId}&activeOnly=false`);
      if (res.data?.success) {
        setVariables(res.data.variables || []);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load variables');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSave = async () => {
    if (!companyHQId || !form.variableKey?.trim() || !form.source) {
      setError('Variable key and source are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        const res = await api.put(`/api/template-variables/${editingId}`, {
          variableKey: form.variableKey.trim(),
          description: form.description,
          source: form.source,
          dbField: form.dbField || null,
          computedRule: form.computedRule || null,
          isActive: form.isActive,
        });
        if (res.data?.success) {
          setSuccess('Variable updated successfully!');
          loadVariables();
          resetForm();
          setCreateMode(null);
          setShowCreateOptions(false);
        }
      } else {
        const res = await api.post('/api/template-variables', {
          companyHQId,
          variableKey: form.variableKey.trim(),
          description: form.description,
          source: form.source,
          dbField: form.dbField || null,
          computedRule: form.computedRule || null,
          isActive: form.isActive,
        });
        if (res.data?.success) {
          setSuccess('Variable created successfully!');
          loadVariables();
          resetForm();
          setCreateMode(null);
          setShowCreateOptions(false);
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this variable? This cannot be undone.')) return;
    try {
      await api.delete(`/api/template-variables/${id}`);
      setSuccess('Variable deleted successfully!');
      loadVariables();
      if (editingId === id) {
        resetForm();
        setCreateMode(null);
        setShowCreateOptions(false);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete');
    }
  };

  const startEdit = (variable) => {
    setEditingId(variable.id);
    setCreateMode('manual');
    setShowCreateOptions(true);
    setForm({
      variableKey: variable.variableKey,
      description: variable.description || '',
      source: variable.source,
      dbField: variable.dbField || '',
      computedRule: variable.computedRule || '',
      isActive: variable.isActive !== false,
    });
  };

  const resetForm = () => {
    setForm({
      variableKey: '',
      description: '',
      source: 'CUSTOM',
      dbField: '',
      computedRule: '',
      isActive: true,
    });
    setEditingId(null);
    setError('');
  };

  const cancelCreate = () => {
    resetForm();
    setCreateMode(null);
    setShowCreateOptions(false);
  };

  if (!companyHQId) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-3xl px-4">
          <p className="text-gray-600">Select a company first (company context required).</p>
        </div>
      </div>
    );
  }

  const builtInVariables = variables.filter((v) => v.isBuiltIn);
  const customVariables = variables.filter((v) => !v.isBuiltIn);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Template Variables"
          subtitle="Manage variables for your templates. Use in templates as {{variableKey}}. Built-in variables (firstName, lastName, etc.) are always available."
          backTo="/templates"
          backLabel="Back to Templates"
        />

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 flex items-center justify-between">
            <span>{success}</span>
            <button
              type="button"
              onClick={() => setSuccess('')}
              className="text-green-600 hover:text-green-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError('')}
              className="text-red-600 hover:text-red-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Main Actions */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {variables.length > 0 ? `Your Variables (${variables.length})` : 'Template Variables'}
            </h2>
            {!showCreateOptions && (
              <button
                type="button"
                onClick={() => setShowCreateOptions(true)}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                Create Variable
              </button>
            )}
          </div>

          {/* Create Options */}
          {showCreateOptions && !createMode && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <button
                type="button"
                onClick={() => {
                  setCreateMode('manual');
                  resetForm();
                }}
                className="flex flex-col items-center gap-3 rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                  <Edit className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Manual</h3>
                <p className="text-sm text-gray-600 text-center">Create a custom variable manually</p>
              </button>

              <button
                type="button"
                onClick={() => setCreateMode('ai')}
                className="flex flex-col items-center gap-3 rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm transition hover:border-purple-300 hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
                  <Sparkles className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">AI Generate</h3>
                <p className="text-sm text-gray-600 text-center">Use AI to generate variable definitions</p>
              </button>
            </div>
          )}
        </div>

        {/* Create Forms */}
        {showCreateOptions && createMode && (
          <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            {createMode === 'manual' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {editingId ? 'Edit Variable' : 'Create Variable'}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Variable Key *</label>
                    <input
                      type="text"
                      value={form.variableKey}
                      onChange={(e) => setForm((f) => ({ ...f, variableKey: e.target.value }))}
                      placeholder="custom_field_name"
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                      disabled={!!editingId}
                    />
                    <p className="mt-1 text-xs text-gray-500">Used as {'{{variableKey}}'} in templates</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Source *</label>
                    <select
                      value={form.source}
                      onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    >
                      {SOURCES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="What this variable represents"
                      rows={2}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  {(form.source === 'CONTACT' || form.source === 'OWNER') && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">DB Field</label>
                      <input
                        type="text"
                        value={form.dbField}
                        onChange={(e) => setForm((f) => ({ ...f, dbField: e.target.value }))}
                        placeholder="firstName"
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                      />
                      <p className="mt-1 text-xs text-gray-500">Field name in the database</p>
                    </div>
                  )}
                  {(form.source === 'COMPUTED' || form.source === 'CUSTOM') && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Computed Rule</label>
                      <textarea
                        value={form.computedRule}
                        onChange={(e) => setForm((f) => ({ ...f, computedRule: e.target.value }))}
                        placeholder="How to compute this value"
                        rows={3}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-gray-600">
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
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={handleManualSave}
                    disabled={saving}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelCreate}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {createMode === 'ai' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Generation Coming Soon</h3>
                <p className="text-sm text-gray-600 mb-4">
                  AI generation for variables will be available soon. For now, please create variables manually.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCreateMode('manual');
                    resetForm();
                  }}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Create Manually Instead
                </button>
              </div>
            )}
          </div>
        )}

        {/* Variables List */}
        {!showCreateOptions && (
          <div className="space-y-6">
            {/* Built-in Variables */}
            {builtInVariables.length > 0 && (
              <div className="rounded-xl bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Lock className="h-5 w-5 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-900">Built-in Variables</h3>
                  <span className="text-sm text-gray-500">({builtInVariables.length})</span>
                </div>
                <p className="mb-4 text-sm text-gray-600">
                  These standard variables are always available and cannot be deleted.
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead>
                      <tr>
                        <th className="py-2 text-left font-medium text-gray-700">Key</th>
                        <th className="py-2 text-left font-medium text-gray-700">Source</th>
                        <th className="py-2 text-left font-medium text-gray-700">Description</th>
                        <th className="py-2 text-left font-medium text-gray-700">DB Field</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {builtInVariables.map((v) => (
                        <tr key={v.id}>
                          <td className="py-2 font-mono text-gray-900">{`{{${v.variableKey}}}`}</td>
                          <td className="py-2">
                            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs">{v.source}</span>
                          </td>
                          <td className="py-2 text-gray-600">{v.description || '—'}</td>
                          <td className="py-2 text-gray-600">{v.dbField || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Custom Variables */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Custom Variables {customVariables.length > 0 && `(${customVariables.length})`}
              </h3>
              {loading ? (
                <p className="text-gray-500">Loading…</p>
              ) : customVariables.length === 0 ? (
                <div className="text-center py-12">
                  <Code className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No custom variables yet</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Create your first custom variable to get started. Use them in templates as{' '}
                    <code className="rounded bg-gray-100 px-1">{'{{variableKey}}'}</code>.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCreateOptions(true)}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Create Variable
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead>
                      <tr>
                        <th className="py-2 text-left font-medium text-gray-700">Key</th>
                        <th className="py-2 text-left font-medium text-gray-700">Source</th>
                        <th className="py-2 text-left font-medium text-gray-700">Description</th>
                        <th className="py-2 text-left font-medium text-gray-700">DB Field / Rule</th>
                        <th className="py-2 text-left font-medium text-gray-700">Status</th>
                        <th className="py-2 text-right font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {customVariables.map((v) => (
                        <tr key={v.id} className={!v.isActive ? 'bg-gray-50 opacity-75' : ''}>
                          <td className="py-2 font-mono text-gray-900">{`{{${v.variableKey}}}`}</td>
                          <td className="py-2">
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{v.source}</span>
                          </td>
                          <td className="py-2 text-gray-600">{v.description || '—'}</td>
                          <td className="py-2 text-gray-600">
                            {v.dbField || v.computedRule || '—'}
                          </td>
                          <td className="py-2">
                            {v.isActive ? (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                Active
                              </span>
                            ) : (
                              <span className="text-gray-400">Inactive</span>
                            )}
                          </td>
                          <td className="py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => startEdit(v)}
                                className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(v.id)}
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
          </div>
        )}
      </div>
    </div>
  );
}

export default function VariablesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <p className="text-gray-600">Loading…</p>
          </div>
        </div>
      }
    >
      <VariablesLandingPage />
    </Suspense>
  );
}
