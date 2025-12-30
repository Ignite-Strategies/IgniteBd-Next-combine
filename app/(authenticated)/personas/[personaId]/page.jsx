'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw, Save, Edit2, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import PageHeader from '@/components/PageHeader.jsx';

function PersonaDetailContent({ params }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || (typeof window !== 'undefined' ? localStorage.getItem('companyHQId') : '') || '';
  
  const [persona, setPersona] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    personName: '',
    title: '',
    companyType: '',
    companySize: '',
    industry: '',
    coreGoal: '',
    painPoints: '',
    whatProductNeeds: '',
  });

  // Resolve params (handle async params in Next.js 15)
  const [personaId, setPersonaId] = useState(null);
  useEffect(() => {
    const resolveParams = async () => {
      if (params && typeof params.then === 'function') {
        const resolvedParams = await params;
        setPersonaId(resolvedParams?.personaId);
      } else if (params?.personaId) {
        setPersonaId(params.personaId);
      }
    };
    resolveParams();
  }, [params]);

  // Load persona
  useEffect(() => {
    if (!personaId || !companyHQId) return;

    const loadPersona = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get(`/api/personas/${personaId}?companyHQId=${companyHQId}`);
        
        if (!response.data) {
          setError('Persona not found');
          return;
        }

        const personaData = response.data;
        setPersona(personaData);
        
        // Initialize form data
        setFormData({
          personName: personaData.personName || '',
          title: personaData.title || '',
          companyType: personaData.company || personaData.companyType || '',
          companySize: personaData.companySize || '',
          industry: personaData.industry || '',
          coreGoal: personaData.coreGoal || '',
          painPoints: Array.isArray(personaData.painPoints)
            ? personaData.painPoints.join('\n')
            : personaData.painPoints || '',
          whatProductNeeds: personaData.needForOurProduct || personaData.whatProductNeeds || personaData.whatTheyWant || '',
        });
      } catch (err) {
        console.error('Failed to load persona:', err);
        setError(err.response?.data?.error || err.message || 'Failed to load persona');
      } finally {
        setLoading(false);
      }
    };

    loadPersona();
  }, [personaId, companyHQId]);

  // Handle save
  const handleSave = async () => {
    if (!companyHQId) {
      setError('Company context is required');
      return;
    }

    if (!formData.personName.trim() || !formData.title.trim() || !formData.companyType.trim() || 
        !formData.companySize.trim() || !formData.industry.trim() || !formData.coreGoal.trim() || 
        !formData.whatProductNeeds.trim()) {
      setError('All required fields must be filled');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const ownerId = typeof window !== 'undefined' ? localStorage.getItem('ownerId') : null;
      if (!ownerId) {
        throw new Error('Owner ID not found. Please sign in again.');
      }

      const painPointsArray = formData.painPoints.trim()
        ? formData.painPoints.split('\n').map(p => p.trim()).filter(p => p.length > 0)
        : [];

      const payload = {
        personName: formData.personName.trim(),
        title: formData.title.trim(),
        company: formData.companyType.trim(),
        companySize: formData.companySize.trim(),
        industry: formData.industry.trim(),
        coreGoal: formData.coreGoal.trim(),
        needForOurProduct: formData.whatProductNeeds.trim(),
        painPoints: painPointsArray,
        role: null,
        seniority: null,
        potentialPitch: null,
      };

      const response = await api.post('/api/personas/save', {
        persona: payload,
        personaId,
        companyHQId,
        ownerId,
      });

      if (response.data?.success) {
        setPersona(response.data.persona);
        setEditing(false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(response.data?.error || 'Failed to save persona');
      }
    } catch (err) {
      console.error('Failed to save persona:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save persona');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-500" />
            <p className="mt-3 text-sm font-medium text-gray-700">Loading persona…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !persona) {
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-lg font-semibold text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => router.push(companyHQId ? `/personas?companyHQId=${companyHQId}` : '/personas')}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Back to Personas
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!persona) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title={persona.personName || persona.title || 'Persona'}
          subtitle={persona.title || 'Buyer persona details'}
          backTo={companyHQId ? `/personas?companyHQId=${companyHQId}` : '/personas'}
          backLabel="Back to Personas"
          actions={
            !editing ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                <Edit2 className="h-4 w-4" />
                Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    // Reset form data to original persona
                    setFormData({
                      personName: persona.personName || '',
                      title: persona.title || '',
                      companyType: persona.company || persona.companyType || '',
                      companySize: persona.companySize || '',
                      industry: persona.industry || '',
                      coreGoal: persona.coreGoal || '',
                      painPoints: Array.isArray(persona.painPoints)
                        ? persona.painPoints.join('\n')
                        : persona.painPoints || '',
                      whatProductNeeds: persona.needForOurProduct || persona.whatProductNeeds || persona.whatTheyWant || '',
                    });
                  }}
                  className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Save
                    </>
                  )}
                </button>
              </div>
            )
          }
        />

        {success && (
          <div className="mb-6 rounded-lg border-2 border-green-500 bg-green-50 p-4 text-base font-semibold text-green-800 flex items-center gap-3 shadow-sm">
            <Check className="h-6 w-6 flex-shrink-0" />
            <span>Persona updated successfully!</span>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-6">
          {/* Persona Details Card */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-6 text-xl font-bold text-gray-900">Persona Details</h2>
            
            <div className="space-y-4">
              {/* Person Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Persona Name *
                </label>
                {editing ? (
                  <input
                    type="text"
                    value={formData.personName}
                    onChange={(e) => handleInputChange('personName', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    disabled={saving}
                  />
                ) : (
                  <p className="text-gray-900">{persona.personName || 'Not set'}</p>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Title *
                </label>
                {editing ? (
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    disabled={saving}
                  />
                ) : (
                  <p className="text-gray-900">{persona.title || 'Not set'}</p>
                )}
              </div>

              {/* Company Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Company Type *
                </label>
                {editing ? (
                  <input
                    type="text"
                    value={formData.companyType}
                    onChange={(e) => handleInputChange('companyType', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    disabled={saving}
                  />
                ) : (
                  <p className="text-gray-900">{persona.company || persona.companyType || 'Not set'}</p>
                )}
              </div>

              {/* Company Size */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Company Size *
                </label>
                {editing ? (
                  <input
                    type="text"
                    value={formData.companySize}
                    onChange={(e) => handleInputChange('companySize', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    disabled={saving}
                  />
                ) : (
                  <p className="text-gray-900">{persona.companySize || 'Not set'}</p>
                )}
              </div>

              {/* Industry */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Industry *
                </label>
                {editing ? (
                  <input
                    type="text"
                    value={formData.industry}
                    onChange={(e) => handleInputChange('industry', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    disabled={saving}
                  />
                ) : (
                  <p className="text-gray-900">{persona.industry || 'Not set'}</p>
                )}
              </div>

              {/* Core Goal */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Core Goal *
                </label>
                {editing ? (
                  <textarea
                    value={formData.coreGoal}
                    onChange={(e) => handleInputChange('coreGoal', e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    disabled={saving}
                  />
                ) : (
                  <p className="text-gray-900 whitespace-pre-wrap">{persona.coreGoal || 'Not set'}</p>
                )}
              </div>

              {/* Pain Points */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Pain Points *
                </label>
                {editing ? (
                  <textarea
                    value={formData.painPoints}
                    onChange={(e) => handleInputChange('painPoints', e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    disabled={saving}
                  />
                ) : (
                  <div className="text-gray-900">
                    {Array.isArray(persona.painPoints) && persona.painPoints.length > 0 ? (
                      <ul className="list-disc list-inside space-y-1">
                        {persona.painPoints.map((point, idx) => (
                          <li key={idx}>{point}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>Not set</p>
                    )}
                  </div>
                )}
              </div>

              {/* What Product Needs */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  What Product Needs *
                </label>
                {editing ? (
                  <textarea
                    value={formData.whatProductNeeds}
                    onChange={(e) => handleInputChange('whatProductNeeds', e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    disabled={saving}
                  />
                ) : (
                  <p className="text-gray-900 whitespace-pre-wrap">
                    {persona.needForOurProduct || persona.whatProductNeeds || persona.whatTheyWant || 'Not set'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PersonaDetailPage({ params }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 py-16">
          <div className="mx-auto max-w-4xl px-4">
            <div className="rounded-2xl bg-white p-8 text-center shadow">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-500" />
              <p className="mt-3 text-sm font-medium text-gray-700">Loading...</p>
            </div>
          </div>
        </div>
      }
    >
      <PersonaDetailContent params={params} />
    </Suspense>
  );
}
