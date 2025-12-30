'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Sparkles, Calendar, List, RefreshCw, Plus, Edit2, Trash2, DollarSign, MapPin, Users, Loader2 } from 'lucide-react';
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

function EventsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [tuners, setTuners] = useState<EventTuner[]>([]);
  const [loadingTuners, setLoadingTuners] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ownerId');
      if (stored) setOwnerId(stored);
    }
  }, []);

  useEffect(() => {
    if (ownerId && companyHQId) {
      loadTuners();
    }
  }, [ownerId, companyHQId]);

  const loadTuners = async () => {
    try {
      setLoadingTuners(true);
      if (!companyHQId || !ownerId) return;

      const response = await api.get(`/api/event-tuners/list?companyHQId=${companyHQId}&ownerId=${ownerId}&isActive=true`);
      
      if (response.data?.success && response.data.tuners) {
        setTuners(response.data.tuners || []);
      }
    } catch (err: any) {
      console.error('Error loading tuners:', err);
      setTuners([]);
    } finally {
      setLoadingTuners(false);
    }
  };

  const handleSelectTuner = (tunerId: string) => {
    const url = companyHQId 
      ? `/events/ready-to-plan?tunerId=${tunerId}&companyHQId=${companyHQId}`
      : `/events/ready-to-plan?tunerId=${tunerId}`;
    router.push(url);
  };

  const handleEditTuner = (tunerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = companyHQId 
      ? `/events/preferences?tunerId=${tunerId}&companyHQId=${companyHQId}`
      : `/events/preferences?tunerId=${tunerId}`;
    router.push(url);
  };

  const handleDeleteTuner = async (tunerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete these preferences? This cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(tunerId);
      await api.delete(`/api/event-tuners/${tunerId}`);
      await loadTuners();
    } catch (err: any) {
      console.error('Error deleting tuner:', err);
      alert(err.response?.data?.error || 'Failed to delete preferences. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const navigateToCreatePreferences = () => {
    if (companyHQId) {
      router.push(`/events/preferences?companyHQId=${companyHQId}`);
    } else {
      router.push('/events/preferences');
    }
  };

  const navigateToBuildFromPersona = () => {
    if (companyHQId) {
      router.push(`/events/build-from-persona?companyHQId=${companyHQId}`);
    } else {
      router.push('/events/build-from-persona');
    }
  };

  const navigateToList = () => {
    if (companyHQId) {
      router.push(`/events/list?companyHQId=${companyHQId}`);
    } else {
      router.push('/events/list');
    }
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Let's Pick Your Events"
          subtitle="Choose or create your preferences to generate your event plan"
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        {/* Create New Preference Card */}
        <div className="mt-8 mb-8">
          <div
            onClick={navigateToCreatePreferences}
            className="cursor-pointer rounded-2xl border-2 border-dashed border-gray-300 bg-white p-8 shadow-sm hover:shadow-md hover:border-red-400 transition-all text-center"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 flex items-center justify-center">
                <Plus className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Create New Preferences</h3>
                <p className="text-sm text-gray-600">Set up a new set of preferences for finding events</p>
              </div>
            </div>
          </div>
        </div>

        {/* Existing Preferences Grid */}
        {loadingTuners ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-red-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading your preferences...</p>
          </div>
        ) : tuners.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-gray-200 bg-white">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-800 mb-2">No preferences yet</p>
            <p className="text-sm text-gray-500 mb-6">
              Create your first set of preferences to start picking events
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Your Preferences</h2>
              <p className="text-sm text-gray-600 mt-1">Select a preference to generate your events</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tuners.map((tuner) => (
                <div
                  key={tuner.id}
                  className="group cursor-pointer rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm hover:shadow-lg hover:border-red-400 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex-1">{tuner.name}</h3>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleEditTuner(tuner.id, e)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteTuner(tuner.id, e)}
                        disabled={deletingId === tuner.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deletingId === tuner.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600 mb-4">
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
                  </div>

                  <button
                    onClick={() => handleSelectTuner(tuner.id)}
                    className="w-full mt-4 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                  >
                    Generate My Events
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Other Actions */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Research Best Events by Persona */}
          <div
            onClick={navigateToBuildFromPersona}
            className="cursor-pointer rounded-xl border-2 border-gray-200 bg-white p-6 shadow-md hover:shadow-lg transition-all hover:border-blue-300"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Research Best Events by Persona</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Get scores and see optimal BD alignment for your goals. Research events with persona-based intelligence.
                </p>
                <div className="flex items-center gap-1 text-blue-600 font-medium text-sm">
                  <span>Research Events</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* See Events */}
          <div
            onClick={navigateToList}
            className="cursor-pointer rounded-xl border-2 border-gray-200 bg-white p-6 shadow-md hover:shadow-lg transition-all hover:border-orange-300"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                <List className="h-6 w-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">See Events</h3>
                <p className="text-sm text-gray-600 mb-3">
                  View all your selected events
                </p>
                <div className="flex items-center gap-1 text-orange-600 font-medium text-sm">
                  <span>View Events</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

            {/* Research Best Events by Persona */}
            <div
              onClick={navigateToBuildFromPersona}
              className="cursor-pointer rounded-xl border-2 border-gray-200 bg-white p-6 shadow-md hover:shadow-lg transition-all hover:border-blue-300"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Research Best Events by Persona</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Get scores and see optimal BD alignment for your goals. Research events with persona-based intelligence.
                  </p>
                  <div className="flex items-center gap-1 text-blue-600 font-medium text-sm">
                    <span>Research Events</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* See Events */}
            <div
              onClick={navigateToList}
              className="cursor-pointer rounded-xl border-2 border-gray-200 bg-white p-6 shadow-md hover:shadow-lg transition-all hover:border-orange-300"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <List className="h-6 w-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">See Events</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    View all your selected events
                  </p>
                  <div className="flex items-center gap-1 text-orange-600 font-medium text-sm">
                    <span>View Events</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-8">
            <RefreshCw className="animate-spin h-6 w-6 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <EventsPageContent />
    </Suspense>
  );
}
