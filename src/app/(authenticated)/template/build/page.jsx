'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';

const RELATIONSHIP_OPTIONS = [
  { value: 'COLD', label: 'Cold' },
  { value: 'WARM', label: 'Warm' },
  { value: 'ESTABLISHED', label: 'Established' },
  { value: 'DORMANT', label: 'Dormant' },
];

const TYPE_OF_PERSON_OPTIONS = [
  { value: 'CURRENT_CLIENT', label: 'Current Client' },
  { value: 'FORMER_CLIENT', label: 'Former Client' },
  { value: 'FORMER_COWORKER', label: 'Former Coworker' },
  { value: 'PROSPECT', label: 'Prospect' },
  { value: 'PARTNER', label: 'Partner' },
  { value: 'FRIEND_OF_FRIEND', label: 'Friend of Friend' },
];

// Predefined templates that auto-fill form fields
const PREDEFINED_TEMPLATES = [
  {
    id: 'friends-personal',
    name: 'Friends & Personal Contacts',
    description: 'For reconnecting with friends and personal contacts',
    relationship: 'WARM',
    typeOfPerson: 'FRIEND_OF_FRIEND',
    whyReachingOut: "Haven't connected in a while and wanted to check in",
    whatWantFromThem: "Would love to catch up if you're open to it",
  },
  {
    id: 'former-coworkers',
    name: 'Former Coworkers',
    description: 'Reconnect with past colleagues',
    relationship: 'DORMANT',
    typeOfPerson: 'FORMER_COWORKER',
    whyReachingOut: "Been thinking about our time working together and wanted to reconnect",
    whatWantFromThem: "Would be great to grab coffee and catch up",
  },
  {
    id: 'former-clients',
    name: 'Former Clients',
    description: 'Maintain relationships with past clients',
    relationship: 'DORMANT',
    typeOfPerson: 'FORMER_CLIENT',
    whyReachingOut: "Haven't touched base in a while and wanted to see how things are going",
    whatWantFromThem: null,
  },
  {
    id: 'warm-prospects',
    name: 'Warm Prospects',
    description: 'Follow up with warm business prospects',
    relationship: 'WARM',
    typeOfPerson: 'PROSPECT',
    whyReachingOut: "Wanted to follow up on our previous conversation",
    whatWantFromThem: "Would love to continue the conversation if you're interested",
  },
  {
    id: 'current-clients',
    name: 'Current Clients',
    description: 'Check in with existing clients',
    relationship: 'ESTABLISHED',
    typeOfPerson: 'CURRENT_CLIENT',
    whyReachingOut: "Wanted to check in and see how everything is going",
    whatWantFromThem: null,
  },
];

