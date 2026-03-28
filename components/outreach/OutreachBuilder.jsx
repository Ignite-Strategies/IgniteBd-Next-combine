'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ArrowLeft,
  RefreshCw,
  Check,
  Save,
  Tag,
  Info,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
} from 'lucide-react';
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
  const name =
    contact.goesBy ||
    [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
    contact.email ||
    'Unknown';
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

/**
 * @param {object} props
 * @param {string} props.contactId
 * @param {string} props.companyHQId
 * @param {'page' | 'modal'} props.layout
 * @param {() => void} [props.onClose] — required when layout is `modal`
 */
export default function OutreachBuilder({ contactId, companyHQId, layout, onClose }) {
  const router = useRouter();
  const isModal = layout === 'modal';

  const [contact, setContact] = useState(null);
  const [persona, setPersona] = useState(null);
  const [loading, setLoading] = useState(true);

  const [notes, setNotes] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [notesExpanded, setNotesExpanded] = useState(true);

  const [variableSchema, setVariableSchema] = useState([]);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [showTemplatePrompt, setShowTemplatePrompt] = useState(false);

  const contactQuery = companyHQId ? `?companyHQId=${encodeURIComponent(companyHQId)}` : '';
  const outreachFullPageHref = `/contacts/${contactId}/outreach-message${contactQuery}`;

  const goToContactRecord = () => {
    router.push(`/contacts/${contactId}${contactQuery}`);
  };

  useEffect(() => {
    if (!contactId) return;

    setLoading(true);
    setPersona(null);
    api
      .get(`/api/contacts/${contactId}`)
      .then((res) => {
        if (res.data?.contact) {
          const c = res.data.contact;
          setContact(c);
          setNotes(c.contactSummary || c.notes || '');

          if (c.outreachPersonaSlug) {
            api
              .get(`/api/outreach-personas/${c.outreachPersonaSlug}`)
              .then((pr) => {
                if (pr.data?.persona) setPersona(pr.data.persona);
              })
              .catch(() => {
                setPersona({
                  name: humanize(c.outreachPersonaSlug.replace(/([A-Z])/g, ' $1').trim()),
                });
              });
          }
        }
      })
      .catch((err) => console.error('Failed to load contact:', err))
      .finally(() => setLoading(false));
  }, [contactId]);

  useEffect(() => {
    if (!companyHQId || !contactId) return;
    const ownerId = typeof window !== 'undefined' ? localStorage.getItem('ownerId') : null;
    api
      .post('/api/variables/preview', { contactId, companyHQId, ownerId })
      .then((res) => {
        if (res.data?.success) setVariableSchema(res.data.variables || []);
      })
      .catch(() => {});
  }, [contactId, companyHQId]);

  const handleSave = async () => {
    if (!result || saving) return;
    setSaving(true);
    setError('');
    try {
      const draftRes = await api.post(`/api/contacts/${contactId}/off-platform-send`, {
        subject: result.subject,
        body: result.body,
        platform: 'ai-draft',
      });

      if (draftRes.data?.success) {
        setSaved(true);
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

  const handleGenerate = async () => {
    if (!notes.trim() && !additionalContext.trim()) {
      setError('Add some notes or context to guide the email generation.');
      return;
    }
    if (!companyHQId) {
      setError('Company context required. Make sure a company is selected.');
      return;
    }

    setGenerating(true);
    setError('');
    setResult(null);

    try {
      const notesText = [notes.trim(), additionalContext.trim()].filter(Boolean).join('\n\n');
      const res = await api.post(`/api/contacts/${contactId}/build-email`, {
        companyHQId,
        personaSlug: contact?.outreachPersonaSlug || undefined,
        relationshipContext: contact?.relationship_contexts || undefined,
        notes: notesText || undefined,
      });

      if (res.data?.success) {
        setResult({
          subject: res.data.subject,
          body: res.data.body,
          rawBody: res.data.body,
          rawSubject: res.data.subject,
          reasoning: res.data.reasoning,
          selectedSnippets: [],
        });
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
  const personaName =
    persona?.name ||
    (contact?.outreachPersonaSlug
      ? humanize(contact.outreachPersonaSlug.replace(/([A-Z])/g, ' $1').trim())
      : null);

  const mainContent = (
    <>
      {!isModal && (
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={goToContactRecord}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to contact
          </button>
        </div>
      )}

      {!isModal && <h1 className="mb-6 text-2xl font-bold text-gray-900">Build Outreach Message</h1>}
      {isModal && <h1 className="sr-only">Build Outreach Message</h1>}

      {contact && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <ContactHeader contact={contact} />
          {contact.email == null || String(contact.email).trim() === '' ? (
            <p className="text-xs text-gray-500">
              No email on record; you can still draft and copy.
            </p>
          ) : null}
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

      {!result && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setNotesExpanded((v) => !v)}
              className="flex w-full items-center justify-between px-5 py-3.5 text-left"
            >
              <span className="text-sm font-semibold text-gray-700">Contact Summary</span>
              {notesExpanded ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>
            {notesExpanded && (
              <div className="border-t border-gray-100 px-5 pb-4">
                <p className="mb-2 mt-3 text-xs text-gray-400">
                  Pre-filled from contact summary or saved notes. Edit before generating.
                </p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Additional Context
              <span className="ml-2 text-xs font-normal text-gray-400">
                optional — guides this generation only
              </span>
            </label>
            <textarea
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              rows={3}
              placeholder="e.g. just saw they announced a new fund · keep it casual · mention the NDA workflow angle"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || (!notes.trim() && !additionalContext.trim())}
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

      {result && (
        <div className="space-y-4">
          {result.reasoning && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
              <p className="text-sm text-purple-800">{result.reasoning}</p>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                Subject
              </label>
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
                <span className="flex items-center gap-1 text-xs font-medium text-green-700">
                  <Check className="h-3 w-3" />
                  Ready to copy
                </span>
              </div>
              <textarea
                value={result.body}
                onChange={(e) => setResult((r) => ({ ...r, body: e.target.value }))}
                rows={14}
                className="w-full rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:border-green-400 focus:ring-green-400"
              />
              {variableSchema.length > 0 && (
                <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Variable Reference
                  </p>
                  {['CONTACT', 'OWNER', 'COMPUTED'].map((source) => {
                    const vars = variableSchema.filter((v) => v.source === source);
                    if (vars.length === 0) return null;
                    const sourceLabels = {
                      CONTACT: 'Recipient',
                      OWNER: 'Sender / Your Company',
                      COMPUTED: 'Computed',
                    };
                    return (
                      <div key={source} className="mb-3 last:mb-0">
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          {sourceLabels[source]}
                        </p>
                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                          {vars.map(({ key, variable, description, value, resolved }) => (
                            <div
                              key={key}
                              title={description}
                              className={`flex flex-col rounded-md border px-2 py-1.5 ${
                                resolved ? 'border-green-200 bg-white' : 'border-amber-200 bg-amber-50'
                              }`}
                            >
                              <span className="font-mono text-[10px] text-gray-500">{variable}</span>
                              <span
                                className={`mt-0.5 truncate text-xs font-medium ${
                                  resolved ? 'text-gray-800' : 'text-amber-500'
                                }`}
                              >
                                {resolved ? value : 'not set'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <label className="block text-xs font-semibold text-gray-500 mb-2">
              Regenerate with more context
            </label>
            <textarea
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              rows={2}
              placeholder="e.g. no need to explain what happened — the owner stayed, they left · keep it short · mention X"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
            />
          </div>

          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center gap-3">
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
                onClick={handleGenerate}
                disabled={generating || (!notes.trim() && !additionalContext.trim())}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
              >
                {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Regenerate
              </button>
              {isModal ? (
                <button
                  type="button"
                  onClick={goToContactRecord}
                  className="text-sm text-gray-500 hover:text-gray-700 px-2 py-2"
                >
                  View contact
                </button>
              ) : (
                <button
                  type="button"
                  onClick={goToContactRecord}
                  className="text-sm text-gray-500 hover:text-gray-700 px-2 py-2"
                >
                  Back to contact
                </button>
              )}
            </div>

            {showTemplatePrompt && !templateSaved && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
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
    </>
  );

  if (loading) {
    const loader = (
      <div className="flex items-center gap-2 text-gray-500">
        <RefreshCw className="h-5 w-5 animate-spin" />
        Loading contact...
      </div>
    );
    if (isModal) {
      return (
        <div className="flex items-center justify-center py-16 px-4 bg-gray-50">
          {loader}
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        {loader}
      </div>
    );
  }

  if (isModal) {
    return (
      <div className="flex flex-col max-h-[90vh] bg-gray-50">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg p-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <span className="flex-1 truncate text-center text-base font-bold text-gray-900">
            Build Outreach Message
          </span>
          <button
            type="button"
            onClick={() => router.push(outreachFullPageHref)}
            className="flex shrink-0 items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            Open full page
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">{mainContent}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-3xl px-4">{mainContent}</div>
    </div>
  );
}
