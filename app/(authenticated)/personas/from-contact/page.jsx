'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save, Loader2, Package, Plus, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';

function FromContactContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contactId = searchParams?.get('contactId');

  const [contact, setContact] = useState(null);
  const [personaData, setPersonaData] = useState(null);
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [needsProduct, setNeedsProduct] = useState(false);
  const [showProductInput, setShowProductInput] = useState(false);
  
  // Use hook to get companyHQId (fetches from API if not in localStorage)
  const { companyHQId, loading: companyLoading, refresh } = useCompanyHQ();

  // Fetch companyHQId from API if not in localStorage
  useEffect(() => {
    if (!companyHQId && !companyLoading) {
      refresh();
    }
  }, [companyHQId, companyLoading, refresh]);

  // Load products
  useEffect(() => {
    if (!companyHQId) return;

    const loadProducts = async () => {
      try {
        const response = await api.get(`/api/products?companyHQId=${companyHQId}`);
        if (response.data && Array.isArray(response.data)) {
          setProducts(response.data);
          // Auto-select first product if only one exists
          if (response.data.length === 1) {
            setSelectedProductId(response.data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load products:', err);
      }
    };

    loadProducts();
  }, [companyHQId]);

  // Fetch contact
  useEffect(() => {
    if (!contactId || !companyHQId || companyLoading) return;

    const fetchContact = async () => {
      setLoading(true);
      try {
        const contactResponse = await api.get(`/api/contacts/${contactId}`);
        if (contactResponse.data?.success && contactResponse.data?.contact) {
          setContact(contactResponse.data.contact);
        }
      } catch (err) {
        console.error('Failed to fetch contact:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchContact();
  }, [contactId, companyHQId, companyLoading]);

  const handleGenerate = async () => {
    if (!companyHQId) return;

    // Check if we have product context
    if (!selectedProductId && !productDescription.trim()) {
      setNeedsProduct(true);
      setShowProductInput(true);
      return;
    }

    setGenerating(true);
    setNeedsProduct(false);

    try {
      const response = await api.post('/api/personas/generate', {
        companyHQId,
        contactId,
        productId: selectedProductId || null,
        productDescription: productDescription.trim() || null,
      });

      if (response.data?.success && response.data?.persona) {
        setPersonaData(response.data.persona);
        setShowProductInput(false);
      } else {
        // Soft fallback - show product input instead of error
        setNeedsProduct(true);
        setShowProductInput(true);
      }
    } catch (err) {
      console.error('Failed to generate persona:', err);
      // Soft fallback - show product input
      setNeedsProduct(true);
      setShowProductInput(true);
    } finally {
      setGenerating(false);
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
      // Normalize array fields
      const painPointsArray = typeof personaData.painPoints === 'string'
        ? personaData.painPoints.split(/\n|,/).map(s => s.trim()).filter(Boolean)
        : (Array.isArray(personaData.painPoints) ? personaData.painPoints : []);

      const payload = {
        personName: personaData.personName || '',
        title: personaData.title || '',
        role: personaData.role || null,
        seniority: personaData.seniority || null,
        coreGoal: personaData.coreGoal || personaData.description || '',
        needForOurProduct: personaData.needForOurProduct || personaData.whatTheyWant || '',
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
      // Soft error - just log, don't show error state
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
            <p className="mt-4 text-gray-600">Loading contact...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show product selection/input if no persona data yet
  if (!personaData) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <button
              onClick={() => router.back()}
              className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Generate Persona</h1>
            <p className="mt-2 text-gray-600">
              {contact?.fullName || contact?.firstName ? `Creating persona for ${contact.fullName || contact.firstName}` : 'Create a persona from this contact'}
            </p>
          </div>

          {/* Product Selection */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Product Context</h2>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              To generate a persona, we need to know which product you're targeting. Select a product or describe yours.
            </p>

            {/* Product Dropdown */}
            {products.length > 0 ? (
              <div className="mb-4">
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Select a Product
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    setProductDescription('');
                  }}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">Choose a product...</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="mb-3 text-sm text-blue-800">
                  <strong>No products yet.</strong> Create a product first, or describe your product below.
                </p>
                <button
                  onClick={() => router.push('/products/builder')}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Create Product
                </button>
              </div>
            )}

            {/* Product Description Input */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Or describe your product
              </label>
              <textarea
                value={productDescription}
                onChange={(e) => {
                  setProductDescription(e.target.value);
                  setSelectedProductId('');
                }}
                placeholder="e.g., A BD platform that helps consultants scale their practice by automating outreach and managing client relationships..."
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                disabled={!!selectedProductId}
              />
              {selectedProductId && (
                <p className="mt-1 text-xs text-gray-500">
                  Clear product selection above to use description instead
                </p>
              )}
            </div>

            {/* Generate Button */}
            <div className="flex justify-end gap-4">
              <button
                onClick={() => router.back()}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || (!selectedProductId && !productDescription.trim())}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
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
        </div>
      </div>
    );
  }

  // Show persona form if we have persona data
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

          {/* Core Goal */}
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

          {/* Need for Our Product */}
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

          {/* Pain Points */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Pain Points (one per line or comma-separated)
            </label>
            <textarea
              value={Array.isArray(personaData.painPoints) ? personaData.painPoints.join('\n') : (personaData.painPoints || '')}
              onChange={(e) => handleArrayFieldChange('painPoints', e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Enter pain points, one per line"
            />
          </div>

          {/* Potential Pitch */}
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
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
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