export default function TemplateBuildPage() {
  const router = useRouter();
  const { companyHQId } = useCompanyHQ();
  const [mode, setMode] = useState('MANUAL'); // 'MANUAL' | 'TEMPLATE' | 'IDEA' | 'IDEA'
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [idea, setIdea] = useState('');
  const [parsing, setParsing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({
    title: '',
    relationship: '',
    typeOfPerson: '',
    whyReachingOut: '',
    whatWantFromThem: '',
  });
  const [preview, setPreview] = useState({
    content: '',
    sections: {
      opening: '',
      context: '',
      releaseValve: '',
      close: '',
    },
  });
  const [templateBaseId, setTemplateBaseId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Generate title from form fields
  const generateTitle = (typeOfPerson) => {
    const typeLabels = {
      CURRENT_CLIENT: 'Current Client',
      FORMER_CLIENT: 'Former Client',
      FORMER_COWORKER: 'Former Co-worker',
      PROSPECT: 'Prospect',
      PARTNER: 'Partner',
      FRIEND_OF_FRIEND: 'Friend',
    };
    const typeLabel = typeLabels[typeOfPerson] || 'Contact';
    return `Outreach to ${typeLabel}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
    // Clear template selection when manually editing
    if (selectedTemplate) {
      setSelectedTemplate(null);
    }
  };

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template.id);
    setMode('TEMPLATE');
    const autoTitle = generateTitle(template.typeOfPerson);
    setForm({
      title: autoTitle,
      relationship: template.relationship,
      typeOfPerson: template.typeOfPerson,
      whyReachingOut: template.whyReachingOut,
      whatWantFromThem: template.whatWantFromThem || '',
    });
    setError(null);
  };

  const handleSwitchToManual = () => {
    setMode('MANUAL');
    setSelectedTemplate(null);
    setIdea('');
    // Keep form values, just switch mode
  };

  const handleParse = async () => {
    if (!idea.trim()) {
      setError('Please enter an idea first');
      return;
    }

    setError(null);
    setParsing(true);

    try {
      const response = await api.post('/api/template/parse', {
        idea: idea.trim(),
      });

      if (response.data?.success && response.data?.inferredFields) {
        const inferred = response.data.inferredFields;
        const autoTitle = generateTitle(inferred.typeOfPerson);
        setForm({
          title: autoTitle,
          relationship: inferred.relationship,
          typeOfPerson: inferred.typeOfPerson,
          whyReachingOut: inferred.whyReachingOut,
          whatWantFromThem: inferred.whatWantFromThem || '',
        });
        setMode('IDEA'); // Switch to idea mode after parsing
      } else {
        throw new Error('Failed to parse idea');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to parse idea');
    } finally {
      setParsing(false);
    }
  };

  const handleGenerateMessage = async () => {
    if (!form.relationship || !form.typeOfPerson || !form.whyReachingOut.trim()) {
      setError('Please fill in all required fields or parse an idea first');
      return;
    }

    setError(null);
    setGenerating(true);

    try {
      const response = await api.post('/api/template/generate', {
        relationship: form.relationship,
        typeOfPerson: form.typeOfPerson,
        whyReachingOut: form.whyReachingOut.trim(),
        whatWantFromThem: form.whatWantFromThem?.trim() || null,
      });

      if (response.data?.success) {
        setPreview({
          content: response.data.message,
          sections: response.data.sections || {},
        });
      } else {
        throw new Error('Failed to generate message');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to generate message');
    } finally {
      setGenerating(false);
    }
  };

  // Auto-generate title when typeOfPerson changes (only if title is empty)
  useEffect(() => {
    if (form.typeOfPerson && (!form.title || form.title.startsWith('Outreach to'))) {
      const autoTitle = generateTitle(form.typeOfPerson);
      // Only update if current title is empty or is the auto-generated one
      if (!form.title || form.title === autoTitle || form.title.startsWith('Outreach to')) {
        setForm((prev) => ({ ...prev, title: autoTitle }));
      }
    }
  }, [form.typeOfPerson]);

  // Auto-hydrate preview when form changes - client-side only, no API calls (only for MANUAL mode)
  useEffect(() => {
    // Only auto-hydrate in MANUAL mode - IDEA and TEMPLATE modes use AI generation
    if (mode === 'MANUAL' && form.relationship && form.typeOfPerson && form.whyReachingOut.trim()) {
      // Use client-side hydration for instant preview - no API call needed
      const tempBase = {
        relationship: form.relationship,
        typeOfPerson: form.typeOfPerson,
        whyReachingOut: form.whyReachingOut.trim(),
        whatWantFromThem: form.whatWantFromThem?.trim() || null,
      };
      const hydrated = hydrateMessage(tempBase);
      setPreview(hydrated);
    } else if (mode === 'MANUAL' && (!form.relationship || !form.typeOfPerson || !form.whyReachingOut.trim())) {
      // Clear preview if form is incomplete (only in MANUAL mode)
      setPreview({
        content: '',
        sections: {
          opening: '',
          context: '',
          releaseValve: '',
          close: '',
        },
      });
    }
  }, [form.relationship, form.typeOfPerson, form.whyReachingOut, form.whatWantFromThem, mode]);

  const handleBuild = async () => {
    if (!companyHQId) {
      setError('Company context is required. Please refresh the page.');
      return;
    }

    if (!form.relationship || !form.typeOfPerson || !form.whyReachingOut.trim()) {
      setError('Please fill in all required fields: Relationship, Type of Person, and Why Reaching Out.');
      return;
    }

    if (!preview.content.trim()) {
      setError('Please generate or create a message preview first.');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const response = await api.post('/api/template/build', {
        companyHQId,
        title: form.title?.trim() || generateTitle(form.typeOfPerson),
        relationship: form.relationship,
        typeOfPerson: form.typeOfPerson,
        whyReachingOut: form.whyReachingOut.trim(),
        whatWantFromThem: form.whatWantFromThem?.trim() || null,
      });

      if (response.data?.success && response.data?.templateBase) {
        setTemplateBaseId(response.data.templateBase.id);
        // If we have preview content, save it directly (for AI-generated or manual)
        if (preview.content.trim()) {
          await handleSave();
        } else {
          // Otherwise hydrate from template base
          await handleHydrate(response.data.templateBase.id);
        }
      } else {
        throw new Error('Failed to create template base');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to build template');
    } finally {
      setSaving(false);
    }
  };

  const handleHydrate = async (baseId = null) => {
    const idToUse = baseId || templateBaseId;
    if (!idToUse) {
      // For manual mode, use client-side hydration (already handled in useEffect)
      return;
    }

    setHydrating(true);
    setError(null);

    try {
      const response = await api.post('/api/template/hydrate', {
        templateBaseId: idToUse,
      });

      if (response.data?.success) {
        setPreview({
          content: response.data.message,
          sections: response.data.sections || {},
        });
      } else {
        throw new Error('Failed to hydrate template');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to hydrate template');
    } finally {
      setHydrating(false);
    }
  };

  // Deterministic hydration function (client-side preview)
  const hydrateMessage = (templateBase) => {
    const { whyReachingOut, relationship, whatWantFromThem } = templateBase;

    const opening = whyReachingOut.trim();

    let context = '';
    switch (relationship) {
      case 'COLD':
        context = "I'd love to connect and learn more about what you're working on.";
        break;
      case 'WARM':
        context = "It's been a while since we last connected.";
        break;
      case 'ESTABLISHED':
        context = "I wanted to reach out and see how things are going.";
        break;
      case 'DORMANT':
        context = "I know it's been a while, but I wanted to reconnect.";
        break;
      default:
        context = "I wanted to reach out and say hello.";
    }

    const releaseValveOptions = [
      "No agenda — just wanted to check in.",
      "No pressure at all.",
      "Thought I'd reach out and say hello.",
      "Just wanted to touch base — no expectations.",
    ];
    const releaseValve = releaseValveOptions[0]; // Use first for consistency

    let close = '';
    if (whatWantFromThem && whatWantFromThem.trim() !== '') {
      close = `If you're open to it, ${whatWantFromThem.trim().toLowerCase()}. But again, no pressure — just wanted to put it out there.`;
    } else {
      close = "Hope you're doing well!";
    }

    const content = [opening, context, releaseValve, close].join(' ');

    return {
      content,
      sections: {
        opening,
        context,
        releaseValve,
        close,
      },
    };
  };

  const handleSave = async () => {
    // If no templateBaseId yet, create it first
    if (!templateBaseId) {
      if (!companyHQId) {
        setError('Company context is required. Please refresh the page.');
        return;
      }

      if (!form.relationship || !form.typeOfPerson || !form.whyReachingOut.trim()) {
        setError('Please fill in all required fields first.');
        return;
      }

      try {
        const buildResponse = await api.post('/api/template/build', {
          companyHQId,
          title: form.title?.trim() || generateTitle(form.typeOfPerson),
          relationship: form.relationship,
          typeOfPerson: form.typeOfPerson,
          whyReachingOut: form.whyReachingOut.trim(),
          whatWantFromThem: form.whatWantFromThem?.trim() || null,
        });

        if (buildResponse.data?.success && buildResponse.data?.templateBase) {
          setTemplateBaseId(buildResponse.data.templateBase.id);
        } else {
          throw new Error('Failed to create template base');
        }
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'Failed to create template base');
        return;
      }
    }

    if (!preview.content.trim()) {
      setError('No content to save. Please generate or create a message first.');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const finalMode = mode === 'IDEA' ? 'AI' : mode === 'TEMPLATE' ? 'MANUAL' : 'MANUAL';
      const response = await api.post('/api/template/save', {
        templateBaseId,
        content: preview.content,
        mode: finalMode,
      });

      if (response.data?.success) {
        // Update localStorage cache
        if (typeof window !== 'undefined' && companyHQId) {
          try {
            const cachedKey = `outreachTemplates_${companyHQId}`;
            const cached = localStorage.getItem(cachedKey);
            const existingTemplates = cached ? JSON.parse(cached) : [];
            const updatedTemplates = [response.data.template, ...existingTemplates];
            localStorage.setItem(cachedKey, JSON.stringify(updatedTemplates));
            console.log('✅ Cached saved template to localStorage');
          } catch (e) {
            console.warn('Failed to cache template to localStorage:', e);
          }
        }
        
        setSuccess(true);
        setTimeout(() => {
          router.push('/template/saved');
        }, 1500);
      } else {
        throw new Error('Failed to save template');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-900">Build Outreach Template</h1>
          <p className="mt-2 text-sm text-gray-600">
            Create a human, low-pressure outreach message to re-enter or maintain relationships.
          </p>
        </div>


        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            Template saved successfully! Redirecting...
          </div>
        )}

        {/* Mode Toggle */}
        <div className="mb-6 flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4">
          <span className="text-sm font-medium text-gray-700">Mode:</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSwitchToManual}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                mode === 'MANUAL'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Manual
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('IDEA');
                setSelectedTemplate(null);
              }}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                mode === 'IDEA'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Create with AI
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('TEMPLATE');
                setIdea('');
              }}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                mode === 'TEMPLATE'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Use Template
            </button>
          </div>
        </div>

        {/* Split Screen Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left Panel - Builder Inputs */}
          <div className="space-y-6">
            {mode === 'IDEA' ? (
              /* Create with AI Input */
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Create with AI</h2>
                <p className="mb-4 text-sm text-gray-600">
                  Describe your outreach idea and AI will infer the structured fields
                </p>
                <div className="space-y-4">
                  <textarea
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    placeholder="e.g., I want to reach out to my old coworker Sarah who I haven't talked to in 2 years. She moved to a new company and I'd love to catch up over coffee."
                    rows={6}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  />
                  <button
                    type="button"
                    onClick={handleParse}
                    disabled={parsing || !idea.trim()}
                    className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {parsing ? 'Parsing...' : 'Parse'}
                  </button>
                </div>
              </div>
            ) : mode === 'TEMPLATE' ? (
              /* Template Selector */
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Choose a Template</h2>
                <p className="mb-4 text-sm text-gray-600">
                  Select a template to auto-fill the form fields
                </p>
                <div className="space-y-3">
                  {PREDEFINED_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => handleTemplateSelect(template)}
                      className={`w-full rounded-lg border-2 p-4 text-left transition-colors ${
                        selectedTemplate === template.id
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-semibold text-gray-900">{template.name}</div>
                      <div className="mt-1 text-sm text-gray-600">{template.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Builder Inputs</h2>
              
              {mode === 'IDEA' && form.whyReachingOut && (
                <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                  ✓ Fields inferred. Edit them if needed, then generate the message.
                </div>
              )}
              {mode === 'TEMPLATE' && selectedTemplate && (
                <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                  ✓ Template selected - fields are auto-filled. Feel free to customize them.
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="e.g., Outreach to Former Co-worker"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Name for this template base (auto-generated from type, but you can customize)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Relationship <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="relationship"
                    value={form.relationship}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    required
                    disabled={false}
                  >
                    <option value="">Select relationship</option>
                    {RELATIONSHIP_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Type of Person <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="typeOfPerson"
                    value={form.typeOfPerson}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    required
                    disabled={false}
                  >
                    <option value="">Select type</option>
                    {TYPE_OF_PERSON_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Why Reaching Out <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="whyReachingOut"
                    value={form.whyReachingOut}
                    onChange={handleChange}
                    placeholder="e.g., Saw you moved to a new firm, Noticed you had a baby, Haven't connected in a while, Saw your company in the news"
                    rows={3}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    required
                    disabled={false}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Free-text human observation about why you're reaching out
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    What Want From Them (Optional)
                  </label>
                  <textarea
                    name="whatWantFromThem"
                    value={form.whatWantFromThem}
                    onChange={handleChange}
                    placeholder="e.g., I'd love to grab coffee, Would be great to catch up, etc."
                    rows={2}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    disabled={false}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Optional and often empty in early outreach
                  </p>
                </div>

                <div className="flex gap-2">
                  {mode === 'IDEA' && !preview.content ? (
                    <button
                      type="button"
                      onClick={handleGenerateMessage}
                      disabled={generating || !form.relationship || !form.typeOfPerson || !form.whyReachingOut.trim()}
                      className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      {generating ? 'Generating...' : 'Generate Message'}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleBuild}
                        disabled={saving || !form.relationship || !form.typeOfPerson || !form.whyReachingOut.trim()}
                        className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        {saving ? 'Building...' : 'Build Template'}
                      </button>
                      {templateBaseId && (
                        <button
                          type="button"
                          onClick={() => handleHydrate()}
                          disabled={hydrating}
                          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                        >
                          {hydrating ? 'Hydrating...' : 'Refresh Preview'}
                        </button>
                      )}
                      {mode === 'IDEA' && (
                        <button
                          type="button"
                          onClick={handleGenerateMessage}
                          disabled={generating}
                          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                        >
                          {generating ? 'Generating...' : 'Regenerate'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Live Preview */}
          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Live Preview</h2>

              {preview.content ? (
                <div className="space-y-4">
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
                    <div className="space-y-3 text-sm text-gray-800">
                      {preview.sections.opening && (
                        <div>
                          <div className="mb-1 text-xs font-semibold uppercase text-gray-500">Opening</div>
                          <div>{preview.sections.opening}</div>
                        </div>
                      )}
                      {preview.sections.context && (
                        <div>
                          <div className="mb-1 text-xs font-semibold uppercase text-gray-500">Context</div>
                          <div>{preview.sections.context}</div>
                        </div>
                      )}
                      {preview.sections.releaseValve && (
                        <div>
                          <div className="mb-1 text-xs font-semibold uppercase text-gray-500">Release Valve</div>
                          <div>{preview.sections.releaseValve}</div>
                        </div>
                      )}
                      {preview.sections.close && (
                        <div>
                          <div className="mb-1 text-xs font-semibold uppercase text-gray-500">Close</div>
                          <div>{preview.sections.close}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-md border border-gray-200 bg-white p-4">
                    <div className="mb-2 text-xs font-semibold uppercase text-gray-500">Full Message</div>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap">{preview.content}</div>
                  </div>

                  {templateBaseId && (
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving || !preview.content.trim()}
                      className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      {saving ? 'Saving...' : 'Save Template'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
                  {templateBaseId
                    ? 'Click "Refresh Preview" to generate the message'
                    : 'Fill in the form and click "Build Template" to see a preview'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

