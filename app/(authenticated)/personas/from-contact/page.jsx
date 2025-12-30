'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save, Loader2, Package, Sparkles, ArrowRight } from 'lucide-react';
import api from '@/lib/api';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';

function FromContactContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contactId = searchParams?.get('contactId');

  const [contact, setContact] = useState(null);
  const [phase, setPhase] = useState(1); // 1 = initial grab, 2 = product deep dive
  const [initialPersona, setInitialPersona] = useState(null);
  const [personaData, setPersonaData] = useState(null);
  const [productDescription, setProductDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [generatingPhase1, setGeneratingPhase1] = useState(false);
  const [generatingPhase2, setGeneratingPhase2] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Use hook to get companyHQId
  const { companyHQId, loading: companyLoading, refresh } = useCompanyHQ();

  // Fetch companyHQId from API if not in localStorage
  useEffect(() => {
    if (!companyHQId && !companyLoading) {
      refresh();
    }
  }, [companyHQId, companyLoading, refresh]);

  // Phase 1: Fetch contact and generate initial persona (basic info)
  useEffect(() => {
    if (!contactId || !companyHQId || companyLoading || phase !== 1) return;

    const fetchContactAndGenerateInitial = async () => {
      setLoading(true);
      setGeneratingPhase1(true);

      try {
        // Fetch contact
        const contactResponse = await api.get(`/api/contacts/${contactId}`);
        if (contactResponse.data?.success && contactResponse.data?.contact) {
          setContact(contactResponse.data.contact);

          // Generate initial persona (basic info only - no product context)
          try {
            const personaResponse = await api.post('/api/personas/generate', {
              companyHQId,
              contactId,
              // No product context - just basic persona info
            });

            if (personaResponse.data?.success && personaResponse.data?.persona) {
              const persona = personaResponse.data.persona;
              setInitialPersona(persona);
              // Pre-fill basic info
              setPersonaData({
                personName: persona.personName || contact.fullName || 'New Persona',
                title: persona.title || contact.title || '',
                role: persona.role || null,
                seniority: persona.seniority || contact.seniority || null,
                industry: persona.industry || contact.companyIndustry || null,
                companySize: persona.companySize || contact.companySize || null,
                company: persona.company || contact.companyName || null,
                coreGoal: persona.coreGoal || '',
                painPoints: Array.isArray(persona.painPoints) ? persona.painPoints : [],
                needForOurProduct: persona.needForOurProduct || '',
                potentialPitch: persona.potentialPitch || null,
              });
            }
          } catch (err) {
            console.error('Failed to generate initial persona:', err);
            // Soft fallback - just use contact data
            setInitialPersona({});
            setPersonaData({
              personName: contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'New Persona',
              title: contact.title || '',
              role: null,
              seniority: contact.seniority || null,
              industry: contact.companyIndustry || null,
              companySize: contact.companySize || null,
              company: contact.companyName || null,
              coreGoal: '',
              painPoints: [],
              needForOurProduct: '',
              potentialPitch: null,
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch contact:', err);
      } finally {
        setLoading(false);
        setGeneratingPhase1(false);
      }
    };

    fetchContactAndGenerateInitial();
  }, [contactId, companyHQId, companyLoading, phase]);

  // Phase 2: Deep dive on product fit
  const handleProductDeepDive = async () => {
    if (!productDescription.trim()) return;

    setGeneratingPhase2(true);

    try {
      const response = await api.post('/api/personas/generate', {
        companyHQId,
        contactId,
        productDescription: productDescription.trim(),
        // Use initial persona as context for deeper analysis
        description: initialPersona ? JSON.stringify({
          personName: personaData.personName,
          title: personaData.title,
          industry: personaData.industry,
          company: personaData.company,
        }) : null,
      });

      if (response.data?.success && response.data?.persona) {
        const deepPersona = response.data.persona;
        
        // Merge deep dive results (product-specific fields)
        setPersonaData((prev) => ({
          ...prev,
          coreGoal: deepPersona.coreGoal || prev.coreGoal || '',
          needForOurProduct: deepPersona.needForOurProduct || prev.needForOurProduct || '',
          potentialPitch: deepPersona.potentialPitch || prev.potentialPitch || null,
          painPoints: deepPersona.painPoints && Array.isArray(deepPersona.painPoints) && deepPersona.painPoints.length > 0
            ? deepPersona.painPoints
            : prev.painPoints || [],
        }));

        setPhase(3); // Move to review/edit phase
      }
    } catch (err) {
      console.error('Failed to generate product deep dive:', err);
      // Soft fallback - just move to review phase
      setPhase(3);
    } finally {
      setGeneratingPhase2(false);
    }
  };

  const handleFieldChange = (field, value) => {
    setPersonaData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleArrayFieldChange = (field, value) => {
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

    try {
      const painPointsArray = typeof personaData.painPoints === 'string'
        ? personaData.painPoints.split(/\n|,/).map(s => s.trim()).filter(Boolean)
        : (Array.isArray(personaData.painPoints) ? personaData.painPoints : []);

      const payload = {
        personName: personaData.personName || '',
        title: personaData.title || '',
        role: personaData.role || null,
        seniority: personaData.seniority || null,
        coreGoal: personaData.coreGoal || '',
        needForOurProduct: personaData.needForOurProduct || '',
        potentialPitch: personaData.potentialPitch || null,
        painPoints: painPointsArray,
        industry: personaData.industry || null,
        companySize: personaData.companySize || null,
        company: personaData.company || null,
      };

      const response = await api.post('/api/personas/save', {
        persona: payload,
        companyHQId,
      });

      if (response.data?.success) {
        router.push('/personas?saved=true');
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

  if (loading || generatingPhase1) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
            <p className="mt-4 text-gray-600">
              {generatingPhase1 ? 'Grabbing initial persona info from contact...' : 'Loading contact...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Phase 2: Product Deep Dive
  if (phase === 2) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <button
              onClick={() => setPhase(3)}
              className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Product Fit Deep Dive</h1>
            <p className="mt-2 text-gray-600">
              Now let's go deeper on how {personaData?.personName || 'this person'} fits your product
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-900">Describe Your Product</h2>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              Describe the product you think best fits this persona. We'll analyze how well they align.
            </p>

            <textarea
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              placeholder="e.g., A BD platform that helps consultants scale their practice by automating outreach, managing client relationships, and providing analytics to track growth. Perfect for solo consultants ready to grow their revenue without working more hours..."
              rows={6}
              className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
            />

            <div className="flex justify-end gap-4">
              <button
                onClick={() => setPhase(3)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Skip Deep Dive
              </button>
              <button
                onClick={handleProductDeepDive}
                disabled={generatingPhase2 || !productDescription.trim()}
                className="flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generatingPhase2 ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing Product Fit...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Analyze Product Fit
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Phase 3: Review & Edit
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
          <h1 className="text-3xl font-bold text-gray-900">Review & Edit Persona</h1>
          <p className="mt-2 text-gray-600">
            Review the generated persona and make any edits before saving
          </p>
        </div>

        {/* Phase 2 CTA if not done yet */}
        {phase === 1 && (
          <div className="mb-6 rounded-xl border-2 border-purple-200 bg-purple-50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Want to go deeper on product fit?
                </h3>
                <p className="text-sm text-gray-600">
                  We've grabbed the basics (title, company). Describe your product to analyze how well they align.
                </p>
              </div>
              <button
                onClick={() => setPhase(2)}
                className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700"
              >
                Go Deeper
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Persona Form */}
        <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
          {/* WHO IS THIS PERSON */}
          <div>
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Who is this person?</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Persona Name *
                </label>
                <input
                  type="text"
                  value={personaData.personName || ''}
                  onChange={(e) => handleFieldChange('personName', e.target.value)}
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
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Role (Additional context)
                </label>
                <input
                  type="text"
                  value={personaData.role || ''}
                  onChange={(e) => handleFieldChange('role', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Seniority</label>
                <input
                  type="text"
                  value={personaData.seniority || ''}
                  onChange={(e) => handleFieldChange('seniority', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>
          </div>

          {/* WHAT DO THEY WANT */}
          <div>
            <h3 className="mb-4 text-lg font-semibold text-gray-900">What do they want?</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Core Goal *
                </label>
                <p className="mb-2 text-xs text-gray-500">Their north star (regardless of our product)</p>
                <textarea
                  value={personaData.coreGoal || ''}
                  onChange={(e) => handleFieldChange('coreGoal', e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Need for Our Product *
                </label>
                <p className="mb-2 text-xs text-gray-500">What they need from OUR PRODUCT specifically</p>
                <textarea
                  value={personaData.needForOurProduct || ''}
                  onChange={(e) => handleFieldChange('needForOurProduct', e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Pain Points (one per line)
                </label>
                <textarea
                  value={Array.isArray(personaData.painPoints) ? personaData.painPoints.join('\n') : (personaData.painPoints || '')}
                  onChange={(e) => handleArrayFieldChange('painPoints', e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Enter pain points, one per line"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Potential Pitch
                </label>
                <textarea
                  value={personaData.potentialPitch || ''}
                  onChange={(e) => handleFieldChange('potentialPitch', e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>
          </div>

          {/* WHAT COMPANY ARE THEY AT */}
          <div>
            <h3 className="mb-4 text-lg font-semibold text-gray-900">What company are they at?</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Industry</label>
                <input
                  type="text"
                  value={personaData.industry || ''}
                  onChange={(e) => handleFieldChange('industry', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Company Size</label>
                <input
                  type="text"
                  value={personaData.companySize || ''}
                  onChange={(e) => handleFieldChange('companySize', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Company Type</label>
                <input
                  type="text"
                  value={personaData.company || ''}
                  onChange={(e) => handleFieldChange('company', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>
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
            disabled={saving || !personaData.personName || !personaData.title || !personaData.coreGoal || !personaData.needForOurProduct}
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
