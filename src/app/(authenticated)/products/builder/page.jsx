'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Package, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import { PRODUCT_CONFIG } from '@/lib/config/productConfig';
import { mapDatabaseToForm } from '@/lib/services/ProductServiceMapper';
import { ProductFormFields } from '@/components/forms/ProductFormFields';
import UniversalParserModal from '@/components/parsers/UniversalParserModal';

// Default values from config
const DEFAULT_VALUES = {
  name: '',
  valueProp: '',
  description: '',
  price: '',
  priceCurrency: PRODUCT_CONFIG.defaults.priceCurrency || 'USD',
  pricingModel: '',
  category: '',
  deliveryTimeline: '',
  targetMarketSize: '',
  salesCycleLength: '',
  features: '',
  competitiveAdvantages: '',
  targetedTo: '',
  companyId: '',
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
  const [isParserModalOpen, setIsParserModalOpen] = useState(false);

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
    
    if (derivedCompanyId && !hasInitialized) {
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

        // Use mapper to convert database record to form data
        const formData = mapDatabaseToForm(product);
        formData.companyId = product.companyHQId ?? derivedCompanyId ?? '';
        reset(formData);
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

  // Handle parser result application
  // Field Mapping Contract: Maps parsedResult to form fields according to strict rules
  const handleParserApply = (parsedResult: Record<string, any>, inputId?: string) => {
    // Log inputId for tracking
    if (inputId) {
      console.log('Parser result applied with inputId:', inputId);
    }

    // Field Mapping Contract Implementation
    // For each key in the Zod schema, apply mapping rules:
    
    // Rule: If parsed[key] === null → skip
    // Rule: If typeof parsed[key] === "number" → setValue(name, value.toString())
    // Rule: If Array.isArray(parsed[key]) → setValue(name, value)
    // Rule: If typeof parsed[key] === "string" → setValue(name, value.trim())
    // Rule: Unknown keys → ignore silently
    // Rule: Mapping must never break forms even if fields are missing

    if (parsedResult.name !== null && parsedResult.name !== undefined) {
      setValue('name', typeof parsedResult.name === 'string' ? parsedResult.name.trim() : String(parsedResult.name));
    }
    
    if (parsedResult.category !== null && parsedResult.category !== undefined) {
      setValue('category', typeof parsedResult.category === 'string' ? parsedResult.category.trim() : String(parsedResult.category));
    }
    
    if (parsedResult.valueProp !== null && parsedResult.valueProp !== undefined) {
      setValue('valueProp', typeof parsedResult.valueProp === 'string' ? parsedResult.valueProp.trim() : String(parsedResult.valueProp));
    }
    
    if (parsedResult.description !== null && parsedResult.description !== undefined) {
      setValue('description', typeof parsedResult.description === 'string' ? parsedResult.description.trim() : String(parsedResult.description));
    }
    
    if (parsedResult.price !== null && parsedResult.price !== undefined) {
      if (typeof parsedResult.price === 'number') {
        setValue('price', parsedResult.price.toString());
      } else {
        setValue('price', String(parsedResult.price));
      }
    }
    
    if (parsedResult.priceCurrency !== null && parsedResult.priceCurrency !== undefined) {
      setValue('priceCurrency', typeof parsedResult.priceCurrency === 'string' ? parsedResult.priceCurrency.trim() : String(parsedResult.priceCurrency));
    }
    
    if (parsedResult.pricingModel !== null && parsedResult.pricingModel !== undefined) {
      setValue('pricingModel', typeof parsedResult.pricingModel === 'string' ? parsedResult.pricingModel.trim() : String(parsedResult.pricingModel));
    }
    
    if (parsedResult.targetedTo !== null && parsedResult.targetedTo !== undefined) {
      setValue('targetedTo', typeof parsedResult.targetedTo === 'string' ? parsedResult.targetedTo.trim() : String(parsedResult.targetedTo));
    }
    
    if (parsedResult.targetMarketSize !== null && parsedResult.targetMarketSize !== undefined) {
      setValue('targetMarketSize', typeof parsedResult.targetMarketSize === 'string' ? parsedResult.targetMarketSize.trim() : String(parsedResult.targetMarketSize));
    }
    
    if (parsedResult.salesCycleLength !== null && parsedResult.salesCycleLength !== undefined) {
      setValue('salesCycleLength', typeof parsedResult.salesCycleLength === 'string' ? parsedResult.salesCycleLength.trim() : String(parsedResult.salesCycleLength));
    }
    
    if (parsedResult.deliveryTimeline !== null && parsedResult.deliveryTimeline !== undefined) {
      setValue('deliveryTimeline', typeof parsedResult.deliveryTimeline === 'string' ? parsedResult.deliveryTimeline.trim() : String(parsedResult.deliveryTimeline));
    }
    
    if (parsedResult.features !== null && parsedResult.features !== undefined) {
      if (Array.isArray(parsedResult.features)) {
        setValue('features', parsedResult.features);
      } else {
        setValue('features', typeof parsedResult.features === 'string' ? parsedResult.features.trim() : String(parsedResult.features));
      }
    }
    
    if (parsedResult.competitiveAdvantages !== null && parsedResult.competitiveAdvantages !== undefined) {
      if (Array.isArray(parsedResult.competitiveAdvantages)) {
        setValue('competitiveAdvantages', parsedResult.competitiveAdvantages);
      } else {
        setValue('competitiveAdvantages', typeof parsedResult.competitiveAdvantages === 'string' ? parsedResult.competitiveAdvantages.trim() : String(parsedResult.competitiveAdvantages));
      }
    }

    handleShowToast('Parsed data applied to form!');
  };

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

          {/* AI Parser Button */}
          <div className="mb-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsParserModalOpen(true)}
                disabled={isBusy || !derivedCompanyId}
                className="flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Sparkles className="h-4 w-4" />
                Build with AI
              </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            <input
              type="hidden"
              defaultValue={derivedCompanyId}
              {...register('companyId', { required: true })}
            />

            {/* Config-driven form fields */}
            <ProductFormFields
              register={register}
              errors={errors}
              isBusy={isBusy}
              personas={personas}
            />

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

      {/* AI Parser Modal */}
      {derivedCompanyId && (
        <UniversalParserModal
          isOpen={isParserModalOpen}
          onClose={() => setIsParserModalOpen(false)}
          onApply={handleParserApply}
          defaultType="product_definition"
          companyHqId={derivedCompanyId}
        />
      )}
    </div>
  );
}

