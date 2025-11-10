'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Package } from 'lucide-react';
import api from '@/lib/api';

const DEFAULT_VALUES = {
  name: '',
  valueProp: '',
  description: '',
  price: '',
  priceCurrency: 'USD',
  targetedTo: '',
  companyId: '',
};

// Prefilled template for business development platform
const BD_PLATFORM_TEMPLATE = {
  name: 'Business Development Platform',
  valueProp: 'Provide a platform for business development growth.',
  description: '',
  price: '',
  priceCurrency: 'USD',
  targetedTo: '',
};

export default function ProductBuilderPage({ searchParams }) {
  const router = useRouter();
  const productId = searchParams?.productId || null;

  const [isHydrating, setIsHydrating] = useState(Boolean(productId));
  const [fetchError, setFetchError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimerRef = useRef(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [personas, setPersonas] = useState([]);

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
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: DEFAULT_VALUES,
    mode: 'onBlur',
  });

  // Watch productName to enable/disable save button
  const productName = watch('name');

  useEffect(() => () => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
  }, []);

  // Pre-fill form with test data when creating a new product (not editing)
  // Also fetch personas for dropdown
  useEffect(() => {
    if (!derivedCompanyId) return;
    
    // Fetch personas for "Targeted To" dropdown
    const fetchPersonas = async () => {
      try {
        const response = await api.get(`/api/personas?companyHQId=${derivedCompanyId}`);
        const personasData = Array.isArray(response.data) ? response.data : [];
        setPersonas(personasData);
      } catch (err) {
        console.warn('Failed to fetch personas:', err);
      }
    };
    
    if (!productId && derivedCompanyId && !hasInitialized) {
      // Pre-fill with template for testing upsert logic
      reset({
        ...BD_PLATFORM_TEMPLATE,
        companyId: derivedCompanyId,
      });
      setHasInitialized(true);
      fetchPersonas();
    } else if (derivedCompanyId && !hasInitialized) {
      setValue('companyId', derivedCompanyId);
      setHasInitialized(true);
      fetchPersonas();
    }
  }, [derivedCompanyId, productId, setValue, reset, hasInitialized]);

  // Fetch product data if editing
  useEffect(() => {
    if (!productId) {
      setIsHydrating(false);
      return;
    }

    let isMounted = true;
    setIsHydrating(true);
    setFetchError(null);

    (async () => {
      try {
        // Fetch single product by ID
        const response = await api.get(`/api/products/${productId}?companyHQId=${derivedCompanyId}`);
        const product = response.data?.product;

        if (!isMounted) return;

        if (!product) {
          setFetchError('Product not found.');
          return;
        }

        reset({
          name: product.name ?? '',
          valueProp: product.valueProp ?? '',
          description: product.description ?? '',
          price: product.price?.toString() ?? '',
          priceCurrency: product.priceCurrency ?? 'USD',
          targetedTo: product.targetedTo ?? '',
          companyId: product.companyHQId ?? derivedCompanyId ?? '',
        });
        setHasInitialized(true);
        
        // Also fetch personas for dropdown
        try {
          const personasResponse = await api.get(`/api/personas?companyHQId=${derivedCompanyId}`);
          const personasData = Array.isArray(personasResponse.data) ? personasResponse.data : [];
          setPersonas(personasData);
        } catch (err) {
          console.warn('Failed to fetch personas:', err);
        }
      } catch (error) {
        if (!isMounted) return;
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to load product.';
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
  }, [productId, reset, derivedCompanyId]);

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
      setSubmitError('Company context is required to save a product.');
      return;
    }

    try {
      if (productId) {
        // Update existing product
        const response = await api.put(`/api/products/${productId}`, {
          name: values.name,
          valueProp: values.valueProp || null,
          description: values.description || null,
          price: values.price ? parseFloat(values.price) : null,
          priceCurrency: values.priceCurrency || null,
          targetedTo: values.targetedTo || null,
          companyHQId: values.companyId,
        });

        const savedProduct = response.data?.product;
        if (!savedProduct) {
          throw new Error('Product update response was missing data.');
        }

        handleShowToast('Product updated.', () => {
          router.push('/products');
        });
      } else {
        // Create new product
        const response = await api.post('/api/products', {
          name: values.name,
          valueProp: values.valueProp || null,
          description: values.description || null,
          price: values.price ? parseFloat(values.price) : null,
          priceCurrency: values.priceCurrency || null,
          targetedTo: values.targetedTo || null,
          companyHQId: values.companyId,
        });

        const savedProduct = response.data;
        if (!savedProduct) {
          throw new Error('Product save response was missing data.');
        }

        handleShowToast('Product saved.', () => {
          router.push('/products');
        });
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'We could not save the product. Please try again.';
      setSubmitError(message);
    }
  });

  const isBusy = isHydrating || isSubmitting;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {toastMessage && (
          <div className="fixed inset-x-0 top-6 z-50 flex justify-center px-4">
            <div className="rounded-lg bg-green-600 px-4 py-2 text-white shadow-lg">
              {toastMessage}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Package className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">
                {productId ? 'Edit Product/Service' : 'Create Product/Service'}
              </h1>
            </div>
            <p className="text-sm text-gray-600">
              Define your product or service value proposition to power BD Intelligence scoring.
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

          {/* Template Helper - Only show when creating new product */}
          {!productId && (
            <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="mb-3 text-sm text-gray-600">
                Form is pre-filled with template data. Edit as needed.
              </p>
              <button
                type="button"
                onClick={() => {
                  reset({
                    ...BD_PLATFORM_TEMPLATE,
                    companyId: derivedCompanyId,
                  });
                  handleShowToast('Template reloaded!');
                }}
                disabled={isBusy}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-60"
              >
                Reload Template
              </button>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-6">
            <input
              type="hidden"
              defaultValue={derivedCompanyId}
              {...register('companyId', { required: true })}
            />

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Product/Service Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., Business Development Platform, Ignite CRM Automation"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                disabled={isBusy}
                {...register('name', {
                  required: 'Product/Service name is required.',
                })}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.name.message}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                A clear, concise name for your product or service
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Value Proposition
              </label>
              <textarea
                rows={4}
                placeholder="What specific outcome or benefit does this product deliver? e.g., Turn follow-ups into closed deals automatically."
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                disabled={isBusy}
                {...register('valueProp')}
              />
              <p className="mt-1 text-xs text-gray-500">
                This is used by BD Intelligence to calculate fit scores with contacts
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Description
              </label>
              <textarea
                rows={3}
                placeholder="Optional: Additional details about the product experience, features, or use cases."
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                disabled={isBusy}
                {...register('description')}
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Price
                </label>
                <div className="flex gap-2">
                  <select
                    className="rounded-lg border border-gray-300 px-3 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    disabled={isBusy}
                    {...register('priceCurrency')}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD ($)</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    disabled={isBusy}
                    {...register('price')}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Optional: Product/service price for BD Intelligence scoring
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Targeted To
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  disabled={isBusy}
                  {...register('targetedTo')}
                >
                  <option value="">Select a persona (optional)</option>
                  {personas.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.name || 'Unnamed Persona'}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Optional: Which persona is this product targeted to?
                </p>
              </div>
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
                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed"
                disabled={isBusy || !productName?.trim()}
              >
                {isSubmitting ? 'Saving…' : 'Save Product/Service'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

