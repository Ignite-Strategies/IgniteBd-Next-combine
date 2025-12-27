'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Save, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { useOwner } from '@/hooks/useOwner';
import { VariableCatalogue } from '@/lib/variables/catalogue';

/**
 * Template Builder Page
 * Simple straight save - no Redis, no preview complexity
 */
export default function TemplateBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = params.templateId;
  const isNew = templateId === 'new';
  const cloneFrom = searchParams?.get('cloneFrom');
  
  const { ownerId } = useOwner();

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew && !cloneFrom);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [currentTemplateId, setCurrentTemplateId] = useState(templateId);

  useEffect(() => {
    if (!isNew && templateId) {
      loadTemplate();
    } else if (cloneFrom) {
      loadTemplateToClone(cloneFrom);
    }
  }, [templateId, isNew, cloneFrom]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/templates/${templateId}`);
      if (response.data?.success) {
        const template = response.data.template;
        setTitle(template.title || '');
        setSubject(template.subject || '');
        setBody(template.body || '');
      }
    } catch (err) {
      console.error('Error loading template:', err);
      setError('Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplateToClone = async (sourceTemplateId) => {
    try {
      setLoading(true);
      const response = await api.get(`/api/templates/${sourceTemplateId}`);
      if (response.data?.success) {
        const template = response.data.template;
        setTitle(`${template.title || ''} (Copy)`);
        setSubject(template.subject || '');
        setBody(template.body || '');
      }
    } catch (err) {
      console.error('Error loading template to clone:', err);
      setError('Failed to load template to clone');
    } finally {
      setLoading(false);
    }
  };

  // Insert variable into body at cursor position
  const insertVariable = (variableKey) => {
    const variable = `{{${variableKey}}}`;
    const textarea = document.getElementById('body-textarea');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = body;
      const newText = text.substring(0, start) + variable + text.substring(end);
      setBody(newText);
      // Set cursor position after inserted variable
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    } else {
      // Fallback: append to end
      setBody(prev => prev + variable);
    }
  };

  const handleSave = async () => {
    if (!ownerId) {
      setError('Owner not found. Please refresh the page.');
      return;
    }

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (!subject.trim() || !body.trim()) {
      setError('Subject and body are required');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const data = {
        ownerId,
        title: title.trim(),
        subject: subject.trim(),
        body: body.trim(),
      };

      let template;
      if (isNew) {
        const response = await api.post('/api/templates', data);
        if (!response.data?.success) {
          throw new Error(response.data?.error || 'Failed to create template');
        }
        template = response.data.template;
      } else {
        const response = await api.patch(`/api/templates/${templateId}`, data);
        if (!response.data?.success) {
          throw new Error(response.data?.error || 'Failed to update template');
        }
        template = response.data.template;
      }

      // Show success message and update URL without full redirect
      setSaveSuccess(true);
      // Update template ID state and URL to reflect the saved template ID
      if (isNew) {
        setCurrentTemplateId(template.id);
        window.history.replaceState({}, '', `/builder/template/${template.id}`);
      }
      // Clear success message after 5 seconds
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err) {
      console.error('Error saving template:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-sm font-semibold text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            {isNew && !saveSuccess ? 'Create Template' : 'Edit Template'}
          </h1>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          {saveSuccess && (
            <div className="mb-4 rounded bg-green-50 border border-green-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-green-800 mb-1">✅ Template saved successfully!</p>
                  <p className="text-sm text-green-700">What would you like to do next?</p>
                </div>
              </div>
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => router.push('/outreach/compose')}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition"
                >
                  Send an Email
                </button>
                <button
                  onClick={() => router.push('/templates')}
                  className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 text-sm font-semibold hover:bg-gray-300 transition"
                >
                  View All Templates
                </button>
              </div>
            </div>
          )}
          {error && (
            <div className="mb-4 rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Reaching out to old friend"
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Subject *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject line (use {{variables}})"
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Body *
              </label>
              <div className="mb-2 rounded-lg bg-blue-50 border border-blue-200 p-3">
                <p className="text-sm text-blue-800">
                  <strong>💡 Tip:</strong> Start with a greeting like &quot;Hey {'{{'}firstName{'}}'},&quot; or &quot;Hi {'{{'}firstName{'}}'},&quot;
                </p>
              </div>
              <textarea
                id="body-textarea"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Hey {{firstName}},\n\nYour email body here with {{variables}}..."
                rows={12}
                className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
              />
            </div>

            {/* Available Variables - Always Visible, Better Styling */}
            <div className="rounded-lg border-2 border-gray-200 bg-gray-50 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">Available Variables</h3>
                <p className="text-sm text-gray-600 italic">Click any variable to insert it into your template</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.values(VariableCatalogue).map((variable) => (
                  <button
                    key={variable.key}
                    type="button"
                    onClick={() => insertVariable(variable.key)}
                    className="text-left px-4 py-3 rounded-lg bg-white border-2 border-gray-200 hover:border-red-400 hover:bg-red-50 transition-all shadow-sm hover:shadow"
                    title={variable.description}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-red-600 font-mono font-semibold text-base">{`{{${variable.key}}}`}</code>
                    </div>
                    {variable.description && (
                      <p className="text-gray-600 text-sm italic">{variable.description}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-2 border-t border-gray-200">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded bg-red-600 px-6 py-2 text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
