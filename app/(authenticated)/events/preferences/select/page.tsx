'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Plus, Edit2, Trash2, Calendar, MapPin, DollarSign, Users, Loader2 } from 'lucide-react';
import api from '@/lib/api';

interface EventTuner {
  id: string;
  name: string;
  conferencesPerQuarter?: number | null;
  costRange?: string | null;
  travelDistance?: string | null;
  eventSearchRawText?: string | null;
  createdAt: string;
  event_tuner_states?: { state: string }[];
  event_tuner_personas?: { personas: { personName?: string; title?: string } }[];
}

function PreferencesSelectPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  
  // Direct read from localStorage - NO HOOKS
  const [ownerId, setOwnerId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('ownerId');
    if (stored) setOwnerId(stored);
  }, []);

  const [tuners, setTuners] = useState<EventTuner[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Redirect if no companyHQId in URL
  useEffect(() => {
    if (!companyHQId && typeof window !== 'undefined') {
      const stored = localStorage.getItem('companyHQId');
      if (stored) {
        router.replace(`/events/preferences/select?companyHQId=${stored}`);
      } else {
        router.push('/events');
      }
    }
  }, [companyHQId, router]);

  useEffect(() => {
    if (ownerId && companyHQId) {
      loadTuners();
    } else if (!companyHQId) {
      setLoading(true);
    } else {
      setLoading(false);
    }
  }, [ownerId, companyHQId]);

  const loadTuners = async () => {
    try {
      setLoading(true);
      if (!companyHQId || !ownerId) return;

      const response = await api.get(`/api/event-tuners/list?companyHQId=${companyHQId}&ownerId=${ownerId}&isActive=true`);
      
      if (response.data?.success && response.data.tuners) {
        setTuners(response.data.tuners || []);
      }
    } catch (err: any) {
      console.error('Error loading tuners:', err);
      // Don't show error - just show empty list
      setTuners([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (tunerId: string) => {
    // Navigate to ready-to-plan with tunerId and companyHQId
    const url = companyHQId 
      ? `/events/ready-to-plan?tunerId=${tunerId}&companyHQId=${companyHQId}`
      : `/events/ready-to-plan?tunerId=${tunerId}`;
    router.push(url);
  };

  const handleEdit = (tunerId: string) => {
    // Navigate to preferences edit page with tunerId
    const url = companyHQId 
      ? `/events/preferences?tunerId=${tunerId}&companyHQId=${companyHQId}`
      : `/events/preferences?tunerId=${tunerId}`;
    router.push(url);
  };

  const handleDelete = async (tunerId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering select
    
    if (!confirm('Are you sure you want to delete these preferences? This cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(tunerId);
      await api.delete(`/api/event-tuners/${tunerId}`);
      
      // Reload list
      await loadTuners();
    } catch (err: any) {
      console.error('Error deleting tuner:', err);
      alert(err.response?.data?.error || 'Failed to delete preferences. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateNew = () => {
    const url = companyHQId 
      ? `/events/preferences?companyHQId=${companyHQId}`
      : '/events/preferences';
    router.push(url);
  };

  const formatCostRange = (range: string | null | undefined) => {
    if (!range) return 'No limit';
    const map: { [key: string]: string } = {
      'FREE': 'Free',
      'LOW_0_500': '$0-$500',
      'MEDIUM_500_2000': '$500-$2,000',
      'HIGH_2000_5000': '$2,000-$5,000',
      'PREMIUM_5000_PLUS': '$5,000+',
    };
    return map[range] || range;
  };

  const formatTravelDistance = (distance: string | null | undefined) => {
    if (!distance) return 'No limit';
    const map: { [key: string]: string } = {
      'LOCAL': 'Local',
      'REGIONAL': 'Regional',
      'DOMESTIC': 'Domestic',
      'INTERNATIONAL': 'International',
    };
    return map[distance] || distance;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-red-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading preferences...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Select Preferences"
          subtitle="Choose existing preferences or create new ones to find events that match your criteria"
          backTo="/events"
          backLabel="Back to Events"
        />

        {/* Create New Button */}
        <div className="mt-8 mb-6 flex justify-end">
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Create New Preferences
          </button>
        </div>

        {/* Preferences List */}
        {tuners.length === 0 ? (
          <div className="mt-8 text-center py-12 rounded-xl border border-gray-200 bg-white">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-800 mb-2">No preferences yet</p>
            <p className="text-sm text-gray-500 mb-6">
              Create your first set of preferences to start finding events
            </p>
            <button
              onClick={handleCreateNew}
              className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              Create Preferences
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {tuners.map((tuner) => (
              <div
                key={tuner.id}
                onClick={() => handleSelect(tuner.id)}
                className="cursor-pointer rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-red-300 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-semibold text-gray-900">{tuner.name}</h3>
                      <span className="text-xs text-gray-500">
                        {new Date(tuner.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
                      {tuner.costRange && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-gray-400" />
                          <span>{formatCostRange(tuner.costRange)}</span>
                        </div>
                      )}
                      {tuner.travelDistance && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span>{formatTravelDistance(tuner.travelDistance)}</span>
                        </div>
                      )}
                      {tuner.conferencesPerQuarter && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span>{tuner.conferencesPerQuarter} per quarter</span>
                        </div>
                      )}
                      {tuner.event_tuner_personas && tuner.event_tuner_personas.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-gray-400" />
                          <span>{tuner.event_tuner_personas[0].personas.personName || tuner.event_tuner_personas[0].personas.title || 'Persona selected'}</span>
                        </div>
                      )}
                      {tuner.event_tuner_states && tuner.event_tuner_states.length > 0 && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span>{tuner.event_tuner_states.length} state{tuner.event_tuner_states.length !== 1 ? 's' : ''} selected</span>
                        </div>
                      )}
                      {tuner.eventSearchRawText && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">Keywords:</span>
                          <span>{tuner.eventSearchRawText}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(tuner.id);
                      }}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(tuner.id, e)}
                      disabled={deletingId === tuner.id}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      {deletingId === tuner.id ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Trash2 className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PreferencesSelectPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-red-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <PreferencesSelectPageContent />
    </Suspense>
  );
}

