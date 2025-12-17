'use client';

import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import EnrichmentModal from '@/components/enrichment/EnrichmentModal';

const DEFAULT_VALUES = {
  personaName: '',
  role: '',
  description: '',
  painPoints: '',
  goals: '',
  whatTheyWant: '',
  companyId: '',
};

function PersonaBuilderContent({ searchParams }) {
  const router = useRouter();
  const urlSearchParams = useSearchParams();
  const personaId = searchParams?.personaId || urlSearchParams?.get('personaId') || null;
  const mode = searchParams?.mode || urlSearchParams?.get('mode') || null;
  const enrichedKey = searchParams?.enrichedKey || urlSearchParams?.get('enrichedKey') || null;
  const contactId = searchParams?.contactId || urlSearchParams?.get('contactId') || null;

  const [isHydrating, setIsHydrating] = useState(Boolean(personaId));
  const [fetchError, setFetchError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimerRef = useRef(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // AI generation state
  const [showAIGeneration, setShowAIGeneration] = useState(mode === 'ai');
  const [aiDescription, setAiDescription] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState(null);

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

  // Watch personaName to enable/disable save button
  const personaName = watch('personaName');

  useEffect(() => () => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
  }, []);

  // Initialize companyId and handle prefill/enrichedKey/contactId
  useEffect(() => {
    if (!hasInitialized && !personaId) {
      // Handle contactId from enrichment flow
      if (contactId && derivedCompanyId) {
        setIsHydrating(true);
        (async () => {
          try {
            const contactResponse = await api.get(`/api/contacts/${contactId}`);
            if (contactResponse.data?.success && contactResponse.data?.contact) {
              const contact = contactResponse.data.contact;
              
              // Build description with profile summary and LinkedIn URL if available
              let description = contact.profileSummary || '';
              if (contact.linkedinUrl) {
                if (description) {
                  description += `\n\nLinkedIn: ${contact.linkedinUrl}`;
                } else {
                  description = `LinkedIn: ${contact.linkedinUrl}`;
                }
              }
              
              reset({
                personaName: contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'New Persona',
                role: contact.title || '',
                description: description,
                painPoints: Array.isArray(contact.painPoints) ? contact.painPoints.join('\n') : (contact.painPoints || ''),
                goals: Array.isArray(contact.goals) ? contact.goals.join('\n') : (contact.goals || ''),
                whatTheyWant: contact.notes || '',
                companyId: derivedCompanyId,
              });
              handleShowToast('Persona pre-filled from enriched contact!');
            }
          } catch (err) {
            console.error('Failed to load contact for persona:', err);
            setFetchError('Failed to load contact data');
          } finally {
            setIsHydrating(false);
            setHasInitialized(true);
          }
        })();
        return;
      }

      // Handle enrichedKey from enrichment flow
      if (enrichedKey && derivedCompanyId) {
        setIsHydrating(true);
        (async () => {
          try {
            const response = await api.post('/api/personas/generate', {
              redisKey: enrichedKey,
              companyHQId: derivedCompanyId,
            });
            
            if (response.data?.success && response.data?.persona) {
              const personaData = response.data.persona;
              reset({
                personaName: personaData.personName || '',
                role: personaData.title || '',
                painPoints: Array.isArray(personaData.painPoints) 
                  ? personaData.painPoints.join('\n')
                  : (personaData.painPoints || ''),
                goals: Array.isArray(personaData.goals)
                  ? personaData.goals.join('\n')
                  : (personaData.goals || ''),
                whatTheyWant: personaData.whatTheyWant || '',
                companyId: derivedCompanyId,
              });
              handleShowToast('Persona generated from enrichment!');
            }
          } catch (err) {
            console.error('Failed to generate persona from enrichment:', err);
            setFetchError('Failed to generate persona from enriched data');
          } finally {
            setIsHydrating(false);
            setHasInitialized(true);
          }
        })();
        return;
      }

      // Check for prefill data from AI generation
      if (typeof window !== 'undefined') {
        const prefill = sessionStorage.getItem('personaPrefill');
        if (prefill) {
          try {
            const personaData = JSON.parse(prefill);
            // Map AI-generated persona to form fields
            reset({
              personaName: personaData.personName || personaData.name || '',
              role: personaData.title || personaData.role || '',
              description: personaData.description || '',
              painPoints: Array.isArray(personaData.painPoints) 
                ? personaData.painPoints.join('\n')
                : (personaData.painPoints || ''),
              goals: Array.isArray(personaData.goals)
                ? personaData.goals.join('\n')
                : (personaData.goals || ''),
              whatTheyWant: personaData.whatTheyWant || personaData.valueProp || '',
              companyId: derivedCompanyId || '',
            });
            sessionStorage.removeItem('personaPrefill');
            setHasInitialized(true);
            return;
          } catch (err) {
            console.warn('Failed to parse prefill data:', err);
          }
        }
      }
      
      // No prefill - just set companyId
      if (derivedCompanyId) {
        setValue('companyId', derivedCompanyId);
        setHasInitialized(true);
      }
    }
  }, [derivedCompanyId, personaId, enrichedKey, setValue, reset, hasInitialized]);

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
          role: persona.role ?? persona.title ?? '',
          description: persona.description ?? '',
          painPoints: persona.painPoints ?? '',
          goals: persona.goals ?? '',
          whatTheyWant: persona.valuePropToPersona ?? persona.whatTheyWant ?? '',
          companyId: persona.companyHQId ?? derivedCompanyId ?? '',
        });
        setHasInitialized(true);
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

  const handleAIGenerate = async () => {
    if (!aiDescription.trim()) {
      setAiError('Please enter a description');
      return;
    }

    if (!derivedCompanyId) {
      setAiError('Company context is required');
      return;
    }

    setAiGenerating(true);
    setAiError(null);

    try {
      const response = await api.post('/api/personas/generate-from-description', {
        description: aiDescription.trim(),
        companyHQId: derivedCompanyId,
      });

      if (response.data?.success && response.data?.persona) {
        const personaData = response.data.persona;
        // Pre-fill form with generated data
        reset({
          personaName: personaData.personName || personaData.name || '',
          role: personaData.title || personaData.role || '',
          description: personaData.description || '',
          painPoints: Array.isArray(personaData.painPoints) 
            ? personaData.painPoints.join('\n')
            : (personaData.painPoints || ''),
          goals: Array.isArray(personaData.goals)
            ? personaData.goals.join('\n')
            : (personaData.goals || ''),
          whatTheyWant: personaData.whatTheyWant || personaData.valueProp || '',
          companyId: derivedCompanyId || '',
        });
        setShowAIGeneration(false);
        handleShowToast('Persona generated! Review and edit as needed.');
      } else {
        throw new Error(response.data?.error || 'Failed to generate persona');
      }
    } catch (err) {
      console.error('Failed to generate persona:', err);
      setAiError(err.response?.data?.error || err.message || 'Failed to generate persona. Please try again.');
    } finally {
      setAiGenerating(false);
    }
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
        title: values.role,
        description: values.description,
        painPoints: values.painPoints,
        goals: values.goals,
        whatTheyWant: values.whatTheyWant,
        companyHQId: values.companyId,
      });

      const savedPersona = response.data?.persona;
      if (!savedPersona) {
        throw new Error('Persona save response was missing data.');
      }

      // Immediately save to localStorage (hydration pattern)
      if (typeof window !== 'undefined') {
        const cached = window.localStorage.getItem('personas');
        const existing = cached ? JSON.parse(cached) : [];
        // Update if exists, otherwise add
        const existingIndex = existing.findIndex(p => p.id === savedPersona.id);
        const updated = existingIndex >= 0
          ? existing.map((p, i) => i === existingIndex ? savedPersona : p)
          : [...existing, savedPersona];
        window.localStorage.setItem('personas', JSON.stringify(updated));
      }

      handleShowToast('Persona saved.', () => {
        router.push('/personas');
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'We could not save the persona. Please try again.';
      setSubmitError(message);
    }
  });

  const isBusy = isHydrating || isSubmitting;

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {personaId ? 'Edit Persona' : 'Create Persona'}
              </h1>
              <p className="text-sm text-gray-600">
                Keep the details aligned with your activation strategy and
                messaging.
              </p>
            </div>
            {!personaId && (
              <button
                type="button"
                onClick={() => router.push('/contacts/enrich?returnTo=persona')}
                disabled={isBusy}
                className="flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Sparkles className="h-4 w-4" />
                Build from Enrichment
              </button>
            )}
          </div>
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

        {/* AI Generation Mode */}
        {showAIGeneration && !personaId && (
          <div className="mb-6 rounded-xl border-2 border-purple-200 bg-purple-50 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <h2 className="text-lg font-bold text-gray-900">Generate with AI</h2>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              Describe your ideal customer and AI will generate a detailed persona for you.
            </p>
            
            {aiError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4" />
                {aiError}
              </div>
            )}

            <textarea
              value={aiDescription}
              onChange={(e) => setAiDescription(e.target.value)}
              placeholder="e.g., A solo business owner who's maxed out on delivery time and needs help growing revenue without working more hours. They struggle with sales and marketing while trying to focus on client work..."
              rows={6}
              className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
              disabled={aiGenerating}
            />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleAIGenerate}
                disabled={aiGenerating || !aiDescription.trim() || !derivedCompanyId}
                className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {aiGenerating ? (
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
              <button
                type="button"
                onClick={() => setShowAIGeneration(false)}
                disabled={aiGenerating}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Toggle AI Mode Button (when not in AI mode and not editing) */}
        {!showAIGeneration && !personaId && (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowAIGeneration(true)}
              disabled={isBusy}
              className="flex items-center gap-2 rounded-lg border border-purple-300 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 transition hover:bg-purple-100 disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              Generate with AI Instead
            </button>
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
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Brief description of this persona (who they are, their context)"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200"
              disabled={isBusy}
              {...register('description')}
            />
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
              className="rounded-lg bg-green-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={isBusy || !personaName?.trim()}
            >
              {isSubmitting ? 'Saving…' : 'Save Persona'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PersonaBuilderPage({ searchParams }) {
  return (
    <Suspense fallback={
      <div className="relative mx-auto max-w-3xl space-y-6 p-6">
        <div className="text-center py-8">
          <RefreshCw className="animate-spin h-6 w-6 mx-auto mb-2 text-gray-400" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <PersonaBuilderContent searchParams={searchParams} />
    </Suspense>
  );
}

