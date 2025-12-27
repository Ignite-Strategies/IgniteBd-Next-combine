'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit, Trash2, FileCode, Plus } from 'lucide-react';
import api from '@/lib/api';
import { useOwner } from '@/hooks/useOwner';
import PageHeader from '@/components/PageHeader.jsx';

/**
 * Email Template Library Page
 * View and manage email templates created by ownerId
 */
function EmailTemplateLibraryContent() {
  const router = useRouter();
  const { ownerId } = useOwner();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (ownerId) {
      loadTemplates();
    }
  }, [ownerId]);

  const loadTemplates = async () => {
    if (!ownerId) return;

    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/api/templates?ownerId=${ownerId}`);
      if (response.data?.success) {
        setTemplates(response.data.templates || []);
      } else {
        setError('Failed to load templates');
      }
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (templateId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      const response = await api.delete(`/api/templates/${templateId}`);
      if (response.data?.success) {
        // Remove from list
        setTemplates(templates.filter(t => t.id !== templateId));
      } else {
        alert('Failed to delete template');
      }
    } catch (err) {
      console.error('Error deleting template:', err);
      alert('Failed to delete template');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-sm font-semibold text-gray-600">Loading templates...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <PageHeader
            title="Email Templates"
            subtitle="View and manage your email templates"
          />
        </div>

        {error && (
          <div className="mb-4 rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              My Templates ({templates.length})
            </h2>
          </div>
          <button
            onClick={() => router.push('/templates/create')}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition"
          >
            <Plus className="h-4 w-4" />
            Create New
          </button>
        </div>

        {templates.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow">
            <FileCode className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No templates yet</h3>
            <p className="text-sm text-gray-600 mb-6">
              Create your first email template to get started
            </p>
            <button
              onClick={() => router.push('/templates/create')}
              className="rounded-lg bg-red-600 px-6 py-2 text-sm font-semibold text-white hover:bg-red-700 transition"
            >
              Create Your First Template
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div
                key={template.id}
                onClick={() => router.push(`/builder/template/${template.id}`)}
                className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer hover:border-red-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {template.title || 'Untitled Template'}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-1">
                      <strong>Subject:</strong> {template.subject || 'No subject'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Created {new Date(template.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(template.id, e)}
                    className="ml-2 p-2 text-gray-400 hover:text-red-600 transition"
                    title="Delete template"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/builder/template/${template.id}`);
                    }}
                    className="flex items-center gap-2 w-full justify-center rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition"
                  >
                    <Edit className="h-4 w-4" />
                    Edit Template
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function EmailTemplateLibraryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <EmailTemplateLibraryContent />
    </Suspense>
  );
}

