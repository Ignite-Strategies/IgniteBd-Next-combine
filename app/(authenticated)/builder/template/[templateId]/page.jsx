'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Save, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
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
  
  const [ownerId, setOwnerId] = useState(null);
  const [owner, setOwner] = useState(null);
  const [companyHQId, setCompanyHQId] = useState(null);

  // Load from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedOwnerId = localStorage.getItem('ownerId');
      const storedOwner = localStorage.getItem('owner');
      const storedCompanyHQId = localStorage.getItem('companyHQId');
      
      if (storedOwnerId) {
        setOwnerId(storedOwnerId);
      }
      if (storedOwner) {
        try {
          setOwner(JSON.parse(storedOwner));
        } catch (error) {
          console.warn('Failed to parse stored owner', error);
        }
      }
      if (storedCompanyHQId) {
        setCompanyHQId(storedCompanyHQId);
      }
    }
  }, []);

  // Load content snips when companyHQId is available
  useEffect(() => {
    if (!companyHQId) return;
    setLoadingSnips(true);
    api.get(`/api/outreach/content-snips?companyHQId=${companyHQId}&activeOnly=true`)
      .then((res) => {
        if (res.data?.success) {
          setContentSnips(res.data.snips || []);
        }
      })
      .catch((err) => {
        console.error('Failed to load content snips:', err);
      })
      .finally(() => {
        setLoadingSnips(false);
      });
  }, [companyHQId]);

  // Load variables from DB when companyHQId is available
  useEffect(() => {
    if (!companyHQId) return;
    setLoadingVariables(true);
    api.get(`/api/template-variables?companyHQId=${companyHQId}&activeOnly=true`)
      .then((res) => {
        if (res.data?.success) {
          setDbVariables(res.data.variables || []);
        }
      })
      .catch((err) => {
        console.error('Failed to load variables:', err);
      })
      .finally(() => {
        setLoadingVariables(false);
      });
  }, [companyHQId]);

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew && !cloneFrom);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [currentTemplateId, setCurrentTemplateId] = useState(templateId);
  const [contentSnips, setContentSnips] = useState([]);
  const [loadingSnips, setLoadingSnips] = useState(false);
  const [dbVariables, setDbVariables] = useState([]);
  const [loadingVariables, setLoadingVariables] = useState(false);

  useEffect(() => {
    if (!isNew && templateId) {
      loadTemplate();
    } else if (cloneFrom) {
      loadTemplateToClone(cloneFrom);
    } else if (isNew) {
      // Check for pre-filled data from query params (AI generation)
      const titleParam = searchParams?.get('title');
      let subjectParam = searchParams?.get('subject');
      const bodyParam = searchParams?.get('body');
      
      if (titleParam || subjectParam || bodyParam) {
        // Validate and fix subject - strip variables and fix "Hi," patterns
        if (subjectParam) {
          subjectParam = subjectParam.trim();
          // Remove any {{variables}} from subject
          subjectParam = subjectParam.replace(/{{.*?}}/g, '').trim();
          // Fix common bad patterns like "Hi," or "Hi {{firstName}},"
          if (!subjectParam || subjectParam.match(/^(Hi|Hey|Hello)[,\s]*$/i)) {
            // Generate simple subject based on body content
            const bodyLower = (bodyParam || '').toLowerCase();
            if (bodyLower.includes('collaboration')) {
              subjectParam = 'Collaboration in 2026';
            } else if (bodyLower.includes('reconnect') || bodyLower.includes('long time')) {
              subjectParam = 'Reconnecting';
            } else {
              subjectParam = 'Reaching Out';
            }
          }
        } else {
          subjectParam = '';
        }
        
        setTitle(titleParam || '');
        setSubject(subjectParam);
        
        // Replace [Your name] with actual owner name if present
        let bodyContent = bodyParam || '';
        if (owner) {
          const ownerName = owner.firstName || owner.name?.split(' ')[0] || '';
          if (ownerName) {
            bodyContent = bodyContent.replace(/\[Your name\]/g, ownerName);
          }
        }
        setBody(bodyContent);
        setLoading(false);
      } else {
        setLoading(false);
      }
    }
  }, [templateId, isNew, cloneFrom, searchParams, owner]);

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

  // Insert content snip into body at cursor position (use snipSlug for {{snippet:snipSlug}})
  const insertSnip = (snipSlug) => {
    const snip = `{{snippet:${snipSlug}}}`;
    const textarea = document.getElementById('body-textarea');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = body;
      const newText = text.substring(0, start) + snip + text.substring(end);
      setBody(newText);
      // Set cursor position after inserted snip
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + snip.length, start + snip.length);
      }, 0);
    } else {
      // Fallback: append to end
      setBody(prev => prev + snip);
    }
  };

  const handleSave = async () => {
    if (!ownerId) {
      setError('Owner not found. Please refresh the page.');
      return;
    }

    if (!companyHQId) {
      setError('Company not found. Please refresh the page.');
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
        companyHQId, // Required - company-scoped
        ownerId, // Optional - creator/audit trail
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

      // Update localStorage cache
      if (companyHQId && typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem(`templates_${companyHQId}`);
          const templates = cached ? JSON.parse(cached) : [];
          if (isNew) {
            // Add new template to cache
            templates.unshift(template);
          } else {
            // Update existing template in cache
            const index = templates.findIndex(t => t.id === template.id);
            if (index >= 0) {
              templates[index] = template;
            } else {
              templates.unshift(template);
            }
          }
          localStorage.setItem(`templates_${companyHQId}`, JSON.stringify(templates));
          console.log('✅ Updated templates cache in localStorage');
        } catch (e) {
          console.warn('Failed to update templates cache:', e);
        }
      }

      // Handle success: For new templates, clear form completely. For edits, show success message.
      if (isNew) {
        // Clear form completely for new templates
        setTitle('');
        setSubject('');
        setBody('');
        setSaveSuccess(true);
        // Store saved template ID for action buttons
        setCurrentTemplateId(template.id);
        // Don't update URL - keep it as /new so they can create another
      } else {
        // For edits, show success message briefly
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
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
                  <p className="text-sm text-green-700">
                    {isNew ? 'Template saved! What would you like to do next?' : 'Template updated successfully!'}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    const baseUrl = companyHQId ? `/outreach/compose?companyHQId=${companyHQId}` : '/outreach/compose';
                    if (currentTemplateId && currentTemplateId !== 'new') {
                      router.push(`${baseUrl}&templateId=${currentTemplateId}`);
                    } else {
                      router.push(baseUrl);
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition"
                >
                  Send an Email
                </button>
                <button
                  onClick={() => router.push('/templates/library-email')}
                  className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 text-sm font-semibold hover:bg-gray-300 transition"
                >
                  View All Templates
                </button>
                {isNew && (
                  <button
                    onClick={() => {
                      setSaveSuccess(false);
                      setCurrentTemplateId('new');
                      // Form is already cleared, just hide success
                    }}
                    className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition"
                  >
                    Create Another
                  </button>
                )}
              </div>
            </div>
          )}
          {error && (
            <div className="mb-4 rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
          {!saveSuccess && (
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
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-semibold text-gray-700">
                    Body *
                  </label>
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
              <div className="rounded-lg border-2 border-gray-200 bg-gray-50 p-5 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-900">Available Variables</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-600 italic">Click any variable to insert it</p>
                    <button
                      type="button"
                      onClick={() => router.push(`/variables${companyHQId ? `?companyHQId=${companyHQId}` : ''}`)}
                      className="text-sm text-gray-700 hover:text-gray-900 font-medium underline"
                    >
                      Manage variables
                    </button>
                  </div>
                </div>
                {loadingVariables ? (
                  <p className="text-sm text-gray-500">Loading variables...</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Built-in variables from catalogue */}
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
                    {/* Custom variables from DB */}
                    {dbVariables
                      .filter((v) => !v.isBuiltIn)
                      .map((variable) => (
                        <button
                          key={variable.id}
                          type="button"
                          onClick={() => insertVariable(variable.variableKey)}
                          className="text-left px-4 py-3 rounded-lg bg-white border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-all shadow-sm hover:shadow"
                          title={variable.description || `Custom variable: ${variable.variableKey}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <code className="text-blue-600 font-mono font-semibold text-base">{`{{${variable.variableKey}}}`}</code>
                            <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">{variable.source}</span>
                          </div>
                          {variable.description && (
                            <p className="text-gray-600 text-sm italic">{variable.description}</p>
                          )}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Content Snips - Always Visible */}
              <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-900">Content Snips</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-600 italic">Click any snip to insert it</p>
                    <button
                      type="button"
                      onClick={() => router.push(`/content-snips${companyHQId ? `?companyHQId=${companyHQId}` : ''}`)}
                      className="text-sm text-amber-700 hover:text-amber-900 font-medium underline"
                    >
                      Manage snips
                    </button>
                  </div>
                </div>
                {loadingSnips ? (
                  <p className="text-sm text-gray-500">Loading snips...</p>
                ) : contentSnips.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-600 mb-2">No content snips yet.</p>
                    <button
                      type="button"
                      onClick={() => router.push(`/content-snips${companyHQId ? `?companyHQId=${companyHQId}` : ''}`)}
                      className="text-sm text-amber-700 hover:text-amber-900 font-medium underline"
                    >
                      Create your first content snip
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {contentSnips.map((snip) => (
                      <button
                        key={snip.snipId}
                        type="button"
                        onClick={() => insertSnip(snip.snipSlug)}
                        className="text-left px-4 py-3 rounded-lg bg-white border-2 border-amber-200 hover:border-amber-400 hover:bg-amber-50 transition-all shadow-sm hover:shadow"
                        title={snip.snipText}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <code className="text-amber-700 font-mono font-semibold text-base">{`{{snippet:${snip.snipSlug}}}`}</code>
                          {snip.templatePosition && (
                            <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">{snip.templatePosition}</span>
                          )}
                        </div>
                        <p className="text-gray-600 text-sm line-clamp-2">{snip.snipText}</p>
                      </button>
                    ))}
                  </div>
                )}
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
          )}
        </div>
      </div>
    </div>
  );
}
