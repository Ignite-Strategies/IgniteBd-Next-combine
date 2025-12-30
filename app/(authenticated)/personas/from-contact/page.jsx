'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import api from '@/lib/api';

function FromContactContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contactId = searchParams?.get('contactId');
  const companyHQId = searchParams?.get('companyHQId') || '';

  // Individual field state - matches template builder pattern
  const [personName, setPersonName] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [coreGoal, setCoreGoal] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Generate minimal persona - backend does all the work
  // Form fields are always visible, we just populate them when generation succeeds
  useEffect(() => {
    if (!contactId || !companyHQId) {
      setLoading(false);
      return;
    }

    const generatePersona = async () => {
      setGenerating(true);
      setError('');

      try {
        const response = await api.post('/api/personas/generate-minimal', {
          companyHQId,
          contactId,
        });

        if (response.data?.success && response.data?.persona) {
          const persona = response.data.persona;
          setPersonName(persona.personName || '');
          setTitle(persona.title || '');
          setCompany(persona.company || '');
          setCoreGoal(persona.coreGoal || '');
        } else {
          setError(response.data?.error || 'Failed to generate persona');
        }
      } catch (err) {
        console.error('Failed to generate minimal persona:', err);
        setError(err.response?.data?.error || 'Failed to generate persona');
        // Don't block the form - user can still fill it manually
      } finally {
        setGenerating(false);
      }
    };

    generatePersona();
  }, [contactId, companyHQId]);

  const handleSave = async () => {
    if (!companyHQId) {
      setError('Company context is required');
      return;
    }

    if (!personName.trim() || !title.trim() || !company.trim() || !coreGoal.trim()) {
      setError('All fields are required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        personName: personName.trim(),
        title: title.trim(),
        company: company.trim(),
        coreGoal: coreGoal.trim(),
        // MVP2 fields (scaffolded but not generated yet)
        role: null,
        seniority: null,
        needForOurProduct: null,
        potentialPitch: null,
        painPoints: [],
        industry: null,
        companySize: null,
      };

      const response = await api.post('/api/personas/save', {
        persona: payload,
        companyHQId,
      });

      if (response.data?.success) {
        router.push(`/personas?companyHQId=${companyHQId}&saved=true`);
      } else {
        setError(response.data?.error || 'Failed to save persona');
      }
    } catch (err) {
      console.error('Failed to save persona:', err);
      setError(err.response?.data?.error || 'Failed to save persona');
    } finally {
      setSaving(false);
    }
  };

  if (!contactId) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
            <p className="text-gray-600">Contact ID is required</p>
            <button
              onClick={() => router.back()}
              className="mt-4 text-sm text-blue-600 hover:text-blue-800"
            >
              ← Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show form immediately - fields are always visible
  // Generation happens in background and populates fields when ready


  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Create Persona (MVP1)</h1>
          <p className="mt-2 text-gray-600">
            Just the essentials: who they are, what company, core goal
          </p>
        </div>

        {/* Generating Indicator */}
        {generating && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <p className="text-sm text-blue-800">Generating persona from contact...</p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
            <p className="mt-2 text-xs text-red-700">You can still fill out the form manually below.</p>
          </div>
        )}

        {/* Persona Form - MVP1 Only - Always Visible */}
        <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
          {/* WHO IS THIS PERSON */}
          <div>
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Who is this person?</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Persona Name *
                </label>
                <input
                  type="text"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="e.g., Compliance Manager"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Deputy Counsel"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  required
                />
              </div>
            </div>
          </div>

          {/* WHAT COMPANY */}
          <div>
            <h3 className="mb-4 text-lg font-semibold text-gray-900">What company?</h3>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Company *
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g., X Firm"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                required
              />
            </div>
          </div>

          {/* CORE GOAL */}
          <div>
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Core Goal</h3>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Core Goal *
              </label>
              <p className="mb-2 text-xs text-gray-500">Their north star (one sentence)</p>
              <textarea
                value={coreGoal}
                onChange={(e) => setCoreGoal(e.target.value)}
                placeholder="e.g., Ensure compliance with industry regulations while minimizing operational overhead"
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                required
              />
            </div>
          </div>
        </div>

        {/* MVP2 Note */}
        <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-500">
            <strong>MVP1:</strong> Just the essentials. MVP2 will add product fit analysis, pain points, and more detail.
          </p>
        </div>

        {/* Save Button */}
        <div className="mt-6 flex items-center justify-end gap-4">
          <button
            onClick={() => router.back()}
            className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !personName.trim() || !title.trim() || !company.trim() || !coreGoal.trim()}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Persona
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FromContactPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <FromContactContent />
    </Suspense>
  );
}
