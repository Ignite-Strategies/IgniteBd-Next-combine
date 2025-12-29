'use client';

import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles, RefreshCw, AlertCircle, Save } from 'lucide-react';
import api from '@/lib/api';
import PageHeader from '@/components/PageHeader.jsx';

const DEFAULT_VALUES = {
  personName: '',
  title: '',
  role: '',
  seniority: '',
  coreGoal: '',
  painPoints: '',
  needForOurProduct: '',
  potentialPitch: '',
  industry: '',
  companySize: '',
  company: '',
};

function PersonaBuilderContent({ searchParams }) {
  const router = useRouter();
  const urlSearchParams = useSearchParams();
  const personaId = searchParams?.personaId || urlSearchParams?.get('personaId') || null;
  const contactId = searchParams?.contactId || urlSearchParams?.get('contactId') || null;
  const redisKey = searchParams?.redisKey || urlSearchParams?.get('redisKey') || null;
  const productId = searchParams?.productId || urlSearchParams?.get('productId') || null;
  const mode = searchParams?.mode || urlSearchParams?.get('mode') || null;

  const [formData, setFormData] = useState(DEFAULT_VALUES);
  const [companyHQId, setCompanyHQId] = useState('');
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(productId || '');
  const [productDescription, setProductDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Load companyHQId and products
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedCompanyHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedCompanyHQId);

    if (storedCompanyHQId) {
      // Load products for dropdown
      loadProducts(storedCompanyHQId);
    }
  }, []);

  const loadProducts = async (companyHQId) => {
    try {
      const response = await api.get(`/api/products?companyHQId=${companyHQId}`);
      if (response.data && Array.isArray(response.data)) {
        setProducts(response.data);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  // Load existing persona if editing
  useEffect(() => {
    if (!personaId) return;

    const loadPersona = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get(`/api/personas/${personaId}`);
        const persona = response.data;

        if (!persona) {
          setError('Persona not found');
          return;
        }

        setFormData({
          personName: persona.personName || '',
          title: persona.title || '',
          role: persona.role || '',
          seniority: persona.seniority || '',
          coreGoal: persona.coreGoal || '',
          painPoints: Array.isArray(persona.painPoints)
            ? persona.painPoints.join('\n')
            : persona.painPoints || '',
          needForOurProduct: persona.needForOurProduct || persona.whatTheyWant || '',
          potentialPitch: persona.potentialPitch || '',
          industry: persona.industry || '',
          companySize: persona.companySize || '',
          company: persona.company || '',
        });
      } catch (err) {
        console.error('Failed to load persona:', err);
        setError(err.response?.data?.error || 'Failed to load persona');
      } finally {
        setLoading(false);
      }
    };

    loadPersona();
  }, [personaId]);

  // Generate persona (hydrate mode)
  const handleGenerate = async () => {
    if (!companyHQId) {
      setError('Company context is required');
      return;
    }

    if (!selectedProductId && !productDescription.trim()) {
      setError('Please select a product or enter a product description');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const response = await api.post('/api/personas/generate', {
        companyHQId,
        contactId: contactId || null,
        redisKey: redisKey || null,
        productId: selectedProductId || null,
        productDescription: productDescription.trim() || null,
      });

      if (response.data?.success && response.data?.persona) {
        const persona = response.data.persona;
        setFormData({
          personName: persona.personName || '',
          title: persona.title || '',
          role: persona.role || '',
          seniority: persona.seniority || '',
          coreGoal: persona.coreGoal || '',
          painPoints: Array.isArray(persona.painPoints)
            ? persona.painPoints.join('\n')
            : persona.painPoints || '',
          needForOurProduct: persona.needForOurProduct || '',
          potentialPitch: persona.potentialPitch || '',
          industry: persona.industry || '',
          companySize: persona.companySize || '',
          company: persona.company || '',
        });
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        throw new Error(response.data?.error || 'Failed to generate persona');
      }
    } catch (err) {
      console.error('Failed to generate persona:', err);
      setError(err.response?.data?.error || err.message || 'Failed to generate persona');
    } finally {
      setGenerating(false);
    }
  };

  // Save persona
  const handleSave = async () => {
    if (!companyHQId) {
      setError('Company context is required');
      return;
    }

    if (!formData.personName.trim() || !formData.title.trim()) {
      setError('Person Name and Title are required');
      return;
    }

    if (!formData.coreGoal.trim() || !formData.needForOurProduct.trim()) {
      setError('Core Goal and Need for Our Product are required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Convert painPoints string to array
      const painPointsArray = formData.painPoints
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean);

      const personaData = {
        personName: formData.personName.trim(),
        title: formData.title.trim(),
        role: formData.role.trim() || null,
        seniority: formData.seniority.trim() || null,
        coreGoal: formData.coreGoal.trim(),
        painPoints: painPointsArray,
        needForOurProduct: formData.needForOurProduct.trim(),
        potentialPitch: formData.potentialPitch.trim() || null,
        industry: formData.industry.trim() || null,
        companySize: formData.companySize.trim() || null,
        company: formData.company.trim() || null,
      };

      const response = await api.post('/api/personas/save', {
        persona: personaData,
        personaId: personaId || null,
        companyHQId,
      });

      if (response.data?.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/personas');
        }, 1000);
      } else {
        throw new Error(response.data?.error || 'Failed to save persona');
      }
    } catch (err) {
      console.error('Failed to save persona:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save persona');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-500 mb-4" />
            <p className="text-sm font-semibold text-gray-600">Loading persona...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title={personaId ? 'Edit Persona' : 'Create Persona'}
          subtitle="Help you think through who you're targeting"
          backTo="/personas"
          backLabel="Back to Personas"
        />

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {personaId ? 'Persona updated!' : 'Persona generated! Review and edit as needed, then save.'}
          </div>
        )}

        {/* Generate Section (only show if not editing) */}
        {!personaId && (
          <div className="mb-6 rounded-xl border-2 border-purple-200 bg-purple-50 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <h2 className="text-lg font-bold text-gray-900">Generate with AI</h2>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              Provide product context and optionally a contact/enrichment to generate a persona.
            </p>

            <div className="space-y-4">
              {/* Product Selection */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Product (Required for generation)
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                  disabled={generating}
                >
                  <option value="">Select a product...</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Description Fallback */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Or enter product description
                </label>
                <textarea
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="e.g., A BD platform that helps consultants scale their practice..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                  disabled={generating || !!selectedProductId}
                />
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || (!selectedProductId && !productDescription.trim())}
                className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {generating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Persona
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Form Fields */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="space-y-6">
            {/* WHO IS THIS PERSON */}
            <div>
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Who is this person?</h3>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Person Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.personName}
                    onChange={(e) => handleInputChange('personName', e.target.value)}
                    placeholder="e.g., Enterprise CMO"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="e.g., Chief Marketing Officer"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Role (Additional context)
                  </label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => handleInputChange('role', e.target.value)}
                    placeholder="Additional role context beyond title"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Seniority</label>
                  <input
                    type="text"
                    value={formData.seniority}
                    onChange={(e) => handleInputChange('seniority', e.target.value)}
                    placeholder="e.g., C-Level, Director"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    disabled={saving}
                  />
                </div>
              </div>
            </div>

            {/* WHAT DO THEY WANT */}
            <div>
              <h3 className="mb-4 text-lg font-semibold text-gray-900">What do they want?</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Core Goal <span className="text-red-500">*</span>
                  </label>
                  <p className="mb-2 text-xs text-gray-500">
                    Their north star (regardless of our product)
                  </p>
                  <textarea
                    value={formData.coreGoal}
                    onChange={(e) => handleInputChange('coreGoal', e.target.value)}
                    placeholder="What they want in general..."
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Pain Points</label>
                  <textarea
                    value={formData.painPoints}
                    onChange={(e) => handleInputChange('painPoints', e.target.value)}
                    placeholder="One per line - What problems do they have?"
                    rows={4}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Need for Our Product <span className="text-red-500">*</span>
                  </label>
                  <p className="mb-2 text-xs text-gray-500">
                    What they need from OUR PRODUCT specifically (key field!)
                  </p>
                  <textarea
                    value={formData.needForOurProduct}
                    onChange={(e) => handleInputChange('needForOurProduct', e.target.value)}
                    placeholder="What do they need from our product?"
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Potential Pitch
                  </label>
                  <p className="mb-2 text-xs text-gray-500">
                    How we would pitch to them (inferred from pain + needs)
                  </p>
                  <textarea
                    value={formData.potentialPitch}
                    onChange={(e) => handleInputChange('potentialPitch', e.target.value)}
                    placeholder="How we'd pitch to them..."
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    disabled={saving}
                  />
                </div>
              </div>
            </div>

            {/* WHAT COMPANY ARE THEY AT */}
            <div>
              <h3 className="mb-4 text-lg font-semibold text-gray-900">What company are they at?</h3>
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Industry</label>
                  <input
                    type="text"
                    value={formData.industry}
                    onChange={(e) => handleInputChange('industry', e.target.value)}
                    placeholder="Industry type"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Company Size</label>
                  <input
                    type="text"
                    value={formData.companySize}
                    onChange={(e) => handleInputChange('companySize', e.target.value)}
                    placeholder="e.g., 51-200, 200-1000"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Company Type</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => handleInputChange('company', e.target.value)}
                    placeholder="e.g., mid-market SaaS"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    disabled={saving}
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end gap-4 border-t border-gray-100 pt-6">
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-lg bg-gray-100 px-6 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-200 disabled:opacity-60"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={
                  saving ||
                  !formData.personName.trim() ||
                  !formData.title.trim() ||
                  !formData.coreGoal.trim() ||
                  !formData.needForOurProduct.trim()
                }
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
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
      </div>
    </div>
  );
}

export default function PersonaBuilderPage({ searchParams }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="mx-auto max-w-4xl px-4">
            <div className="rounded-2xl bg-white p-8 text-center shadow">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-500 mb-4" />
              <p className="text-sm font-semibold text-gray-600">Loading...</p>
            </div>
          </div>
        </div>
      }
    >
      <PersonaBuilderContent searchParams={searchParams} />
    </Suspense>
  );
}
