'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';

function FromContactContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contactId = searchParams?.get('contactId');

  const [contact, setContact] = useState(null);
  const [personaData, setPersonaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  // Use hook to get companyHQId (fetches from API if not in localStorage)
  const { companyHQId, loading: companyLoading, refresh } = useCompanyHQ();

  // Fetch companyHQId from API if not in localStorage
  useEffect(() => {
    if (!companyHQId && !companyLoading) {
      refresh();
    }
  }, [companyHQId, companyLoading, refresh]);

  // Fetch contact and generate persona
  useEffect(() => {
    if (!contactId || !companyHQId || companyLoading) return;

    const fetchAndGenerate = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch contact
        const contactResponse = await api.get(`/api/contacts/${contactId}`);
        if (!contactResponse.data?.success || !contactResponse.data?.contact) {
          throw new Error('Contact not found');
        }
        setContact(contactResponse.data.contact);

        // Generate persona using EnrichmentToPersonaService
        setGenerating(true);
        const personaResponse = await api.post('/api/personas/generate-from-enrichment', {
          contactId,
          companyHQId,
          mode: 'hydrate', // Return data only, don't save yet
        });

        if (personaResponse.data?.success && personaResponse.data?.persona) {
          setPersonaData(personaResponse.data.persona);
        } else {
          throw new Error(personaResponse.data?.error || 'Failed to generate persona');
        }
      } catch (err) {
        console.error('Failed to fetch contact or generate persona:', err);
        setError(err.response?.data?.error || err.message || 'Failed to load contact or generate persona');
      } finally {
        setLoading(false);
        setGenerating(false);
      }
    };

    fetchAndGenerate();
  }, [contactId, companyHQId, companyLoading]);

  const handleFieldChange = (field, value) => {
    setPersonaData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleArrayFieldChange = (field, value) => {
    // Convert string to array (split by newlines or commas)
    const arrayValue = typeof value === 'string' 
      ? value.split(/\n|,/).map(item => item.trim()).filter(Boolean)
      : value;
    
    setPersonaData((prev) => ({
      ...prev,
      [field]: arrayValue,
    }));
  };

  const handleSave = async () => {
    if (!personaData || !companyHQId) return;

    setSaving(true);
    setError(null);

    try {
      // Normalize array fields
      const payload = {
        ...personaData,
        companyHQId,
        painPoints: Array.isArray(personaData.painPoints) 
          ? personaData.painPoints 
          : (typeof personaData.painPoints === 'string' ? personaData.painPoints.split(/\n|,/).map(s => s.trim()).filter(Boolean) : []),
        risks: Array.isArray(personaData.risks) 
          ? personaData.risks 
          : (typeof personaData.risks === 'string' ? personaData.risks.split(/\n|,/).map(s => s.trim()).filter(Boolean) : []),
        decisionDrivers: Array.isArray(personaData.decisionDrivers) 
          ? personaData.decisionDrivers 
          : (typeof personaData.decisionDrivers === 'string' ? personaData.decisionDrivers.split(/\n|,/).map(s => s.trim()).filter(Boolean) : []),
        buyerTriggers: Array.isArray(personaData.buyerTriggers) 
          ? personaData.buyerTriggers 
          : (typeof personaData.buyerTriggers === 'string' ? personaData.buyerTriggers.split(/\n|,/).map(s => s.trim()).filter(Boolean) : []),
        subIndustries: Array.isArray(personaData.subIndustries) 
          ? personaData.subIndustries 
          : (typeof personaData.subIndustries === 'string' ? personaData.subIndustries.split(/\n|,/).map(s => s.trim()).filter(Boolean) : []),
      };

      const response = await api.post('/api/personas', payload);

      if (response.data?.personaId || response.data?.persona) {
        // Redirect to personas list
        router.push('/personas');
      } else {
        throw new Error('Failed to save persona');
      }
    } catch (err) {
      console.error('Failed to save persona:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save persona');
    } finally {
      setSaving(false);
    }
  };

  if (!contactId) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Contact ID is required
          </div>
        </div>
      </div>
    );
  }

  if (loading || generating) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-red-600" />
            <p className="mt-4 text-gray-600">
              {generating ? 'Generating persona...' : 'Loading contact...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !personaData) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
          <button
            onClick={() => router.back()}
            className="mt-4 text-sm text-gray-600 hover:text-gray-900"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!personaData) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <p className="text-gray-600">No persona data available</p>
            <button
              onClick={() => router.back()}
              className="mt-4 text-sm text-gray-600 hover:text-gray-900"
            >
              ← Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold text-gray-900">Review & Edit Persona</h1>
          <p className="mt-2 text-gray-600">
            Review the generated persona and make any edits before saving
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Persona Form */}
        <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
          {/* Basic Info */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Persona Name *
            </label>
            <input
              type="text"
              value={personaData.personName || ''}
              onChange={(e) => handleFieldChange('personName', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={personaData.title || ''}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Headline
            </label>
            <input
              type="text"
              value={personaData.headline || ''}
              onChange={(e) => handleFieldChange('headline', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={personaData.description || ''}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Industry & Company */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Industry
              </label>
              <input
                type="text"
                value={personaData.industry || ''}
                onChange={(e) => handleFieldChange('industry', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Company Size
              </label>
              <input
                type="text"
                value={personaData.companySize || ''}
                onChange={(e) => handleFieldChange('companySize', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              What They Want
            </label>
            <textarea
              value={personaData.whatTheyWant || ''}
              onChange={(e) => handleFieldChange('whatTheyWant', e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Array Fields */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Pain Points (one per line or comma-separated)
            </label>
            <textarea
              value={Array.isArray(personaData.painPoints) ? personaData.painPoints.join('\n') : (personaData.painPoints || '')}
              onChange={(e) => handleArrayFieldChange('painPoints', e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Enter pain points, one per line"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Risks (one per line or comma-separated)
            </label>
            <textarea
              value={Array.isArray(personaData.risks) ? personaData.risks.join('\n') : (personaData.risks || '')}
              onChange={(e) => handleArrayFieldChange('risks', e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Enter risks, one per line"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Decision Drivers (one per line or comma-separated)
            </label>
            <textarea
              value={Array.isArray(personaData.decisionDrivers) ? personaData.decisionDrivers.join('\n') : (personaData.decisionDrivers || '')}
              onChange={(e) => handleArrayFieldChange('decisionDrivers', e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Enter decision drivers, one per line"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Buyer Triggers (one per line or comma-separated)
            </label>
            <textarea
              value={Array.isArray(personaData.buyerTriggers) ? personaData.buyerTriggers.join('\n') : (personaData.buyerTriggers || '')}
              onChange={(e) => handleArrayFieldChange('buyerTriggers', e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Enter buyer triggers, one per line"
            />
          </div>
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
            disabled={saving || !personaData.personName || !personaData.title}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

