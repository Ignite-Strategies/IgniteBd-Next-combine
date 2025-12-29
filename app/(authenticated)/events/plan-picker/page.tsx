'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { CheckCircle2, Calendar, MapPin, DollarSign } from 'lucide-react';
import api from '@/lib/api';
import { useOwner } from '@/hooks/useOwner';

interface EventOp {
  id: string;
  title: string;
  eventType: string;
  startDate?: string | null;
  endDate?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  costBand?: string | null;
  whyGo?: string | null;
}

export default function PlanPickerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tunerId = searchParams.get('tunerId');
  const { ownerId, companyHQId, hydrated } = useOwner();

  const [events, setEvents] = useState<EventOp[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hydrated && ownerId && companyHQId) {
      loadEvents();
    }
  }, [hydrated, ownerId, companyHQId]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      // Get events that don't have a plan yet (user's "liked" events)
      const response = await api.get('/api/events/ops/list', {
        params: {
          companyHQId,
          ownerId,
          hasNoPlan: 'true', // Filter to events without a plan
        },
      });

      if (response.data?.success) {
        const eventsWithoutPlan = response.data.eventOps || [];
        setEvents(eventsWithoutPlan);
        // Pre-select all events (they already "liked" them)
        setSelectedEventIds(new Set(eventsWithoutPlan.map((e: EventOp) => e.id)));
      } else {
        throw new Error(response.data?.error || 'Failed to load events');
      }
    } catch (err: any) {
      console.error('Error loading events:', err);
      alert(err.response?.data?.error || 'Failed to load events. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleEvent = (eventId: string) => {
    setSelectedEventIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const handleContinue = () => {
    if (selectedEventIds.size === 0) {
      alert('Please select at least one event for your plan.');
      return;
    }

    // Navigate to confirm and name page with selected event IDs
    const eventIdsParam = Array.from(selectedEventIds).join(',');
    router.push(`/events/confirm-plan?eventIds=${eventIdsParam}${tunerId ? `&tunerId=${tunerId}` : ''}`);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'TBD';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatEventType = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your events...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Choose Events for Your Plan"
          subtitle="Select the events you want to include in your event plan"
          backTo={tunerId ? `/events/search-pick/${tunerId}` : '/events'}
          backLabel="Back"
        />

        {events.length === 0 ? (
          <div className="text-center py-12 mt-8 rounded-xl border border-gray-200 bg-white">
            <p className="text-lg font-semibold text-gray-800 mb-2">No events found</p>
            <p className="text-sm text-gray-500 mb-4">
              You haven't saved any events yet. Go back and select events you like.
            </p>
            <button
              onClick={() => router.push(tunerId ? `/events/search-pick/${tunerId}` : '/events')}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
            >
              Go to Event Search
            </button>
          </div>
        ) : (
          <>
            <div className="mt-8 mb-6 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{selectedEventIds.size}</span> of{' '}
                <span className="font-semibold text-gray-900">{events.length}</span> events selected
              </p>
            </div>

            <div className="space-y-4">
              {events.map((event) => {
                const isSelected = selectedEventIds.has(event.id);

                return (
                  <div
                    key={event.id}
                    onClick={() => toggleEvent(event.id)}
                    className={`cursor-pointer rounded-lg border-2 p-6 transition-all ${
                      isSelected
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 mt-1">
                        {isSelected ? (
                          <CheckCircle2 className="h-6 w-6 text-red-600" />
                        ) : (
                          <div className="h-6 w-6 rounded-full border-2 border-gray-300" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 mb-3">{event.title}</h3>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
                          {event.startDate && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDate(event.startDate)}
                            </div>
                          )}
                          {(event.city || event.state || event.country) && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {[event.city, event.state, event.country].filter(Boolean).join(', ')}
                            </div>
                          )}
                          {event.costBand && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4" />
                              {event.costBand}
                            </div>
                          )}
                          <span className="text-gray-500">{formatEventType(event.eventType)}</span>
                        </div>

                        {event.whyGo && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-sm text-blue-700">{event.whyGo}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Continue Button */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4">
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold text-gray-900">{selectedEventIds.size}</span> event{selectedEventIds.size !== 1 ? 's' : ''} selected
                  </p>
                </div>
                <button
                  onClick={handleContinue}
                  disabled={selectedEventIds.size === 0}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    selectedEventIds.size === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  Continue to Name Plan →
                </button>
              </div>
            </div>

            {/* Spacer for fixed bottom bar */}
            <div className="h-24" />
          </>
        )}
      </div>
    </div>
  );
}

