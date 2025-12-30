'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Heart, Loader2, MapPin, Calendar, DollarSign, Building2 } from 'lucide-react';
import api from '@/lib/api';

interface EventPickerModel {
  eventTitle: string;
  description: string;
  whyGo: string;
  location?: string;
  timeFrame?: string;
  sponsor?: string;
  costEstimate?: string;
}

function SearchPickPageContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  // Get tunerId from params (URL path) or search params (for consistency)
  const tunerIdFromPath = params?.tunerId as string;
  const tunerIdFromParams = searchParams.get('tunerId') || '';
  const tunerId = tunerIdFromPath || tunerIdFromParams;
  const companyHQId = searchParams.get('companyHQId') || '';
  
  // Redirect if tunerId is missing
  useEffect(() => {
    if (!tunerId && typeof window !== 'undefined') {
      console.error('❌ No tunerId found in URL');
      router.push('/events/preferences');
    }
  }, [tunerId, router]);

  // Ensure tunerId and companyHQId are in URL params
  useEffect(() => {
    if (tunerId && companyHQId && typeof window !== 'undefined') {
      const currentUrl = new URL(window.location.href);
      const needsUpdate = !currentUrl.searchParams.has('tunerId') || !currentUrl.searchParams.has('companyHQId');
      
      if (needsUpdate) {
        currentUrl.searchParams.set('tunerId', tunerId);
        currentUrl.searchParams.set('companyHQId', companyHQId);
        router.replace(currentUrl.pathname + currentUrl.search);
      }
    }
  }, [tunerId, companyHQId, router]);
  
  // Direct read from localStorage - NO HOOKS
  const [ownerId, setOwnerId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('ownerId');
    if (stored) setOwnerId(stored);
  }, []);

  const [events, setEvents] = useState<EventPickerModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [likedEventTitles, setLikedEventTitles] = useState<Set<string>>(new Set());
  const [liking, setLiking] = useState<{ [key: string]: boolean }>({});
  const [keywords, setKeywords] = useState<string>(''); // Keywords from tuner

  // Load generated events from localStorage first (following OpenAI pattern)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const tempData = localStorage.getItem('tempPickedEvents');
    if (tempData) {
      try {
        const data = JSON.parse(tempData);
        if (data.tunerId === tunerId) {
          // Use data from localStorage
          setEvents(data.eventPickerModel || []);
          setLoading(false);
          
          // Clean up after using
          localStorage.removeItem('tempPickedEvents');
          return;
        }
      } catch (err) {
        console.error('Failed to parse temp picked events:', err);
      }
    }
    
    // If no localStorage data, load from API
    if (tunerId && companyHQId) {
      loadPickedEvents();
      loadTunerKeywords();
    } else {
      setLoading(false);
    }
  }, [tunerId, companyHQId]);

  const loadTunerKeywords = async () => {
    if (!tunerId) return;
    
    try {
      const response = await api.get(`/api/event-tuners/${tunerId}`);
      if (response.data?.success && response.data.tuner) {
        const searchText = response.data.tuner.eventSearchRawText || '';
        setKeywords(searchText);
      }
    } catch (err) {
      console.error('Error loading tuner keywords:', err);
    }
  };

  const loadPickedEvents = async () => {
    if (!tunerId) {
      console.error('❌ Cannot load events: tunerId is missing');
      setError('Event preferences not found. Please go back and select preferences.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('🔄 Loading picked events for tunerId:', tunerId);
      
      const response = await api.get(`/api/event-tuners/${tunerId}/pick-events`);
      
      console.log('✅ Picked events response:', response.data);
      
      if (response.data?.success) {
        setEvents(response.data.eventPickerModel || []);
        
        if (!response.data.eventPickerModel || response.data.eventPickerModel.length === 0) {
          setError('No events found matching your preferences.');
        }
      } else {
        throw new Error(response.data?.error || 'Failed to load events');
      }
    } catch (err: any) {
      console.error('❌ Error loading picked events:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load events. Please try again.';
      setError(errorMessage);
      
      // Show alert for critical errors
      if (err.response?.status === 401) {
        alert('Authentication failed. Please sign in again.');
      } else if (err.response?.status === 404) {
        alert('Event preferences not found. Please go back and create new preferences.');
      } else {
        // Don't show alert for other errors, just show in UI
        console.error('Error details:', {
          status: err.response?.status,
          data: err.response?.data,
          message: err.message,
        });
      }
    } finally {
      setLoading(false);
    }
  };


  const handleLike = async (event: EventPickerModel) => {
    if (!ownerId || !companyHQId) {
      alert('Please ensure you are logged in.');
      return;
    }

    try {
      setLiking(prev => ({ ...prev, [event.eventTitle]: true }));

      const response = await api.post('/api/events/ops/like', {
        eventTitle: event.eventTitle,
        description: event.description,
        location: event.location,
        timeFrame: event.timeFrame,
        sponsor: event.sponsor,
        costEstimate: event.costEstimate,
        companyHQId,
        ownerId,
        eventTunerId: tunerId,
        whyGo: event.whyGo,
      });

      if (response.data?.success) {
        setLikedEventTitles(prev => new Set(prev).add(event.eventTitle));
      } else {
        throw new Error('Failed to save event');
      }
    } catch (err: any) {
      console.error('Error liking event:', err);
      alert(err.response?.data?.error || 'Failed to save event. Please try again.');
    } finally {
      setLiking(prev => ({ ...prev, [event.eventTitle]: false }));
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-red-600 mx-auto mb-4" />
            <p className="text-gray-600">Finding events that match your preferences...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Events Based on Your Preferences"
          subtitle="Here are events that match your preferences"
          backTo={companyHQId ? `/events/picker?companyHQId=${companyHQId}` : '/events/picker'}
          backLabel="Back to Event Picker"
        />

        {error ? (
          <div className="text-center py-12 mt-8 rounded-xl border border-red-200 bg-red-50">
            <p className="text-lg font-semibold text-red-800 mb-2">Error Loading Events</p>
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button
              onClick={() => router.push(companyHQId ? `/events/picker?companyHQId=${companyHQId}` : '/events/picker')}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Go Back to Event Picker
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 mt-8 rounded-xl border border-gray-200 bg-white">
            <p className="text-lg font-semibold text-gray-800 mb-2">No events found</p>
            <p className="text-sm text-gray-500 mb-4">
              No events match your preferences. Try adjusting your constraints.
            </p>
            <button
              onClick={loadPickedEvents}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {/* Keywords Badge */}
            {keywords && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-medium text-blue-900 mb-1">Keywords:</p>
                <p className="text-sm text-blue-700">{keywords}</p>
              </div>
            )}

            {/* Display events grouped by quarter (OpenAI already organized them) */}
            {['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'].map((quarter) => {
              const quarterEvents = events.filter(e => e.timeFrame === quarter);
              if (quarterEvents.length === 0) return null;

              return (
                <div key={quarter} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">{quarter}</h2>
                  <div className="space-y-4">
                    {quarterEvents.map((event, index) => {
                      const isLiked = likedEventTitles.has(event.eventTitle);
                      const isLiking = liking[event.eventTitle];

                      return (
                        <div
                          key={index}
                          className="rounded-lg border-2 border-gray-200 bg-white p-6 hover:border-gray-300 transition-all"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="text-xl font-semibold text-gray-900 mb-3">{event.eventTitle}</h3>
                              
                              {/* Event Details Row */}
                              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
                                {event.location && (
                                  <div className="flex items-center gap-1">
                                    <MapPin className="h-4 w-4" />
                                    <span>{event.location}</span>
                                  </div>
                                )}
                                {event.timeFrame && (
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    <span>{event.timeFrame}</span>
                                  </div>
                                )}
                                {event.costEstimate && (
                                  <div className="flex items-center gap-1">
                                    <DollarSign className="h-4 w-4" />
                                    <span>{event.costEstimate}</span>
                                  </div>
                                )}
                                {event.sponsor && (
                                  <div className="flex items-center gap-1">
                                    <Building2 className="h-4 w-4" />
                                    <span>{event.sponsor}</span>
                                  </div>
                                )}
                              </div>
                              
                              <div className="mb-3">
                                <p className="text-sm text-gray-700">{event.description}</p>
                              </div>

                              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-sm font-medium text-blue-900 mb-1">Why you should go:</p>
                                <p className="text-sm text-blue-700">{event.whyGo}</p>
                              </div>
                            </div>

                            <button
                              onClick={() => handleLike(event)}
                              disabled={isLiked || isLiking}
                              className={`flex-shrink-0 px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                                isLiked
                                  ? 'bg-green-100 text-green-700 border-2 border-green-300 cursor-default'
                                  : isLiking
                                    ? 'bg-gray-100 text-gray-500 cursor-wait'
                                    : 'bg-red-600 text-white hover:bg-red-700'
                              }`}
                            >
                              {isLiking ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span>Saving...</span>
                                </>
                              ) : isLiked ? (
                                <>
                                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  <span>Saved!</span>
                                </>
                              ) : (
                                <>
                                  <Heart className="h-4 w-4" />
                                  <span>I like it</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Continue Button */}
        {likedEventTitles.size > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">{likedEventTitles.size}</span> event{likedEventTitles.size !== 1 ? 's' : ''} saved
                </p>
              </div>
              <button
                onClick={() => router.push(`/events/plan-picker?tunerId=${tunerId}${companyHQId ? `&companyHQId=${companyHQId}` : ''}`)}
                className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Continue to Plan →
              </button>
            </div>
          </div>
        )}

        {/* Spacer for fixed bottom bar */}
        {likedEventTitles.size > 0 && <div className="h-24" />}
      </div>
    </div>
  );
}

export default function SearchPickPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-red-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <SearchPickPageContent />
    </Suspense>
  );
}

