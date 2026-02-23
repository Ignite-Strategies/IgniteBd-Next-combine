'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  X,
  Search,
  Tag,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';

function OutreachPersonasPage() {
  const router = useRouter();
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSlug, setEditingSlug] = useState(null);
  const [deletingSlug, setDeletingSlug] = useState(null);

  // Form state
  const [form, setForm] = useState({
    slug: '',
    name: '',
    description: '',
  });

  useEffect(() => {
    loadPersonas();
  }, []);

  const loadPersonas = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/outreach-personas');
      if (res.data?.success) {
        setPersonas(res.data.personas || []);
      }
    } catch (err) {
      console.error('Failed to load personas:', err);
      setError('Failed to load personas');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.slug || !form.name) {
      setError('Slug and name are required');
      return;
    }

    // Normalize slug: remove spaces, camelCase
    const normalizedSlug = form.slug
      .trim()
      .replace(/\s+/g, '')
      .replace(/^[a-z]/, (c) => c.toUpperCase());

    try {
      const res = await api.post('/api/outreach-personas', {
        slug: normalizedSlug,
        name: form.name.trim(),
        description: form.description.trim() || null,
      });

      if (res.data?.success) {
        setSuccess('Persona created successfully');
        setForm({ slug: '', name: '', description: '' });
        setShowCreateForm(false);
        loadPersonas();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create persona');
    }
  };

  const startEdit = (persona) => {
    setEditingSlug(persona.slug);
    setForm({
      slug: persona.slug,
      name: persona.name,
      description: persona.description || '',
    });
  };

  const cancelEdit = () => {
    setEditingSlug(null);
    setForm({ slug: '', name: '', description: '' });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.name) {
      setError('Name is required');
      return;
    }

    try {
      const res = await api.put(`/api/outreach-personas/${editingSlug}`, {
        name: form.name.trim(),
        description: form.description.trim() || null,
      });

      if (res.data?.success) {
        setSuccess('Persona updated successfully');
        setEditingSlug(null);
        setForm({ slug: '', name: '', description: '' });
        loadPersonas();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update persona');
    }
  };

  const handleDelete = async (slug) => {
    if (!confirm(`Delete persona "${slug}"? This cannot be undone.`)) {
      return;
    }

    setDeletingSlug(slug);
    setError('');
    setSuccess('');

    try {
      const res = await api.delete(`/api/outreach-personas/${slug}`);
      if (res.data?.success) {
        setSuccess('Persona deleted successfully');
        loadPersonas();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete persona');
    } finally {
      setDeletingSlug(null);
    }
  };

  const filteredPersonas = personas.filter((p) => {
    const query = searchQuery.toLowerCase();
    return (
      p.slug.toLowerCase().includes(query) ||
      p.name.toLowerCase().includes(query) ||
      (p.description && p.description.toLowerCase().includes(query))
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Outreach Persona Bank"
        subtitle="Manage persona slugs for snippet assembly"
      />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Messages */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 flex items-center gap-2 text-red-800">
            <X className="h-5 w-5" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-4 flex items-center gap-2 text-green-800">
            <CheckCircle className="h-5 w-5" />
            {success}
          </div>
        )}

        {/* Header Actions */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search personas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
              />
            </div>
          </div>
          <button
            onClick={() => {
              setShowCreateForm(true);
              setForm({ slug: '', name: '', description: '' });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            <Plus className="h-5 w-5" />
            Add Persona
          </button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-semibold mb-4">Create New Persona</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Slug * (e.g., FormerColleagueNowReachingoutAgainAfterLongTime)
                </label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="FormerColleagueNowReachingoutAgainAfterLongTime"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  No spaces, camelCase. This is the unique identifier.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Former Colleague - Long Time"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Someone you worked with before, reaching out again after a long time"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Create Persona
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setForm({ slug: '', name: '', description: '' });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Personas List */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading personas...</div>
        ) : filteredPersonas.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {searchQuery ? 'No personas match your search' : 'No personas yet. Create one to get started.'}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Slug
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPersonas.map((persona) => (
                  <tr key={persona.slug} className="hover:bg-gray-50">
                    {editingSlug === persona.slug ? (
                      <>
                        <td className="px-6 py-4">
                          <code className="text-sm font-mono text-gray-900">{persona.slug}</code>
                        </td>
                        <td className="px-6 py-4" colSpan={2}>
                          <form onSubmit={handleUpdate} className="space-y-3">
                            <div>
                              <input
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder="Display Name"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                                required
                              />
                            </div>
                            <div>
                              <textarea
                                value={form.description}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                placeholder="Description"
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="submit"
                                className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="px-3 py-1.5 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 transition"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        </td>
                        <td className="px-6 py-4 text-right"></td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4">
                          <code className="text-sm font-mono text-gray-900">{persona.slug}</code>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">{persona.name}</td>
                        <td className="px-6 py-4 text-gray-600">
                          {persona.description || <span className="text-gray-400 italic">No description</span>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => startEdit(persona)}
                              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(persona.slug)}
                              disabled={deletingSlug === persona.slug}
                              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Stats */}
        {!loading && (
          <div className="mt-6 text-sm text-gray-500">
            Showing {filteredPersonas.length} of {personas.length} persona{personas.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <OutreachPersonasPage />
    </Suspense>
  );
}
