'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FileStack,
  Plus,
  Upload,
  Sparkles,
  Edit,
  Pencil,
  Trash2,
  ArrowLeft,
  CheckCircle,
  X,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';

const SNIP_TYPES = [
  'subject',
  'opening', // Replaces generic "intent" - strategic openings
  'service',
  'competitor',
  'value',
  'cta',
  'relationship',
  'generic',
];

function ContentSnipsLandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';

  const [snips, setSnips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateOptions, setShowCreateOptions] = useState(false);
  const [createMode, setCreateMode] = useState(null); // 'manual', 'ai', 'upload'
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedSnips, setSelectedSnips] = useState(new Set()); // For bulk delete
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Form state for manual creation
  const [form, setForm] = useState({
    snipName: '',
    snipText: '',
    snipType: 'generic',
    assemblyHelperPersonas: [],
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [personas, setPersonas] = useState([]);
  const [loadingPersonas, setLoadingPersonas] = useState(false);

  // Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [previewData, setPreviewData] = useState(null); // Parsed CSV data for preview/edit
  const [showPreview, setShowPreview] = useState(false);

  // AI generation state
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    if (!companyHQId && typeof window !== 'undefined') {
      const stored = localStorage.getItem('companyHQId');
      if (stored) {
        router.replace(`/content-snips?companyHQId=${stored}`);
      }
    }
  }, [companyHQId, router]);

  useEffect(() => {
    if (companyHQId) {
      loadSnips();
      loadPersonas();
    } else {
      setLoading(false);
    }
  }, [companyHQId]);

  const loadPersonas = async () => {
    setLoadingPersonas(true);
    try {
      const res = await api.get('/api/outreach-personas');
      if (res.data?.success) {
        setPersonas(res.data.personas || []);
      }
    } catch (err) {
      console.error('Failed to load personas:', err);
    } finally {
      setLoadingPersonas(false);
    }
  };

  const loadSnips = async () => {
    if (!companyHQId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/outreach/content-snips?companyHQId=${companyHQId}&activeOnly=false`);
      if (res.data?.success) {
        setSnips(res.data.snips || []);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load content snips');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSave = async () => {
    if (!companyHQId || !form.snipName?.trim() || !form.snipText?.trim()) {
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
          assemblyHelperPersonas: form.assemblyHelperPersonas || [],
          isActive: form.isActive,
        });
        if (res.data?.success) {
          setSuccess('Content snip updated successfully!');
          loadSnips();
          resetForm();
          setCreateMode(null);
          setShowCreateOptions(false);
        }
      } else {
        const res = await api.post('/api/outreach/content-snips', {
          companyHQId,
          snipName: form.snipName.trim(),
          snipText: form.snipText,
          snipType: form.snipType,
          assemblyHelperPersonas: form.assemblyHelperPersonas || [],
          isActive: form.isActive,
        });
        if (res.data?.success) {
          setSuccess('Content snip created successfully!');
          loadSnips();
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

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) {
      setError('Please enter a prompt for AI generation');
      return;
    }
    setGeneratingAI(true);
    setError('');
    try {
      const res = await api.post('/api/outreach/content-snips/generate', {
        companyHQId,
        prompt: aiPrompt.trim(),
      });
      if (res.data?.success) {
        const generated = res.data.snip;
        setForm({
          snipName: generated.snipName || '',
          snipText: generated.snipText || '',
          snipType: generated.snipType || 'generic',
          contextType: generated.contextType || '',
          intentType: generated.intentType || '',
          isActive: true,
        });
        setCreateMode('manual');
        setAiPrompt('');
        setSuccess('AI generated content snip! Review and save below.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate with AI');
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !companyHQId) {
      setError('Select a CSV file.');
      return;
    }
    
    if (!previewData || previewData.rows.length === 0) {
      setError('No data to upload. Please review the preview.');
      return;
    }
    
    setUploading(true);
    setError('');
    setUploadResult(null);
    
    // If preview data exists, create CSV from edited data
    let csvBlob;
    if (previewData) {
      // Convert preview data back to CSV
      const headers = previewData.headers;
      const csvLines = [
        headers.join(','), // Header row
        ...previewData.rows.map(row => 
          headers.map(h => {
            const val = row[h] || '';
            // Escape quotes and wrap in quotes if contains comma or quote
            if (val.includes(',') || val.includes('"') || val.includes('\n')) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          }).join(',')
        )
      ];
      const csvText = csvLines.join('\n');
      csvBlob = new Blob([csvText], { type: 'text/csv' });
    } else {
      csvBlob = uploadFile;
    }
    
    const fd = new FormData();
    fd.append('file', csvBlob, uploadFile.name);
    fd.append('companyHQId', companyHQId);
    
    try {
      const res = await api.post('/api/outreach/content-snips/csv', fd);
      
      if (res.data?.success) {
        setUploadResult(res.data);
        setSuccess(`Uploaded: ${res.data.created} created, ${res.data.updated} updated.`);
        loadSnips();
        setUploadFile(null);
        setPreviewData(null);
        setShowPreview(false);
        // Reset file input
        const input = document.getElementById('csv-upload-input');
        if (input) input.value = '';
        setCreateMode(null);
        setShowCreateOptions(false);
      } else {
        setError(res.data?.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this content snip? This cannot be undone.')) return;
    try {
      await api.delete(`/api/outreach/content-snips/${id}`);
      setSuccess('Content snip deleted successfully!');
      loadSnips();
      setSelectedSnips(new Set());
      if (editingId === id) {
        resetForm();
        setCreateMode(null);
        setShowCreateOptions(false);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSnips.size === 0) {
      setError('No snippets selected.');
      return;
    }
    
    if (!window.confirm(`Delete ${selectedSnips.size} content snippet(s)? This cannot be undone.`)) return;
    
    setBulkDeleting(true);
    setError('');
    
    try {
      const deletePromises = Array.from(selectedSnips).map((id) =>
        api.delete(`/api/outreach/content-snips/${id}`).catch((err) => {
          console.error(`Failed to delete ${id}:`, err);
          return { error: err.response?.data?.error || 'Failed to delete' };
        })
      );
      
      const results = await Promise.all(deletePromises);
      const errors = results.filter((r) => r?.error);
      
      if (errors.length > 0) {
        setError(`Deleted ${selectedSnips.size - errors.length} snippets. ${errors.length} failed.`);
      } else {
        setSuccess(`Successfully deleted ${selectedSnips.size} snippet(s)!`);
      }
      
      setSelectedSnips(new Set());
      loadSnips();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete snippets');
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleSelectSnip = (id) => {
    const newSelected = new Set(selectedSnips);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedSnips(newSelected);
  };

  const selectAllSnips = (snipList) => {
    if (selectedSnips.size === snipList.length) {
      setSelectedSnips(new Set());
    } else {
      setSelectedSnips(new Set(snipList.map((s) => s.id)));
    }
  };

  const startEdit = (snip) => {
    setEditingId(snip.id);
    setCreateMode('manual');
    setShowCreateOptions(true);
    setForm({
      snipName: snip.snipName,
      snipText: snip.snipText || '',
      snipType: snip.snipType || 'generic',
      assemblyHelperPersonas: snip.assemblyHelperPersonas || [],
      isActive: snip.isActive !== false,
    });
  };

  const resetForm = () => {
    setForm({
      snipName: '',
      snipText: '',
      snipType: 'generic',
      assemblyHelperPersonas: [],
      isActive: true,
    });
    setEditingId(null);
    setError('');
  };

  const cancelCreate = () => {
    resetForm();
    setCreateMode(null);
    setShowCreateOptions(false);
    setUploadFile(null);
    setAiPrompt('');
    setUploadResult(null);
    setPreviewData(null);
    setShowPreview(false);
    // Reset file input
    const input = document.getElementById('csv-upload-input');
    if (input) input.value = '';
  };

  // Client-side CSV parser (preserves header casing)
  const parseCSVClient = (csvText) => {
    const lines = csvText.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length === 0) return { headers: [], rows: [], errors: [] };
    
    const parseLine = (line) => {
      const out = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        const next = line[i + 1];
        if (c === '"') {
          if (inQuotes && next === '"') {
            cur += '"';
            i++;
          } else inQuotes = !inQuotes;
        } else if (c === ',' && !inQuotes) {
          out.push(cur.trim());
          cur = '';
        } else cur += c;
      }
      out.push(cur.trim());
      return out;
    };
    
    const rawHeaders = parseLine(lines[0]);
    const headers = rawHeaders.map((h) => h.trim()).filter(Boolean);
    const rows = [];
    const errors = [];
    
    for (let i = 1; i < lines.length; i++) {
      const vals = parseLine(lines[i]);
      if (vals.every((v) => !v.trim())) continue;
      if (vals.length !== headers.length) {
        errors.push(`Row ${i + 1}: expected ${headers.length} columns, got ${vals.length}`);
        continue;
      }
      const row = {};
      headers.forEach((h, j) => {
        row[h] = vals[j]?.trim() ?? '';
      });
      rows.push(row);
    }
    
    return { headers, rows, errors };
  };

  // Handle file selection and parse for preview
  const handleFileSelect = async (file) => {
    if (!file) {
      setUploadFile(null);
      setPreviewData(null);
      setShowPreview(false);
      return;
    }
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a CSV file.');
      return;
    }
    
    setUploadFile(file);
    setError('');
    setPreviewData(null);
    
    try {
      const text = await file.text();
      const parsed = parseCSVClient(text);
      
      if (parsed.errors.length > 0) {
        setError(`CSV parsing errors: ${parsed.errors.join('; ')}`);
        return;
      }
      
      if (parsed.rows.length === 0) {
        setError('CSV file has no data rows.');
        return;
      }
      
      setPreviewData(parsed);
      setShowPreview(true);
    } catch (err) {
      setError('Failed to read CSV file: ' + err.message);
    }
  };

  // Update preview row data
  const updatePreviewRow = (index, field, value) => {
    if (!previewData) return;
    const newRows = [...previewData.rows];
    newRows[index] = { ...newRows[index], [field]: value };
    setPreviewData({ ...previewData, rows: newRows });
  };

  // Remove row from preview
  const removePreviewRow = (index) => {
    if (!previewData) return;
    const newRows = previewData.rows.filter((_, i) => i !== index);
    setPreviewData({ ...previewData, rows: newRows });
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Content Snips"
          subtitle="Manage reusable content blocks for your templates. Use in templates as {{snippet:snipName}}."
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
              {snips.length > 0 ? `Your Content Snips (${snips.length})` : 'Content Snips'}
            </h2>
            {!showCreateOptions && (
              <button
                type="button"
                onClick={() => setShowCreateOptions(true)}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                Create Content Snip
              </button>
            )}
          </div>

          {/* Create Options */}
          {showCreateOptions && !createMode && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
                <p className="text-sm text-gray-600 text-center">Create a content snip manually by filling out the form</p>
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
                <p className="text-sm text-gray-600 text-center">Use AI to generate content snips from a prompt</p>
              </button>

              <button
                type="button"
                onClick={() => setCreateMode('upload')}
                className="flex flex-col items-center gap-3 rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm transition hover:border-green-300 hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
                  <Upload className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Upload CSV</h3>
                <p className="text-sm text-gray-600 text-center">Upload multiple content snips from a CSV file</p>
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
                  {editingId ? 'Edit Content Snip' : 'Create Content Snip'}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Snip Name *</label>
                    <input
                      type="text"
                      value={form.snipName}
                      onChange={(e) => setForm((f) => ({ ...f, snipName: e.target.value }))}
                      placeholder="opening_reconnect_prior_conversation"
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                      disabled={!!editingId}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Snip Type *</label>
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
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Assembly Helper Personas (Optional)
                    </label>
                    <p className="mb-2 text-xs text-gray-500">
                      Which personas does this snippet work well for? Select multiple. Leave empty for general use.
                    </p>
                    {loadingPersonas ? (
                      <p className="text-sm text-gray-500">Loading personas...</p>
                    ) : (
                      <div className="space-y-2">
                        {personas.map((p) => (
                          <label key={p.slug} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={form.assemblyHelperPersonas.includes(p.slug)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setForm((f) => ({
                                    ...f,
                                    assemblyHelperPersonas: [...f.assemblyHelperPersonas, p.slug],
                                  }));
                                } else {
                                  setForm((f) => ({
                                    ...f,
                                    assemblyHelperPersonas: f.assemblyHelperPersonas.filter((slug) => slug !== p.slug),
                                  }));
                                }
                              }}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm">
                              {p.name} {p.description ? <span className="text-gray-500">- {p.description}</span> : ''}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Snip Text * (supports {{firstName}}, etc.)
                  </label>
                  <textarea
                    value={form.snipText}
                    onChange={(e) => setForm((f) => ({ ...f, snipText: e.target.value }))}
                    placeholder="I wanted to reach out..."
                    rows={6}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="mt-4 flex items-center gap-2">
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
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate with AI</h3>
                <div className="mb-4">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Describe what you want the content snip to say
                  </label>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g., A friendly opening for reaching out to old contacts"
                    rows={4}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAIGenerate}
                    disabled={generatingAI || !aiPrompt.trim()}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
                  >
                    {generatingAI ? 'Generating…' : 'Generate'}
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

            {createMode === 'upload' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload CSV</h3>
                <p className="mb-4 text-sm text-gray-600">
                  Columns: <code className="rounded bg-gray-200 px-1">snip_name</code>,{' '}
                  <code className="rounded bg-gray-200 px-1">snip_text</code>,{' '}
                  <code className="rounded bg-gray-200 px-1">snip_type</code> (optional, default generic),{' '}
                  <code className="rounded bg-gray-200 px-1">assembly_helper_personas</code> (optional: comma-separated persona slugs like "FormerColleague,UsesCompetitor").{' '}
                  <a
                    href="data:text/csv;charset=utf-8,snip_name,snip_text,snip_type%0Aopening_reconnect_prior_conversation,Following up on our conversation about {{topic}},opening%0Acta_brief_call_worthwhile,Please let me know if a brief call would be worthwhile.,cta"
                    download="content-snips-template.csv"
                    className="text-red-600 hover:underline"
                  >
                    Download template CSV
                  </a>
                </p>
                
                {!showPreview ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="w-8 h-8 mb-2 text-gray-500" />
                          <p className="mb-2 text-sm text-gray-500">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-gray-500">CSV file only</p>
                        </div>
                        <input
                          type="file"
                          accept=".csv"
                          onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                          className="hidden"
                          id="csv-upload-input"
                        />
                      </label>
                    </div>
                    {uploadFile && !showPreview && (
                      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-blue-600" />
                        <span className="text-sm text-blue-800 font-medium">{uploadFile.name}</span>
                        <span className="text-xs text-blue-600">({(uploadFile.size / 1024).toFixed(2)} KB)</span>
                        <span className="text-xs text-blue-600 ml-auto">Parsing...</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="text-sm text-green-800 font-medium">
                          {uploadFile.name} • {previewData.rows.length} rows ready
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadFile(null);
                          setPreviewData(null);
                          setShowPreview(false);
                          const input = document.getElementById('csv-upload-input');
                          if (input) input.value = '';
                        }}
                        className="text-green-600 hover:text-green-800"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Preview/Edit Table */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-900">
                          Review & Edit ({previewData.rows.length} entries)
                        </h4>
                        <p className="text-xs text-gray-600 mt-1">
                          Edit any fields below before uploading. Click "Save & Upload" when ready.
                        </p>
                      </div>
                      <div className="overflow-x-auto max-h-96 overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              {previewData.headers.map((header) => (
                                <th key={header} className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                  {header}
                                </th>
                              ))}
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {previewData.rows.map((row, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                {previewData.headers.map((header) => (
                                  <td key={header} className="px-3 py-2">
                                    {header === 'snip_text' ? (
                                      <textarea
                                        value={row[header] || ''}
                                        onChange={(e) => updatePreviewRow(idx, header, e.target.value)}
                                        className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                                        rows={2}
                                      />
                                    ) : (
                                      <input
                                        type="text"
                                        value={row[header] || ''}
                                        onChange={(e) => updatePreviewRow(idx, header, e.target.value)}
                                        className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                                      />
                                    )}
                                  </td>
                                ))}
                                <td className="px-3 py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() => removePreviewRow(idx)}
                                    className="text-red-600 hover:text-red-800"
                                    title="Remove row"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleUpload}
                        disabled={uploading || !previewData || previewData.rows.length === 0}
                        className="rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {uploading ? (
                          <>
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Uploading…
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            Save & Upload ({previewData?.rows.length || 0} entries)
                          </>
                        )}
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
                
                {uploadResult && (
                  <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
                    Uploaded: {uploadResult.created} created, {uploadResult.updated} updated.
                    {uploadResult.errors?.length > 0 && (
                      <div className="mt-1 text-amber-700">
                        {uploadResult.errors.slice(0, 5).join(' ')}
                        {uploadResult.errors.length > 5 && ` +${uploadResult.errors.length - 5} more`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Snips List */}
        {!showCreateOptions && (
          <div className="space-y-6">
            {/* Bulk Actions Bar */}
            {snips.length > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-700">
                    {selectedSnips.size > 0 ? `${selectedSnips.size} selected` : 'Select snippets to delete'}
                  </span>
                  {selectedSnips.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedSnips(new Set())}
                      className="text-xs text-gray-600 hover:text-gray-900 underline"
                    >
                      Clear selection
                    </button>
                  )}
                </div>
                {selectedSnips.size > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    {bulkDeleting ? 'Deleting...' : `Delete ${selectedSnips.size}`}
                  </button>
                )}
              </div>
            )}

            {/* Subject Line Snippets */}
            {snips.filter((s) => s.snipType === 'subject').length > 0 && (
              <div className="rounded-xl bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Subject Lines</h3>
                    <p className="text-sm text-gray-600">
                      {snips.filter((s) => s.snipType === 'subject').length} subject line snippet(s)
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead>
                      <tr>
                        <th className="py-2 text-left font-medium text-gray-700 w-8">
                          <input
                            type="checkbox"
                            checked={snips.filter((s) => s.snipType === 'subject').length > 0 && 
                              snips.filter((s) => s.snipType === 'subject').every((s) => selectedSnips.has(s.id))}
                            onChange={() => selectAllSnips(snips.filter((s) => s.snipType === 'subject'))}
                            className="rounded border-gray-300"
                          />
                        </th>
                        <th className="py-2 text-left font-medium text-gray-700">Name</th>
                        <th className="py-2 text-left font-medium text-gray-700">Helper Personas</th>
                        <th className="py-2 text-left font-medium text-gray-700">Text</th>
                        <th className="py-2 text-left font-medium text-gray-700">Status</th>
                        <th className="py-2 text-right font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {snips
                        .filter((s) => s.snipType === 'subject')
                        .map((s) => (
                          <tr key={s.id} className={!s.isActive ? 'bg-gray-50 opacity-75' : ''}>
                            <td className="py-2">
                              <input
                                type="checkbox"
                                checked={selectedSnips.has(s.id)}
                                onChange={() => toggleSelectSnip(s.id)}
                                className="rounded border-gray-300"
                              />
                            </td>
                            <td className="py-2 font-mono text-gray-900">{s.snipName}</td>
                            <td className="py-2 text-gray-600">
                              {s.bestForPersonaType?.replace(/_/g, ' ') || 'General'}
                            </td>
                            <td className="max-w-xs py-2 text-gray-600 line-clamp-2" title={s.snipText}>
                              {s.snipText}
                            </td>
                            <td className="py-2">
                              {s.isActive ? (
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
              </div>
            )}

            {/* Other Snippets */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              {loading ? (
                <p className="text-gray-500">Loading…</p>
              ) : snips.filter((s) => s.snipType !== 'subject').length === 0 ? (
                <div className="text-center py-12">
                  <FileStack className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No content snips yet</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Create your first content snip to get started. Use them in templates as{' '}
                    <code className="rounded bg-gray-100 px-1">{'{{snippet:snip_name}}'}</code>.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCreateOptions(true)}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Create Content Snip
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Content Snippets</h3>
                      <p className="text-sm text-gray-600">
                        {snips.filter((s) => s.snipType !== 'subject').length} snippet(s)
                      </p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead>
                        <tr>
                          <th className="py-2 text-left font-medium text-gray-700 w-8">
                            <input
                              type="checkbox"
                              checked={snips.filter((s) => s.snipType !== 'subject').length > 0 && 
                                snips.filter((s) => s.snipType !== 'subject').every((s) => selectedSnips.has(s.id))}
                              onChange={() => selectAllSnips(snips.filter((s) => s.snipType !== 'subject'))}
                              className="rounded border-gray-300"
                            />
                          </th>
                          <th className="py-2 text-left font-medium text-gray-700">Name</th>
                          <th className="py-2 text-left font-medium text-gray-700">Type</th>
                          <th className="py-2 text-left font-medium text-gray-700">Helper Personas</th>
                          <th className="py-2 text-left font-medium text-gray-700">Text</th>
                          <th className="py-2 text-left font-medium text-gray-700">Status</th>
                          <th className="py-2 text-right font-medium text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {snips
                          .filter((s) => s.snipType !== 'subject')
                          .map((s) => (
                            <tr key={s.id} className={!s.isActive ? 'bg-gray-50 opacity-75' : ''}>
                              <td className="py-2">
                                <input
                                  type="checkbox"
                                  checked={selectedSnips.has(s.id)}
                                  onChange={() => toggleSelectSnip(s.id)}
                                  className="rounded border-gray-300"
                                />
                              </td>
                              <td className="py-2 font-mono text-gray-900">{s.snipName}</td>
                              <td className="py-2">
                                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{s.snipType}</span>
                              </td>
                              <td className="py-2 text-gray-600">
                                {s.assemblyHelperPersonas && s.assemblyHelperPersonas.length > 0
                                  ? s.assemblyHelperPersonas.join(', ')
                                  : 'General'}
                              </td>
                              <td className="max-w-xs py-2 text-gray-600 line-clamp-2" title={s.snipText}>
                                {s.snipText}
                              </td>
                              <td className="py-2">
                                {s.isActive ? (
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
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ContentSnipsPage() {
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
      <ContentSnipsLandingPage />
    </Suspense>
  );
}
