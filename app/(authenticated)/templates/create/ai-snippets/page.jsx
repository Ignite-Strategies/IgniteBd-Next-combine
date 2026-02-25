'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles, ArrowLeft, Save, RefreshCw, CheckCircle, X, User, Building2, Tag, Info } from 'lucide-react';
import api from '@/lib/api';

const CONTEXT_LABELS = {
  contextOfRelationship: 'Relationship Type',
  relationshipRecency: 'Recency',
  companyAwareness: 'Company Awareness',
  formerCompany: 'Former Company',
  primaryWork: 'Current Work',
  relationshipQuality: 'Quality',
  opportunityType: 'Opportunity',
};

function formatContextValue(value) {
  if (!value) return value;
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function RelationshipContextChips({ ctx }) {
  if (!ctx) return null;
  const entries = Object.entries(ctx).filter(([, v]) => v);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs text-blue-800"
        >
          <span className="font-medium text-blue-500">{CONTEXT_LABELS[key] ?? key}:</span>
          {formatContextValue(String(value))}
        </span>
      ))}
    </div>
  );
}

// Notes are primary — they go in as-is. Context/persona flow to the API separately.
function buildIntentFromContact(notes) {
  return notes?.trim() || '';
}

function AISnippetsTemplateBuilder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  const contactId = searchParams?.get('contactId') || '';
  const personaSlug = searchParams?.get('personaSlug') || '';
  const relationshipContextParam = searchParams?.get('relationshipContext') || '';

  const [intent, setIntent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [generatedTemplate, setGeneratedTemplate] = useState(null);
  const [selectedSnippets, setSelectedSnippets] = useState([]);
  const [reasoning, setReasoning] = useState('');
  const [availableSnippetsCount, setAvailableSnippetsCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [relationshipContext, setRelationshipContext] = useState(null);

  // Contact data
  const [contact, setContact] = useState(null);
  const [contactLoading, setContactLoading] = useState(false);

  // Additional context — not persisted, sent with prompt only
  const [additionalContext, setAdditionalContext] = useState('');

  // Template state
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // Parse relationship context from URL
  useEffect(() => {
    if (relationshipContextParam) {
      try {
        const parsed = JSON.parse(relationshipContextParam);
        setRelationshipContext(parsed);
      } catch (e) {
        console.error('Failed to parse relationship context:', e);
      }
    }
  }, [relationshipContextParam]);

  // Fetch contact data when contactId present
  useEffect(() => {
    if (!contactId) return;
    setContactLoading(true);
    api.get(`/api/contacts/${contactId}`)
      .then((res) => {
        if (res.data?.contact) {
          setContact(res.data.contact);
        }
      })
      .catch((err) => console.error('Failed to load contact:', err))
      .finally(() => setContactLoading(false));
  }, [contactId]);

  // Pre-fill intent with raw notes once contact loads (only if intent is still empty)
  useEffect(() => {
    if (intent.trim()) return;
    const filled = buildIntentFromContact(contact?.notes);
    if (filled) setIntent(filled);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact]);

  useEffect(() => {
    if (!companyHQId && typeof window !== 'undefined') {
      const stored = localStorage.getItem('companyHQId');
      if (stored) {
        const params = new URLSearchParams({ companyHQId: stored });
        if (contactId) params.append('contactId', contactId);
        if (personaSlug) params.append('personaSlug', personaSlug);
        if (relationshipContextParam) params.append('relationshipContext', relationshipContextParam);
        router.replace(`/templates/create/ai-snippets?${params.toString()}`);
      }
    }
  }, [companyHQId, router, contactId, personaSlug, relationshipContextParam]);

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
        ...(additionalContext.trim() && { additionalContext: additionalContext.trim() }),
        ...(relationshipContext && { relationshipContext }),
        ...(personaSlug && { personaSlug }),
        ...(contactId && { contactId }),
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

  const contactName = contact
    ? [contact.preferredName || contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.name || 'Unknown'
    : null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-6 flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-3xl font-bold text-gray-900">AI Template Builder</h1>
        </div>

        {/* Contact context card */}
        {contactId && (
          <div className="mb-4 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {contactLoading ? (
              <div className="px-5 py-4 text-sm text-gray-400">Loading contact…</div>
            ) : contact ? (
              <div className="px-5 py-4 space-y-3">
                {/* Contact header */}
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Building email for</p>
                    <p className="font-semibold text-gray-900 leading-tight">{contactName}</p>
                    {(contact.company || contact.title) && (
                      <p className="text-sm text-gray-500 mt-0.5">
                        {[contact.title, contact.company].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Persona slug */}
                {personaSlug && (
                  <div className="flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5 shrink-0 text-purple-500" />
                    <span className="text-xs text-gray-500 font-medium">Outreach Persona:</span>
                    <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
                      {personaSlug.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </div>
                )}

                {/* Relationship context chips */}
                {relationshipContext && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 text-blue-400" />
                      <span className="text-xs font-medium text-gray-500">Relationship Context</span>
                    </div>
                    <RelationshipContextChips ctx={relationshipContext} />
                  </div>
                )}

                {/* Notes preview */}
                {contact.notes && (
                  <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                    <p className="text-xs font-medium text-gray-400 mb-1">Notes</p>
                    <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{contact.notes}</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        <div className="rounded-2xl bg-white p-6 shadow">
          {error && (
            <div className="mb-4 rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800 flex items-center justify-between">
              <span>{error}</span>
              <button type="button" onClick={() => setError('')} className="text-red-600 hover:text-red-800">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {!generatedTemplate ? (
            <div className="space-y-6">
              <div className="space-y-5">
                {/* Primary: contact notes / intent */}
                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {contactId ? 'Contact Notes' : 'Describe Your Intent'}
                    </h2>
                    {availableSnippetsCount > 0 && (
                      <span className="text-xs text-green-600 font-medium">✓ {availableSnippetsCount} active snippets</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-3">
                    {contactId
                      ? 'Pre-filled from saved contact notes. Edit before generating.'
                      : 'Tell us what you want to communicate. AI will select and order your content snippets to build a complete template.'}
                  </p>
                  {availableSnippetsCount === 0 && (
                    <p className="text-sm text-amber-600 mb-3">
                      ⚠ No active snippets found.{' '}
                      <a href={`/content-snips?companyHQId=${companyHQId}`} className="underline">
                        Create some snippets first
                      </a>.
                    </p>
                  )}
                  <textarea
                    value={intent}
                    onChange={(e) => setIntent(e.target.value)}
                    rows={6}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                {/* Additional context — ephemeral, not persisted */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Additional Context
                    <span className="ml-2 text-xs font-normal text-gray-400">(not saved — sent with this prompt only)</span>
                  </label>
                  <textarea
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    rows={3}
                    className="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-gray-300 focus:bg-white focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    e.g. "They just closed a Series B" · "Saw them at a conference last week" · "Tone should be casual"
                  </p>
                </div>
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
                    Analyzing snippets and building template…
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
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Subject *</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Body *</label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={12}
                    className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Edit as needed. Snippets are referenced as {'{{snippet:snippetName}}'}.
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
                  {saving ? 'Saving…' : 'Save Template'}
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
