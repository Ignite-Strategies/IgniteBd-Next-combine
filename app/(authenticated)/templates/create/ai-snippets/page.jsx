'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles, ArrowLeft, Save, RefreshCw, CheckCircle, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';

function AISnippetsTemplateBuilder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';

  const [intent, setIntent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [generatedTemplate, setGeneratedTemplate] = useState(null);
  const [selectedSnippets, setSelectedSnippets] = useState([]);
  const [reasoning, setReasoning] = useState('');
  const [availableSnippetsCount, setAvailableSnippetsCount] = useState(0);
  const [saving, setSaving] = useState(false);

  // Template state
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (!companyHQId && typeof window !== 'undefined') {
      const stored = localStorage.getItem('companyHQId');
      if (stored) {
        router.replace(`/templates/create/ai-snippets?companyHQId=${stored}`);
      }
    }
  }, [companyHQId, router]);

  useEffect(() => {
    if (companyHQId) {
      loadSnippetsCount();
    }
  }, [companyHQId]);

  const loadSnippetsCount = async () => {
    try {
      const res = await api.get(`/api/outreach/content-snips?companyHQId=${companyHQId}&activeOnly=true`);
      if (res.data?.success) {
        setAvailableSnippetsCount(res.data.snips?.length || 0);
      }
    } catch (err) {
      console.error('Failed to load snippets count:', err);
    }
  };

  const handleGenerate = async () => {
    if (!intent.trim()) {
      setError('Please describe what you want to communicate.');
      return;
    }

    if (!companyHQId) {
      setError('Company context required.');
      return;
    }

    if (availableSnippetsCount === 0) {
      setError('No active content snippets found. Please create some snippets first.');
      return;
    }

    setGenerating(true);
    setError('');
    setGeneratedTemplate(null);
    setSelectedSnippets([]);
    setReasoning('');

    try {
      const ownerId = typeof window !== 'undefined' ? localStorage.getItem('ownerId') : null;
      const res = await api.post('/api/template/generate-with-snippets', {
        companyHQId,
        intent: intent.trim(),
        ownerId,
      });

      if (res.data?.success) {
        const template = res.data.template;
        setGeneratedTemplate(template);
        setTitle(template.title);
        setSubject(template.subject);
        setBody(template.body);
        setSelectedSnippets(res.data.selectedSnippets || []);
        setReasoning(res.data.reasoning || '');
      } else {
        setError(res.data?.error || 'Failed to generate template');
      }
    } catch (err) {
      console.error('Generation error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to generate template');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !subject.trim() || !body.trim()) {
      setError('Title, subject, and body are required.');
      return;
    }

    const ownerId = typeof window !== 'undefined' ? localStorage.getItem('ownerId') : null;
    if (!ownerId || !companyHQId) {
      setError('Owner and company context required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await api.post('/api/templates', {
        companyHQId,
        ownerId,
        title: title.trim(),
        subject: subject.trim(),
        body: body.trim(),
      });

      if (res.data?.success) {
        router.push(`/builder/template/${res.data.template.id}?companyHQId=${companyHQId}`);
      } else {
        setError(res.data?.error || 'Failed to save template');
      }
    } catch (err) {
      console.error('Save error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  if (!companyHQId) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4">
          <p className="text-gray-600">Select a company first (company context required).</p>
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
          <h1 className="text-3xl font-bold text-gray-900">AI Template Builder</h1>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          {error && (
            <div className="mb-4 rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800 flex items-center justify-between">
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

          {!generatedTemplate ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Describe Your Intent
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  Tell us what you want to communicate, and AI will intelligently select and order your content snippets to build a complete template.
                </p>
                {availableSnippetsCount > 0 && (
                  <p className="text-sm text-green-600 mb-4">
                    ✓ {availableSnippetsCount} active snippets available
                  </p>
                )}
                {availableSnippetsCount === 0 && (
                  <p className="text-sm text-amber-600 mb-4">
                    ⚠ No active snippets found. <a href={`/content-snips?companyHQId=${companyHQId}`} className="underline">Create some snippets first</a>.
                  </p>
                )}
                <textarea
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  placeholder="e.g., I want to reach out to old contacts about our new consulting services. I want to reconnect and see if they'd be interested in a brief call."
                  rows={6}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || !intent.trim() || availableSnippetsCount === 0}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-6 py-3 text-white font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    Analyzing snippets and building template...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Generate Template from Snippets
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* AI Reasoning */}
              {reasoning && (
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-5 w-5 text-purple-600 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-purple-900 mb-1">AI Selection Reasoning</h3>
                      <p className="text-sm text-purple-800">{reasoning}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Selected Snippets */}
              {selectedSnippets.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <h3 className="text-sm font-semibold text-amber-900 mb-2">
                    Selected Snippets ({selectedSnippets.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedSnippets.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-1 text-xs font-mono text-amber-800"
                      >
                        <CheckCircle className="h-3 w-3" />
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Template Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Template title"
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
                    placeholder="Email subject line"
                    className="w-full rounded border border-gray-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Body *
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Email body with {{snippet:name}} and {{variables}}"
                    rows={12}
                    className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Edit the template as needed. Snippets are referenced as {'{{snippet:snippetName}}'}.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !title.trim() || !subject.trim() || !body.trim()}
                  className="flex items-center gap-2 rounded bg-red-600 px-6 py-2 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Template'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGeneratedTemplate(null);
                    setTitle('');
                    setSubject('');
                    setBody('');
                    setSelectedSnippets([]);
                    setReasoning('');
                  }}
                  className="flex items-center gap-2 rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  Generate Again
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/builder/template/new?companyHQId=${companyHQId}`)}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Manual Builder
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AISnippetsTemplateBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="mx-auto max-w-4xl px-4">
            <p className="text-gray-600">Loading…</p>
          </div>
        </div>
      }
    >
      <AISnippetsTemplateBuilder />
    </Suspense>
  );
}
