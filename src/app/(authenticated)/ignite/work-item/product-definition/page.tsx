'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Package, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { WorkItemProductDefinitionForm } from '@/components/workitem/WorkItemProductDefinitionForm';
import { saveWorkItemProductDefinition, loadWorkItemProductDefinition, getWorkPackageItem } from '@/lib/actions/workItemProductDefinition';
import type { WorkItemProductDefinitionFormData } from '@/lib/schemas/workItemProductDefinitionSchema';

// Default values
const DEFAULT_VALUES: WorkItemProductDefinitionFormData = {
  name: '',
  category: '',
  valueProp: '',
  description: '',
  price: null,
  priceCurrency: 'USD',
  pricingModel: null,
  targetedTo: null,
  targetMarketSize: null,
  salesCycleLength: null,
  deliveryTimeline: '',
  features: '',
  competitiveAdvantages: '',
};

export default function ProductDefinitionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workPackageItemId = searchParams.get('workPackageItemId');

  const [isHydrating, setIsHydrating] = useState(Boolean(workPackageItemId));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [personas, setPersonas] = useState<Array<{ id: string; name: string }>>([]);
  const [workPackageItem, setWorkPackageItem] = useState<any>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<WorkItemProductDefinitionFormData>({
    defaultValues: DEFAULT_VALUES,
    mode: 'onBlur',
  });

  const productName = watch('name');

  // Fetch personas and work package item context
  useEffect(() => {
    if (!workPackageItemId) {
      setFetchError('WorkPackageItem ID is required');
      setIsHydrating(false);
      return;
    }

    const fetchData = async () => {
      try {
        setIsHydrating(true);
        setFetchError(null);

        // Get company context
        const companyHQId =
          typeof window !== 'undefined'
            ? window.localStorage.getItem('companyHQId') || window.localStorage.getItem('companyId') || ''
            : '';

        // Fetch personas
        if (companyHQId) {
          try {
            const personasResponse = await api.get(`/api/personas?companyHQId=${companyHQId}`);
            const personasData = Array.isArray(personasResponse.data) ? personasResponse.data : [];
            setPersonas(personasData);
          } catch (err) {
            console.warn('Failed to fetch personas:', err);
          }
        }

        // Fetch work package item context
        const itemResult = await getWorkPackageItem(workPackageItemId);
        if (itemResult.success && itemResult.item) {
          setWorkPackageItem(itemResult.item);
        }

        // Load saved product definition if it exists
        const loadResult = await loadWorkItemProductDefinition(workPackageItemId);
        if (loadResult.success && loadResult.data) {
          reset(loadResult.data);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setFetchError('Failed to load data');
      } finally {
        setIsHydrating(false);
      }
    };

    fetchData();
  }, [workPackageItemId, reset]);

  const handleShowToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 2000);
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!workPackageItemId) {
      setSubmitError('WorkPackageItem ID is required');
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const result = await saveWorkItemProductDefinition(workPackageItemId, values);

      if (!result.success) {
        setSubmitError(result.error || 'Failed to save product definition');
        return;
      }

      handleShowToast('Product definition saved successfully!');
      
      // Optionally navigate back after a delay
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (error) {
      console.error('Error saving product definition:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to save product definition');
    } finally {
      setIsSubmitting(false);
    }
  });

  const isBusy = isHydrating || isSubmitting;

  if (!workPackageItemId) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-sm font-semibold text-red-600">
              WorkPackageItem ID is required. Please navigate from a work item.
            </p>
          </div>
        </div>
      </div>
    );
  }

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
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => router.back()}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <Package className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Product Definition</h1>
            </div>
            <p className="text-sm text-gray-600">
              Define the product or service for this work item.
            </p>
            {workPackageItem && (
              <p className="mt-1 text-xs text-gray-500">
                Work Item: {workPackageItem.deliverableLabel || workPackageItem.itemLabel}
              </p>
            )}
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

          {isHydrating && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              Loading...
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-6">
            <WorkItemProductDefinitionForm
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
                {isSubmitting ? 'Saving…' : 'Save Product Definition'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
