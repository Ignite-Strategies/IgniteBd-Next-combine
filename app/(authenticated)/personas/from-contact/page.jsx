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

  const [contact, setContact] = useState(null);
  const [personaData, setPersonaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch contact and generate minimal persona
  useEffect(() => {
    if (!contactId || !companyHQId) return;

    const fetchContactAndGenerate = async () => {
      setLoading(true);
      setGenerating(true);

      try {
        // Fetch contact
        const contactResponse = await api.get(`/api/contacts/${contactId}`);
        if (contactResponse.data?.success && contactResponse.data?.contact) {
          const fetchedContact = contactResponse.data.contact;
          setContact(fetchedContact);

          // Generate minimal persona (MVP1 - just basics)
          // API will fetch contact from DB - we just pass contactId
          try {
            const personaResponse = await api.post('/api/personas/generate-minimal', {
              companyHQId,
              contactId,
            });

            if (personaResponse.data?.success && personaResponse.data?.persona) {
              const persona = personaResponse.data.persona;
              setPersonaData({
                personName: persona.personName || fetchedContact.fullName || `${fetchedContact.firstName || ''} ${fetchedContact.lastName || ''}`.trim() || 'New Persona',
                title: persona.title || fetchedContact.title || '',
                company: persona.company || fetchedContact.companyName || '',
                coreGoal: persona.coreGoal || '',
              });
            }
          } catch (err) {
            console.error('Failed to generate minimal persona:', err);
            // Soft fallback - use contact data (only if contact was successfully fetched)
            if (fetchedContact) {
              setPersonaData({
                personName: fetchedContact.fullName || `${fetchedContact.firstName || ''} ${fetchedContact.lastName || ''}`.trim() || 'New Persona',
                title: fetchedContact.title || '',
                company: fetchedContact.companyName || '',
                coreGoal: '',
              });
            } else {
              // If no contact data, set minimal defaults
              setPersonaData({
                personName: 'New Persona',
                title: '',
                company: '',
                coreGoal: '',
              });
            }
          }
        } else {
          // Contact fetch failed or returned no data
          console.error('Failed to fetch contact or contact not found');
          setPersonaData({
            personName: 'New Persona',
            title: '',
            company: '',
            coreGoal: '',
          });
        }
      } catch (err) {
        console.error('Failed to fetch contact:', err);
        // Set minimal defaults on error
        setPersonaData({
          personName: 'New Persona',
          title: '',
          company: '',
          coreGoal: '',
        });
      } finally {
        setLoading(false);
        setGenerating(false);
      }
    };

    fetchContactAndGenerate();
  }, [contactId, companyHQId]);

  const handleFieldChange = (field, value) => {
    setPersonaData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!personaData || !companyHQId) return;

    setSaving(true);

    try {
      const payload = {
        personName: personaData.personName || '',
        title: personaData.title || '',
        company: personaData.company || '',
        coreGoal: personaData.coreGoal || '',
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
      }
    } catch (err) {
      console.error('Failed to save persona:', err);
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

  if (loading || generating) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
            <p className="mt-4 text-gray-600">Generating minimal persona...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!personaData) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
            <p className="text-gray-600">No persona data available</p>
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

        {/* Persona Form - MVP1 Only */}
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
                  value={personaData.personName || ''}
                  onChange={(e) => handleFieldChange('personName', e.target.value)}
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
                  value={personaData.title || ''}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
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
                value={personaData.company || ''}
                onChange={(e) => handleFieldChange('company', e.target.value)}
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
                value={personaData.coreGoal || ''}
                onChange={(e) => handleFieldChange('coreGoal', e.target.value)}
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
            disabled={saving || !personaData.personName || !personaData.title || !personaData.company || !personaData.coreGoal}
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
