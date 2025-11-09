import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import api from '../../../lib/api';

type PersonaFormValues = {
  personaName: string;
  role?: string;
  painPoints?: string;
  goals?: string;
  whatTheyWant?: string;
  companyId: string;
};

type PersonaRecord = Omit<PersonaFormValues, 'companyId'> & {
  id: string;
  companyId: string;
  createdAt?: string;
  updatedAt?: string;
};

type PersonaBuilderProps = {
  personaId?: string;
  companyId?: string;
  onCancel?: () => void;
  onSuccess?: (persona: PersonaRecord) => void;
};

type ApiPersonaResponse = {
  success?: boolean;
  persona?: PersonaRecord;
};

const defaultValues: PersonaFormValues = {
  personaName: '',
  role: '',
  painPoints: '',
  goals: '',
  whatTheyWant: '',
  companyId: '',
};

const PersonaBuilder = ({ personaId, companyId: companyIdProp, onCancel, onSuccess }: PersonaBuilderProps) => {
  const navigate = useNavigate();
  const [isHydrating, setIsHydrating] = useState<boolean>(Boolean(personaId));
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const derivedCompanyId = useMemo(() => {
    if (companyIdProp) {
      return companyIdProp;
    }
    if (typeof window !== 'undefined') {
      return (
        window.localStorage.getItem('companyId') ??
        window.localStorage.getItem('companyHQId') ?? // legacy fallback
        ''
      );
    }
    return '';
  }, [companyIdProp]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PersonaFormValues>({
    defaultValues,
    mode: 'onBlur',
  });

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (derivedCompanyId) {
      setValue('companyId', derivedCompanyId);
    }
  }, [derivedCompanyId, setValue]);

  useEffect(() => {
    if (!personaId) {
      return;
    }

    let isMounted = true;
    setIsHydrating(true);
    setFetchError(null);

    (async () => {
      try {
        const response = await api.get<ApiPersonaResponse>(`/api/personas/${personaId}`);
        const persona = response.data?.persona ?? null;

        if (!isMounted) {
          return;
        }

        if (!persona) {
          setFetchError('Persona not found.');
          return;
        }

        const record = persona as PersonaRecord;

        reset({
          personaName: record.personaName ?? '',
          role: record.role ?? '',
          painPoints: record.painPoints ?? '',
          goals: record.goals ?? '',
          whatTheyWant: record.whatTheyWant ?? '',
          companyId: record.companyId ?? '',
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Failed to load persona.';
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
  }, [personaId, reset]);

  const handleShowToast = (message: string, callback?: () => void) => {
    setToastMessage(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      if (callback) {
        callback();
      }
    }, 1200);
  };

  const submitHandler = handleSubmit(async (values) => {
    setSubmitError(null);

    if (!values.companyId) {
      setSubmitError('Company context is required to save a persona.');
      return;
    }

    try {
      const response = await api.post<ApiPersonaResponse>('/api/personas/upsert', {
        ...values,
        id: personaId,
      });

      const savedPersona = response.data?.persona;

      if (!savedPersona) {
        throw new Error('Persona save response was missing data.');
      }

      const postToastAction = () => {
        if (onSuccess) {
          onSuccess(savedPersona);
        } else {
          navigate('/dashboard/personas');
        }
      };

      handleShowToast('Persona Saved ✅', postToastAction);
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
    <div className="relative">
      {toastMessage && (
        <div className="fixed top-6 inset-x-0 flex justify-center z-50 px-4">
          <div className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg">
            {toastMessage}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {personaId ? 'Edit Persona' : 'Create Persona'}
          </h2>
          <p className="text-gray-600">
            Keep the details aligned with your activation strategy and messaging.
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

        <form onSubmit={submitHandler} className="space-y-6">
          <input
            type="hidden"
            value={derivedCompanyId}
            {...register('companyId', { required: true })}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Persona Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., Sarah the Scaling COO"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                disabled={isBusy}
                {...register('personaName', { required: 'Persona name is required.' })}
              />
              {errors.personaName && (
                <p className="text-xs text-red-500 mt-1">{errors.personaName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
              <input
                type="text"
                placeholder="e.g., COO, Head of Growth"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                disabled={isBusy}
                {...register('role')}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Pain Points</label>
            <textarea
              rows={4}
              placeholder="Where are they feeling friction? What slows them down?"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              disabled={isBusy}
              {...register('painPoints')}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Goals</label>
            <textarea
              rows={4}
              placeholder="What outcomes do they care about most?"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              disabled={isBusy}
              {...register('goals')}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">What They Want From Us</label>
            <textarea
              rows={4}
              placeholder="What are they hoping Ignite will help them achieve or solve?"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              disabled={isBusy}
              {...register('whatTheyWant')}
            />
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                if (onCancel) {
                  onCancel();
                } else {
                  navigate(-1);
                }
              }}
              className="px-6 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-60"
              disabled={isBusy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-70"
              disabled={isBusy || (!isDirty && !personaId)}
            >
              {isSubmitting ? 'Saving...' : 'Save Persona'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export type { PersonaBuilderProps, PersonaFormValues, PersonaRecord };
export default PersonaBuilder;

