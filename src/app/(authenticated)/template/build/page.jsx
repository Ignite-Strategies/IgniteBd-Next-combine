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

export default function TemplateBuildPage() {
  const router = useRouter();
  const { companyHQId } = useCompanyHQ();
  const [mode, setMode] = useState('MANUAL'); // 'MANUAL' | 'AI'
  const [form, setForm] = useState({
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
  };

  // Auto-hydrate preview when form changes (for MANUAL mode)
  useEffect(() => {
    if (mode === 'MANUAL' && templateBaseId) {
      handleHydrate();
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

    setError(null);
    setSaving(true);

    try {
      const response = await api.post('/api/template/build', {
        companyHQId,
        relationship: form.relationship,
        typeOfPerson: form.typeOfPerson,
        whyReachingOut: form.whyReachingOut.trim(),
        whatWantFromThem: form.whatWantFromThem?.trim() || null,
      });

      if (response.data?.success && response.data?.templateBase) {
        setTemplateBaseId(response.data.templateBase.id);
        // Auto-hydrate after building
        await handleHydrate(response.data.templateBase.id);
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
      // For manual mode, create a temporary template base for preview
      if (mode === 'MANUAL' && form.relationship && form.typeOfPerson && form.whyReachingOut.trim()) {
        // Create temporary preview without saving
        const tempBase = {
          relationship: form.relationship,
          typeOfPerson: form.typeOfPerson,
          whyReachingOut: form.whyReachingOut.trim(),
          whatWantFromThem: form.whatWantFromThem?.trim() || null,
        };
        const hydrated = hydrateMessage(tempBase);
        setPreview(hydrated);
      }
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
    if (!templateBaseId) {
      setError('Please build the template first.');
      return;
    }

    if (!preview.content.trim()) {
      setError('No content to save. Please hydrate the template first.');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const response = await api.post('/api/template/save', {
        templateBaseId,
        content: preview.content,
        mode,
      });

      if (response.data?.success) {
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

        {/* Mode Toggle */}
        <div className="mb-6 flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4">
          <span className="text-sm font-medium text-gray-700">Mode:</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('MANUAL')}
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
              onClick={() => setMode('AI')}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                mode === 'AI'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              disabled
              title="AI mode coming soon"
            >
              Use AI (Coming Soon)
            </button>
          </div>
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

        {/* Split Screen Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left Panel - Builder Inputs */}
          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Builder Inputs</h2>

              <div className="space-y-4">
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
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Optional and often empty in early outreach
                  </p>
                </div>

                <div className="flex gap-2">
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

