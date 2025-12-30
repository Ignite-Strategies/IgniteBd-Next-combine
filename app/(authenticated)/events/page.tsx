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
          title="Event Intelligence Planner"
          subtitle="Discover and evaluate events that align with your business development goals"
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        {/* Main Content - Find and Select Events (Large) + Preferences Sidebar (Small) */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main - Find and Select Events (2 columns) */}
          <div className="lg:col-span-2 space-y-6">
            <div
              onClick={navigateToCreatePreferences}
              className="cursor-pointer rounded-2xl border-2 border-gray-200 bg-white p-8 shadow-lg hover:shadow-xl transition-all hover:border-red-300"
            >
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">Find and Select Events</h2>
                  <p className="text-lg text-gray-600 mb-4">
                    Set your preferences, get AI-powered event recommendations, and build your event program. The main UX for finding and selecting events that match your criteria.
                  </p>
                  <div className="flex items-center gap-2 text-red-600 font-semibold text-lg">
                    <Plus className="h-5 w-5" />
                    <span>Create New Preferences</span>
                  </div>
                </div>
              </div>
            </div>

          {/* Sidebar - Existing Preferences (1 column) */}
          <div className="lg:col-span-1 space-y-6">
            {/* Existing Preferences */}
            <div className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Your Preferences</h3>
                {loadingTuners && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
              </div>
              
              {tuners.length === 0 && !loadingTuners ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No preferences yet. Create your first set to get started.
                </p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {tuners.map((tuner) => (
                    <div
                      key={tuner.id}
                      onClick={() => handleSelectTuner(tuner.id)}
                      className="cursor-pointer rounded-lg border border-gray-200 bg-gray-50 p-4 hover:border-red-300 hover:bg-red-50 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 mb-1 truncate">{tuner.name}</h4>
                          <div className="space-y-1 text-xs text-gray-600">
                            {tuner.costRange && (
                              <div className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                <span>{formatCostRange(tuner.costRange)}</span>
                              </div>
                            )}
                            {tuner.travelDistance && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                <span>{formatTravelDistance(tuner.travelDistance)}</span>
                              </div>
                            )}
                            {tuner.conferencesPerQuarter && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{tuner.conferencesPerQuarter}/quarter</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={(e) => handleEditTuner(tuner.id, e)}
                            className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteTuner(tuner.id, e)}
                            disabled={deletingId === tuner.id}
                            className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors disabled:opacity-50"
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
                    </div>
                  ))}
                </div>
              )}
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
