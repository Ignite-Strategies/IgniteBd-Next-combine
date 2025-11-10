'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import api from '@/lib/api';

const DEFAULT_VALUES = {
  personaName: '',
  role: '',
  painPoints: '',
  goals: '',
  whatTheyWant: '',
  companyId: '',
};

// Prefilled template for "Solo Biz Owner" persona
const SOLO_BIZ_OWNER_TEMPLATE = {
  personaName: 'Solo Biz Owner',
  role: 'Sole Proprietor',
  painPoints: `- Wears all hats (operations, sales, marketing, delivery)
- No time for business development
- Can't scale because they're doing everything
- Revenue plateaus because they're maxed out on delivery
- Knows they need help but doesn't know where to start
- Struggles to find time for strategic planning`,
  goals: `- Grow revenue without working more hours
- Systematize operations to free up time
- Build a sustainable business that doesn't depend solely on them
- Create systems that can run without constant oversight
- Scale to the next level (hire first employee or contractor)`,
  whatTheyWant: `A business development system that works while they focus on delivery. They need someone to handle outreach, relationship building, and pipeline management so they can focus on what they do best - delivering value to clients. They want predictable revenue growth without having to become a sales expert themselves.`,
};

export default function PersonaBuilderPage({ searchParams }) {
  const router = useRouter();
  const personaId = searchParams?.personaId || null;

  const [isHydrating, setIsHydrating] = useState(Boolean(personaId));
  const [fetchError, setFetchError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimerRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPersona, setGeneratedPersona] = useState(null);
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');

  const derivedCompanyId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return (
      window.localStorage.getItem('companyId') ||
      window.localStorage.getItem('companyHQId') ||
      ''
    );
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues: DEFAULT_VALUES,
    mode: 'onBlur',
  });

  useEffect(() => () => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (derivedCompanyId) {
      setValue('companyId', derivedCompanyId);
      // Fetch products for this company
      fetchProducts(derivedCompanyId);
    }
  }, [derivedCompanyId, setValue]);

  const fetchProducts = async (companyHQId) => {
    try {
      const response = await api.get(`/api/products?companyHQId=${companyHQId}`);
      const productsData = Array.isArray(response.data) ? response.data : [];
      setProducts(productsData);
    } catch (error) {
      console.warn('Failed to fetch products:', error);
      setProducts([]);
    }
  };

  const handleGeneratePersona = async () => {
    if (!derivedCompanyId) {
      setSubmitError('Company context is required to generate a persona.');
      return;
    }

    setIsGenerating(true);
    setGeneratedPersona(null);
    setSubmitError(null);

    try {
      const response = await api.post('/api/personas/generate', {
        companyHQId: derivedCompanyId,
        productId: selectedProductId || null,
      });

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Failed to generate persona');
      }

      const generated = response.data.persona;
      setGeneratedPersona(generated);

      // Map generated persona to form fields
      reset({
        personaName: generated.persona_name || '',
        role: generated.ideal_roles?.join(', ') || '',
        painPoints: generated.pain_points?.join('\n') || '',
        goals: generated.core_goals?.join('\n') || '',
        whatTheyWant: generated.value_prop || '',
        companyId: derivedCompanyId,
      });

      handleShowToast('Persona generated! Review and edit as needed.');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to generate persona. Please try again.';
      setSubmitError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (!personaId) {
      setIsHydrating(false);
      return;
    }

    let isMounted = true;
    setIsHydrating(true);
    setFetchError(null);

    (async () => {
      try {
        const response = await api.get(`/api/personas/${personaId}`);
        const persona = response.data?.persona ?? null;

        if (!isMounted) return;

        if (!persona) {
          setFetchError('Persona not found.');
          return;
        }

        reset({
          personaName: persona.name ?? '',
          role: persona.role ?? '',
          painPoints: persona.painPoints ?? '',
          goals: persona.goals ?? '',
          whatTheyWant: persona.valuePropToPersona ?? '',
          companyId: persona.companyHQId ?? derivedCompanyId ?? '',
        });
      } catch (error) {
        if (!isMounted) return;
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to load persona.';
        setFetchError(message);
      } finally {
        if (isMounted) {
          setIsHydrating(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [personaId, reset, derivedCompanyId]);

  const handleShowToast = (message, callback) => {
    setToastMessage(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      if (callback) callback();
    }, 1200);
  };

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    if (!values.companyId) {
      setSubmitError('Company context is required to save a persona.');
      return;
    }

    try {
      const response = await api.post('/api/personas', {
        id: personaId,
        name: values.personaName,
        role: values.role,
        painPoints: values.painPoints,
        goals: values.goals,
        valuePropToPersona: values.whatTheyWant,
        companyHQId: values.companyId,
        productId: selectedProductId || null,
      });

      const savedPersona = response.data?.persona;
      if (!savedPersona) {
        throw new Error('Persona save response was missing data.');
      }

      handleShowToast('Persona saved.', () => {
        router.push('/persona');
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'We could not save the persona. Please try again.';
      setSubmitError(message);
    }
  });

  const isBusy = isHydrating || isSubmitting || isGenerating;

  return (
    <div className="relative mx-auto max-w-3xl space-y-6 p-6">
      {toastMessage && (
        <div className="fixed inset-x-0 top-6 z-50 flex justify-center px-4">
          <div className="rounded-lg bg-green-600 px-4 py-2 text-white shadow-lg">
            {toastMessage}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            {personaId ? 'Edit Persona' : 'Create Persona'}
          </h1>
          <p className="text-sm text-gray-600">
            Keep the details aligned with your activation strategy and
            messaging.
          </p>
        </div>

        {fetchError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {fetchError}
          </div>
        )}

        {submitError && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {submitError}
          </div>
        )}

        {/* Generate Persona Section */}
        {!personaId && (
          <div className="mb-6 rounded-xl border-2 border-blue-200 bg-blue-50 p-6">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              🤖 Generate Persona with AI
            </h2>
            <p className="mb-4 text-sm text-gray-600">
              Let AI create a persona based on your company and product information.
            </p>
            <div className="mb-4">
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Product (Optional)
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                disabled={isGenerating}
              >
                <option value="">General Company Persona</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleGeneratePersona}
                disabled={isGenerating || isBusy}
                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-70"
              >
                {isGenerating ? 'Generating...' : 'Generate Persona'}
              </button>
              <button
                type="button"
                onClick={() => {
                  reset({
                    ...SOLO_BIZ_OWNER_TEMPLATE,
                    companyId: derivedCompanyId,
                  });
                  handleShowToast('Solo Biz Owner template loaded!');
                }}
                disabled={isBusy}
                className="rounded-lg border-2 border-gray-300 bg-white px-6 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-400 hover:bg-gray-50 disabled:opacity-70"
              >
                Use Solo Biz Owner Template
              </button>
            </div>
            {generatedPersona && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="mb-2 text-sm font-semibold text-gray-900">
                  Generated Persona Preview:
                </h3>
                <pre className="max-h-60 overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-700">
                  {JSON.stringify(generatedPersona, null, 2)}
                </pre>
                {generatedPersona.impact_statement && (
                  <p className="mt-3 text-sm italic text-gray-600">
                    "{generatedPersona.impact_statement}"
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-6">
          <input
            type="hidden"
            defaultValue={derivedCompanyId}
            {...register('companyId', { required: true })}
          />

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Persona Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., Sarah the Scaling COO"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200"
                disabled={isBusy}
                {...register('personaName', {
                  required: 'Persona name is required.',
                })}
              />
              {errors.personaName && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.personaName.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Role
              </label>
              <input
                type="text"
                placeholder="e.g., COO, Head of Growth"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200"
                disabled={isBusy}
                {...register('role')}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Pain Points
            </label>
            <textarea
              rows={4}
              placeholder="Where are they feeling friction? What slows them down?"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200"
              disabled={isBusy}
              {...register('painPoints')}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Goals
            </label>
            <textarea
              rows={4}
              placeholder="What outcomes do they care about most?"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200"
              disabled={isBusy}
              {...register('goals')}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              What They Want From Us
            </label>
            <textarea
              rows={4}
              placeholder="What are they hoping Ignite will help them achieve or solve?"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200"
              disabled={isBusy}
              {...register('whatTheyWant')}
            />
          </div>

          <div className="flex justify-end gap-4 border-t border-gray-100 pt-6">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg bg-gray-100 px-6 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-200 disabled:opacity-60"
              disabled={isBusy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-green-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-70"
              disabled={isBusy || (!isDirty && !personaId)}
            >
              {isSubmitting ? 'Saving…' : 'Save Persona'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

