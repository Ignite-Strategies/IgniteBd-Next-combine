'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Heart, Loader2, MapPin, Calendar, DollarSign, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import { useOwner } from '@/hooks/useOwner';

interface PickedEvent {
  eventMetaId: string;
  eventName: string;
  eventType: string;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  costMin?: number | null;
  costMax?: number | null;
  timeFrame: string;
  recommendationScore: number;
  recommendationRationale: string;
}

export default function SearchPickPage() {
  const router = useRouter();
  const params = useParams();
  const tunerId = params?.tunerId as string;
  const { ownerId, companyHQId, hydrated } = useOwner();

  const [eventsByTimeFrame, setEventsByTimeFrame] = useState<{ [key: string]: PickedEvent[] }>({});
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [likedEventIds, setLikedEventIds] = useState<Set<string>>(new Set());
  const [liking, setLiking] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (tunerId && hydrated) {
      loadPickedEvents();
    }
  }, [tunerId, hydrated]);

  const loadPickedEvents = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/event-tuners/${tunerId}/pick-events`);
      
      if (response.data?.success) {
        setEventsByTimeFrame(response.data.eventsByTimeFrame || {});
        setSummary(response.data.summary || '');
      }
    } catch (err: any) {
      console.error('Error loading picked events:', err);
      alert(err.response?.data?.error || 'Failed to load events. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  const handleLike = async (event: PickedEvent) => {
    if (!ownerId || !companyHQId) {
      alert('Please ensure you are logged in.');
      return;
    }

    try {
      setLiking(prev => ({ ...prev, [event.eventMetaId]: true }));

      const response = await api.post('/api/events/ops/like', {
        eventMetaId: event.eventMetaId,
        companyHQId,
        ownerId,
        eventTunerId: tunerId,
        whyGo: event.recommendationRationale,
      });

      if (response.data?.success) {
        setLikedEventIds(prev => new Set(prev).add(event.eventMetaId));
      } else {
        throw new Error('Failed to save event');
      }
    } catch (err: any) {
      console.error('Error liking event:', err);
      alert(err.response?.data?.error || 'Failed to save event. Please try again.');
    } finally {
      setLiking(prev => ({ ...prev, [event.eventMetaId]: false }));
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'TBD';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCost = (min: number | null | undefined, max: number | null | undefined) => {
    if (!min && !max) return 'Free';
    if (min && max) {
      if (min === max) return `$${min.toLocaleString()}`;
      return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
    }
    if (min) return `$${min.toLocaleString()}+`;
    if (max) return `Up to $${max.toLocaleString()}`;
    return 'Free';
  };

  const formatEventType = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

  const timeFrameOrder = ['Q1', 'Q2', 'Q3', 'Q4', 'Upcoming'];
  const sortedTimeFrames = Object.keys(eventsByTimeFrame).sort((a, b) => {
    const aIndex = timeFrameOrder.findIndex(q => a.startsWith(q));
    const bIndex = timeFrameOrder.findIndex(q => b.startsWith(q));
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

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
          subtitle={summary || 'Here are events that match your preferences'}
          backTo="/events/preferences"
          backLabel="Back to Preferences"
        />

        {Object.keys(eventsByTimeFrame).length === 0 ? (
          <div className="text-center py-12 mt-8 rounded-xl border border-gray-200 bg-white">
            <p className="text-lg font-semibold text-gray-800 mb-2">No events found</p>
            <p className="text-sm text-gray-500">
              No events match your preferences. Try adjusting your constraints.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {sortedTimeFrames.map((timeFrame) => (
              <div key={timeFrame} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">{timeFrame}</h2>
                <div className="space-y-4">
                  {eventsByTimeFrame[timeFrame].map((event) => {
                    const isLiked = likedEventIds.has(event.eventMetaId);
                    const isLiking = liking[event.eventMetaId];

                    return (
                      <div
                        key={event.eventMetaId}
                        className="rounded-lg border-2 border-gray-200 bg-white p-6 hover:border-gray-300 transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <h3 className="text-xl font-semibold text-gray-900">{event.eventName}</h3>
                              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                                <Sparkles className="h-3 w-3" />
                                {event.recommendationScore}/100 match
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
                              {event.startDate && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  {formatDate(event.startDate.toString())}
                                </div>
                              )}
                              {(event.city || event.state || event.country) && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-4 w-4" />
                                  {[event.city, event.state, event.country].filter(Boolean).join(', ')}
                                </div>
                              )}
                              {(event.costMin || event.costMax) && (
                                <div className="flex items-center gap-1">
                                  <DollarSign className="h-4 w-4" />
                                  {formatCost(event.costMin, event.costMax)}
                                </div>
                              )}
                              <span className="text-gray-500">
                                {formatEventType(event.eventType)}
                              </span>
                            </div>

                            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <p className="text-sm font-medium text-blue-900 mb-1">Why this matches:</p>
                              <p className="text-sm text-blue-700">{event.recommendationRationale}</p>
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
            ))}
          </div>
        )}

        {/* Continue Button */}
        {likedEventIds.size > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">{likedEventIds.size}</span> event{likedEventIds.size !== 1 ? 's' : ''} saved
                </p>
              </div>
              <button
                onClick={() => router.push(`/events/plan-picker?tunerId=${tunerId}`)}
                className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Continue to Plan →
              </button>
            </div>
          </div>
        )}

        {/* Spacer for fixed bottom bar */}
        {likedEventIds.size > 0 && <div className="h-24" />}
      </div>
    </div>
  );
}

