'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';
import TemplateTestService from '@/lib/services/templateTestService';

// Prevent prerendering - this page requires client-side state
export const dynamic = 'force-dynamic';

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

export default function RelationshipHelperPage() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const router = useRouter();
  const { companyHQId } = useCompanyHQ();
  const [form, setForm] = useState({
    title: '',
    relationship: '',
    typeOfPerson: '',
    whyReachingOut: '',
    whatWantFromThem: '',
    timeSinceConnected: '',
    timeHorizon: '',
    knowledgeOfBusiness: false,
    myBusinessDescription: '',
    desiredOutcome: '',
  });
  const [preview, setPreview] = useState({ content: '', subjectLine: '' });
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'preview'

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setError(null);
  };

  const generateTitle = (typeOfPerson) => {
    const typeLabels = {
      CURRENT_CLIENT: 'Current Client',
      FORMER_CLIENT: 'Former Client',
      FORMER_COWORKER: 'Former Co-worker',
      PROSPECT: 'Prospect',
      PARTNER: 'Partner',
      FRIEND_OF_FRIEND: 'Friend',
    };
    return `Outreach to ${typeLabels[typeOfPerson] || 'Contact'}`;
  };

  const handleGenerate = async () => {
    if (!form.relationship || !form.typeOfPerson || !form.whyReachingOut.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setError(null);
    setGenerating(true);

    try {
      const response = await api.post('/api/template/generate-relationship-aware', {
        relationship: form.relationship,
        typeOfPerson: form.typeOfPerson,
        whyReachingOut: form.whyReachingOut.trim(),
        whatWantFromThem: form.whatWantFromThem?.trim() || null,
        timeSinceConnected: form.timeSinceConnected?.trim() || null,
        timeHorizon: form.timeHorizon?.trim() || null,
        knowledgeOfBusiness: form.knowledgeOfBusiness || false,
        myBusinessDescription: form.myBusinessDescription?.trim() || null,
        desiredOutcome: form.desiredOutcome?.trim() || null,
      });

      if (response.data?.success) {
        setPreview({
          content: response.data.template,
          subjectLine: '',
        });
        setStep('preview');
      } else {
        throw new Error('Failed to generate template');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to generate template');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!preview.content?.trim()) {
      setError('No content to save');
      return;
    }

    if (!companyHQId) {
      setError('Company context is required');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const baseResponse = await api.post('/api/template/build', {
        companyHQId,
        title: form.title || generateTitle(form.typeOfPerson),
        relationship: form.relationship,
        typeOfPerson: form.typeOfPerson,
        whyReachingOut: form.whyReachingOut.trim(),
        whatWantFromThem: form.whatWantFromThem?.trim() || null,
        timeSinceConnected: form.timeSinceConnected?.trim() || null,
        timeHorizon: form.timeHorizon?.trim() || null,
        knowledgeOfBusiness: form.knowledgeOfBusiness || false,
        myBusinessDescription: form.myBusinessDescription?.trim() || null,
        desiredOutcome: form.desiredOutcome?.trim() || null,
      });

      if (baseResponse.data?.success && baseResponse.data?.templateBase) {
        const saveResponse = await api.post('/api/template/save', {
          templateBaseId: baseResponse.data.templateBase.id,
          content: preview.content.trim(),
          subjectLine: preview.subjectLine?.trim() || null,
          mode: 'AI',
          companyHQId,
        });

        if (saveResponse.data?.success) {
          setSuccess(true);
          setTimeout(() => {
            router.push('/template/saved');
          }, 1500);
        } else {
          throw new Error('Failed to save template');
        }
      } else {
        throw new Error('Failed to create template base');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save template');
      setSaving(false);
    }
  };

  if (step === 'preview') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6">
            <button
              onClick={() => setStep('form')}
              className="mb-4 flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to form
            </button>
            <h1 className="text-3xl font-semibold text-gray-900">Preview Template</h1>
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

          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject Line (Optional)
              </label>
              <input
                type="text"
                value={preview.subjectLine || ''}
                onChange={(e) => setPreview({ ...preview, subjectLine: e.target.value })}
                placeholder="e.g., Quick check-in"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Generated Template</h2>
              <textarea
                value={preview.content}
                onChange={(e) => setPreview({ ...preview, content: e.target.value })}
                rows={12}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            {/* COMMENTED OUT: Preview generation temporarily disabled due to firstName variable issues during prerendering */}
            {/* {mounted && preview.content && preview.content.trim() && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-6">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Preview (with sample data)</h2>
                <div className="text-sm text-gray-800 whitespace-pre-wrap">
                  {(() => {
                    try {
                      return TemplateTestService.generatePreview(preview.content, { formData: form }).hydratedContent;
                    } catch (error) {
                      console.error('Preview generation error:', error);
                      return preview.content;
                    }
                  })()}
                </div>
              </div>
            )} */}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('form')}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Edit
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {saving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => router.push('/template/build/ai')}
            className="mb-4 flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to AI options
          </button>
          <h1 className="text-3xl font-semibold text-gray-900">Relationship Helper</h1>
          <p className="mt-2 text-sm text-gray-600">
            Build a relationship-aware template with full context
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div className="rounded-md border border-indigo-200 bg-indigo-50 p-4">
            <p className="text-sm text-indigo-700">
              <strong>Relationship-Aware Builder:</strong> Fill in the relationship context below. The AI will use this information to create a personalized template with proper variables.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
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
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Why Reaching Out <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="whyReachingOut"
                  value={form.whyReachingOut}
                  onChange={handleChange}
                  placeholder="e.g., Saw you moved to a new firm, Haven't connected in a while"
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  What Want From Them (Optional)
                </label>
                <textarea
                  name="whatWantFromThem"
                  value={form.whatWantFromThem}
                  onChange={handleChange}
                  placeholder="e.g., I'd love to grab coffee"
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time Since Connected
                  </label>
                  <input
                    type="text"
                    name="timeSinceConnected"
                    value={form.timeSinceConnected}
                    onChange={handleChange}
                    placeholder="e.g., a long time, 2 years"
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time Horizon
                  </label>
                  <input
                    type="text"
                    name="timeHorizon"
                    value={form.timeHorizon}
                    onChange={handleChange}
                    placeholder="e.g., 2026, Q1 2025"
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  My Business Description
                </label>
                <textarea
                  name="myBusinessDescription"
                  value={form.myBusinessDescription}
                  onChange={handleChange}
                  placeholder="e.g., my own NDA house, a consulting firm"
                  rows={2}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Desired Outcome
                </label>
                <textarea
                  name="desiredOutcome"
                  value={form.desiredOutcome}
                  onChange={handleChange}
                  placeholder="e.g., see if we can collaborate, catch up over coffee"
                  rows={2}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="knowledgeOfBusiness"
                  checked={form.knowledgeOfBusiness}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <label className="ml-2 block text-sm text-gray-700">
                  They already know about your business
                </label>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => router.push('/template/build')}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating || !form.relationship || !form.typeOfPerson || !form.whyReachingOut.trim()}
              className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {generating ? 'Generating...' : 'Generate & Preview'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

