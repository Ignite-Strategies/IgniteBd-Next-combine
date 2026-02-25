'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles, ArrowLeft, RefreshCw, Check, Save, Wand2, User, Tag, Info, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/lib/api';

const DONT_KNOW = 'DONT_KNOW';

function isDefined(v) {
  return v && v !== DONT_KNOW;
}

function humanize(str) {
  if (!str) return '';
  return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function ContactHeader({ contact }) {
  const name = contact.goesBy || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email || 'Unknown';
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-semibold text-lg">
        {name[0]?.toUpperCase()}
      </div>
      <div>
        <p className="font-semibold text-gray-900 text-lg leading-tight">{name}</p>
        {(contact.title || contact.companyName) && (
          <p className="text-sm text-gray-500">
            {[contact.title, contact.companyName].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
}

function ContextChips({ rc, personaName }) {
  const chips = [];

  if (rc?.contextOfRelationship && isDefined(rc.contextOfRelationship)) {
    chips.push({ label: 'Relationship', value: humanize(rc.contextOfRelationship), color: 'blue' });
  }
  if (rc?.relationshipRecency && isDefined(rc.relationshipRecency)) {
    chips.push({ label: 'Recency', value: humanize(rc.relationshipRecency), color: 'indigo' });
  }
  if (rc?.formerCompany) {
    chips.push({ label: 'Former Company', value: rc.formerCompany, color: 'gray' });
  }
  if (rc?.primaryWork) {
    chips.push({ label: 'Now At', value: rc.primaryWork, color: 'green' });
  }
  if (rc?.companyAwareness && isDefined(rc.companyAwareness)) {
    chips.push({ label: 'Awareness', value: humanize(rc.companyAwareness), color: 'amber' });
  }
  if (rc?.relationshipQuality && isDefined(rc.relationshipQuality)) {
    chips.push({ label: 'Quality', value: humanize(rc.relationshipQuality), color: 'purple' });
  }
  if (rc?.opportunityType && isDefined(rc.opportunityType)) {
    chips.push({ label: 'Opportunity', value: humanize(rc.opportunityType), color: 'orange' });
  }

  const colorMap = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-800',
    gray: 'bg-gray-100 border-gray-200 text-gray-700',
    green: 'bg-green-50 border-green-200 text-green-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
  };

  return (
    <div className="space-y-3">
      {personaName && (
        <div className="flex items-center gap-2">
          <Tag className="h-3.5 w-3.5 shrink-0 text-purple-500" />
          <span className="text-xs font-medium text-gray-500">Persona:</span>
          <span className="rounded-full bg-purple-100 border border-purple-200 px-2.5 py-0.5 text-xs font-semibold text-purple-800">
            {personaName}
          </span>
        </div>
      )}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.label}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${colorMap[chip.color]}`}
            >
              <span className="font-medium opacity-70">{chip.label}:</span>
              {chip.value}
            </span>
          ))}
        </div>
      )}
      {chips.length === 0 && !personaName && (
        <p className="text-xs text-gray-400 italic">No relationship context saved yet.</p>
      )}
    </div>
  );
}

export default function OutreachMessagePage({ params }) {
  const { contactId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || (typeof window !== 'undefined' ? localStorage.getItem('companyHQId') : '') || '';

  // Contact data (hydrated fresh from DB)
  const [contact, setContact] = useState(null);
  const [persona, setPersona] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form
  const [notes, setNotes] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [notesExpanded, setNotesExpanded] = useState(true);

  // Generation
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  // result.rawBody = original with {{snippet:slug}} refs; result.body = current editable (may be filled)
  const [result, setResult] = useState(null);
  const [snippetContentMap, setSnippetContentMap] = useState({}); // { slug: text }
  const [senderName, setSenderName] = useState('');
  const [senderCompany, setSenderCompany] = useState('');
  const [isFilled, setIsFilled] = useState(false); // whether Fill with Data has been applied
  const [snippetCount, setSnippetCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [showTemplatPrompt, setShowTemplatePrompt] = useState(false);

  // Load contact + snippet count
  useEffect(() => {
    if (!contactId) return;

    setLoading(true);
    api.get(`/api/contacts/${contactId}`)
      .then((res) => {
        if (res.data?.contact) {
          const c = res.data.contact;
          setContact(c);
          if (c.notes) setNotes(c.notes);

          // Load persona display name if slug is present
          if (c.outreachPersonaSlug) {
            api.get(`/api/outreach-personas/${c.outreachPersonaSlug}`)
              .then((pr) => {
                if (pr.data?.persona) setPersona(pr.data.persona);
              })
              .catch(() => {
                // Fallback: humanize the slug
                setPersona({ name: humanize(c.outreachPersonaSlug.replace(/([A-Z])/g, ' $1').trim()) });
              });
          }
        }
      })
      .catch((err) => console.error('Failed to load contact:', err))
      .finally(() => setLoading(false));

    if (companyHQId) {
      api.get(`/api/outreach/content-snips?companyHQId=${companyHQId}&activeOnly=true`)
        .then((res) => {
          if (res.data?.success) setSnippetCount(res.data.snips?.length || 0);
        })
        .catch(() => {});
    }
  }, [contactId, companyHQId]);

  const handleSave = async () => {
    if (!result || saving) return;
    setSaving(true);
    setError('');
    try {
      // Step 1: always save as a draft on the contact (no emailSent = draft)
      // Save the filled/expanded body if Fill with Data was applied, otherwise raw
      const draftRes = await api.post(`/api/contacts/${contactId}/off-platform-send`, {
        subject: result.subject,
        body: result.body, // filled version if fillWithData was clicked
        platform: 'ai-draft',
        // no emailSent → null → draft
      });

      if (draftRes.data?.success) {
        setSaved(true);
        // Step 2: prompt user if they also want to save as a reusable template
        setShowTemplatePrompt(true);
      } else {
        setError(draftRes.data?.error || 'Failed to save draft');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplate = async () => {
    setSavingTemplate(true);
    setError('');
    try {
      const ownerId = typeof window !== 'undefined' ? localStorage.getItem('ownerId') : null;
      // Templates always save the raw form (with {{snippet:slug}} refs) so they're reusable
      const res = await api.post('/api/templates', {
        companyHQId,
        ownerId,
        title: result.subject,
        subject: result.subject,
        body: result.rawBody || result.body,
        ...(contact?.outreachPersonaSlug && { personaSlug: contact.outreachPersonaSlug }),
      });
      if (res.data?.success) {
        setTemplateSaved(true);
        setShowTemplatePrompt(false);
      } else {
        setError(res.data?.error || 'Failed to save template');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const fillWithData = useCallback(() => {
    if (!result) return;

    // Build variable map from contact — keep {{variable}} if value unknown
    const firstName = contact?.goesBy || contact?.firstName || '{{firstName}}';
    const lastName = contact?.lastName || '{{lastName}}';
    const fullName = [contact?.goesBy || contact?.firstName, contact?.lastName].filter(Boolean).join(' ') || '{{fullName}}';
    const companyName = contact?.companyName || '{{companyName}}';
    const title = contact?.title || '{{title}}';
    const resolvedSenderName = senderName || '{{senderName}}';
    const resolvedSenderCompany = senderCompany || '{{senderCompany}}';

    let filled = result.rawBody || result.body;

    // 1. Expand {{snippet:slug}} → actual snippet text
    filled = filled.replace(/\{\{snippet:([^}]+)\}\}/g, (_, slug) => {
      return snippetContentMap[slug] || `[${slug}]`;
    });

    // 2. Replace all known contact variables
    filled = filled
      .replace(/\{\{firstName\}\}/gi, firstName)
      .replace(/\{\{lastName\}\}/gi, lastName)
      .replace(/\{\{fullName\}\}/gi, fullName)
      .replace(/\{\{companyName\}\}/gi, companyName)
      .replace(/\{\{title\}\}/gi, title)
      .replace(/\{\{senderName\}\}/gi, resolvedSenderName)
      .replace(/\{\{senderCompany\}\}/gi, resolvedSenderCompany);

    setResult((r) => ({ ...r, body: filled }));
    setIsFilled(true);
  }, [result, contact, snippetContentMap, senderName, senderCompany]);

  const handleGenerate = async () => {
    if (!notes.trim() && !additionalContext.trim()) {
      setError('Add some notes or context to guide the email generation.');
      return;
    }
    if (!companyHQId) {
      setError('Company context required. Make sure a company is selected.');
      return;
    }
    if (snippetCount === 0) {
      setError('No active content snippets found. Create snippets first.');
      return;
    }

    setGenerating(true);
    setError('');
    setResult(null);

    try {
      const ownerId = typeof window !== 'undefined' ? localStorage.getItem('ownerId') : null;
      const res = await api.post('/api/template/generate-with-snippets', {
        companyHQId,
        intent: notes.trim() || additionalContext.trim(),
        ownerId,
        contactId,
        // Pass additional context separately so AI gets both
        ...(additionalContext.trim() && { additionalContext: additionalContext.trim() }),
        // Relationship context and persona come from the DB via contactId — no need to pass via URL
      });

      if (res.data?.success) {
        const rawBody = res.data.template.body;
        setResult({
          subject: res.data.template.subject,
          body: rawBody,
          rawBody, // preserve original for template save
          reasoning: res.data.reasoning,
          selectedSnippets: res.data.selectedSnippets || [],
        });
        setSnippetContentMap(res.data.snippetContentMap || {});
        setSenderName(res.data.senderName || '');
        setSenderCompany(res.data.senderCompany || '');
        setIsFilled(false);
      } else {
        setError(res.data?.error || 'Generation failed');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const rc = contact?.relationship_contexts;
  const personaName = persona?.name || (contact?.outreachPersonaSlug ? humanize(contact.outreachPersonaSlug.replace(/([A-Z])/g, ' $1').trim()) : null);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="h-5 w-5 animate-spin" />
          Loading contact...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-3xl px-4">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => router.push(`/contacts/${contactId}?companyHQId=${companyHQId}`)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to contact
          </button>
        </div>

        <h1 className="mb-6 text-2xl font-bold text-gray-900">Build Outreach Message</h1>

        {/* Contact card */}
        {contact && (
          <div className="mb-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <ContactHeader contact={contact} />
            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Info className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Context</span>
              </div>
              <ContextChips rc={rc} personaName={personaName} />
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Pre-generation form */}
        {!result && (
          <div className="space-y-4">
            {/* Notes */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setNotesExpanded((v) => !v)}
                className="flex w-full items-center justify-between px-5 py-3.5 text-left"
              >
                <span className="text-sm font-semibold text-gray-700">Contact Notes</span>
                {notesExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </button>
              {notesExpanded && (
                <div className="border-t border-gray-100 px-5 pb-4">
                  <p className="mb-2 mt-3 text-xs text-gray-400">Pre-filled from saved contact notes. Edit before generating.</p>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
              )}
            </div>

            {/* Additional context */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Additional Context
                <span className="ml-2 text-xs font-normal text-gray-400">optional — guides this generation only</span>
              </label>
              <textarea
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                rows={3}
                placeholder="e.g. just saw they announced a new fund · keep it casual · mention the NDA workflow angle"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>

            {snippetCount > 0 && (
              <p className="text-xs text-green-600 font-medium px-1">✓ {snippetCount} active content snippets available</p>
            )}

            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || (!notes.trim() && !additionalContext.trim()) || snippetCount === 0}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 py-3.5 text-white font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {generating ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Building your message...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  Generate Outreach Message
                </>
              )}
            </button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-4">
            {/* Reasoning */}
            {result.reasoning && (
              <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                <p className="text-sm text-purple-800">{result.reasoning}</p>
              </div>
            )}

            {/* Selected snippets */}
            {result.selectedSnippets.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-1">
                {result.selectedSnippets.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 rounded bg-amber-100 border border-amber-200 px-2 py-0.5 text-xs font-mono text-amber-800">
                    <Check className="h-3 w-3" />{s}
                  </span>
                ))}
              </div>
            )}

            {/* Editable subject + body */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Subject</label>
                <input
                  type="text"
                  value={result.subject}
                  onChange={(e) => setResult((r) => ({ ...r, subject: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">Body</label>
                  {!isFilled ? (
                    <button
                      type="button"
                      onClick={fillWithData}
                      className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 transition"
                      title="Expand snippets and fill contact variables — ready to copy and send"
                    >
                      <Wand2 className="h-3 w-3" />
                      Fill with Data
                    </button>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-green-700">
                      <Check className="h-3 w-3" />
                      Filled — ready to copy
                    </span>
                  )}
                </div>
                <textarea
                  value={result.body}
                  onChange={(e) => setResult((r) => ({ ...r, body: e.target.value }))}
                  rows={14}
                  className={`w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 ${isFilled ? 'border-green-300 bg-green-50 focus:border-green-400 focus:ring-green-400' : 'border-gray-200 focus:border-blue-400 focus:ring-blue-400'}`}
                />
                {!isFilled && (
                  <p className="mt-1 text-xs text-gray-400">Click <strong>Fill with Data</strong> to expand snippets and replace variables with real contact info.</p>
                )}

                {/* Variable Bank */}
                {result && (
                  <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Variable Bank</p>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                      {[
                        { label: '{{firstName}}', value: contact?.goesBy || contact?.firstName },
                        { label: '{{lastName}}', value: contact?.lastName },
                        { label: '{{fullName}}', value: [contact?.goesBy || contact?.firstName, contact?.lastName].filter(Boolean).join(' ') || null },
                        { label: '{{companyName}}', value: contact?.companyName },
                        { label: '{{title}}', value: contact?.title },
                        { label: '{{senderName}}', value: senderName },
                        { label: '{{senderCompany}}', value: senderCompany },
                      ].map(({ label, value }) => (
                        <div key={label} className={`flex flex-col rounded-md border px-2 py-1.5 ${value ? 'border-green-200 bg-white' : 'border-amber-200 bg-amber-50'}`}>
                          <span className="font-mono text-[10px] text-gray-500">{label}</span>
                          <span className={`mt-0.5 truncate text-xs font-medium ${value ? 'text-gray-800' : 'text-amber-600'}`}>
                            {value || 'not set'}
                          </span>
                        </div>
                      ))}
                    </div>
                    {snippetContentMap && Object.keys(snippetContentMap).length > 0 && (
                      <div className="mt-2 border-t border-gray-200 pt-2">
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Snippets</p>
                        <div className="flex flex-col gap-1">
                          {Object.entries(snippetContentMap).map(([slug, text]) => (
                            <div key={slug} className="flex items-start gap-2 rounded-md border border-blue-100 bg-white px-2 py-1.5">
                              <span className="font-mono text-[10px] text-blue-500 shrink-0 mt-0.5">{'{{snippet:' + slug + '}}'}</span>
                              <span className="text-xs text-gray-600 line-clamp-2">{text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-1">
              {/* Primary actions row */}
              <div className="flex items-center gap-3">
                {saved ? (
                  <span className="flex items-center gap-1.5 rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm font-semibold text-green-700">
                    <Check className="h-4 w-4" />
                    Draft saved to contact
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? 'Saving…' : 'Save Draft'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setResult(null); setError(''); setSaved(false); setShowTemplatePrompt(false); setTemplateSaved(false); setIsFilled(false); setSnippetContentMap({}); }}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/contacts/${contactId}?companyHQId=${companyHQId}`)}
                  className="text-sm text-gray-500 hover:text-gray-700 px-2 py-2"
                >
                  Back to contact
                </button>
              </div>

              {/* Template prompt — appears after draft is saved */}
              {showTemplatPrompt && !templateSaved && (
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <span className="text-sm text-gray-700">Save this as a reusable template?</span>
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    disabled={savingTemplate}
                    className="flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition"
                  >
                    {savingTemplate ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTemplatePrompt(false)}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
                  >
                    No
                  </button>
                </div>
              )}

              {templateSaved && (
                <span className="flex items-center gap-1.5 text-sm text-purple-700 font-medium">
                  <Check className="h-4 w-4" />
                  Saved to template library
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
