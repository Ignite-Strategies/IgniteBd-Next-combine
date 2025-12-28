'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { CheckCircle2, MapPin, Calendar, DollarSign, Sparkles } from 'lucide-react';
import api from '@/lib/api';

interface SelectableEvent {
  id: string;
  title: string;
  description?: string | null;
  eventType: string;
  startDate?: Date | null;
  endDate?: Date | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  costMin?: number | null;
  costMax?: number | null;
  personaFitScore?: number;
  prioritySource?: 'BD_INTEL' | null;
  bdRationale?: string;
}

export default function EventTunerSelectPage() {
  const router = useRouter();
  const params = useParams();
  const tunerId = params?.tunerId as string;

  const [events, setEvents] = useState<SelectableEvent[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tunerId) {
      loadSelectableEvents();
    }
  }, [tunerId]);

  const loadSelectableEvents = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/event-tuners/${tunerId}/selectable-events`);
      if (response.data?.success) {
        setEvents(response.data.events || []);
      }
    } catch (err: any) {
      console.error('Error loading selectable events:', err);
      alert(err.response?.data?.error || 'Failed to load events. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleEventSelection = (eventId: string) => {
    setSelectedEventIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    if (selectedEventIds.size === 0) {
      alert('Please select at least one event to add to your program');
      return;
    }

    try {
      setSaving(true);

      const companyHQId = localStorage.getItem('companyHQId') || '';
      const ownerId = localStorage.getItem('ownerId') || '';

      if (!companyHQId || !ownerId) {
        alert('Please ensure you are logged in and have a company selected.');
        return;
      }

      const response = await api.post(`/api/event-tuners/${tunerId}/select`, {
        selectedEventIds: Array.from(selectedEventIds),
        companyHQId,
        ownerId,
      });

      if (response.data?.success) {
        router.push('/events');
      } else {
        throw new Error('Failed to save selected events');
      }
    } catch (err: any) {
      console.error('Error saving selected events:', err);
      alert(err.response?.data?.error || 'Failed to save events. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return 'TBD';
    return new Date(date).toLocaleDateString('en-US', {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading events...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Select Events"
          subtitle={`Select events to add to your program (${selectedEventIds.size} selected)`}
          backTo="/events/build"
          backLabel="Back to Build Events"
        />

        {events.length === 0 ? (
          <div className="text-center py-12 mt-8 rounded-xl border border-gray-200 bg-white">
            <p className="text-lg font-semibold text-gray-800 mb-2">No events found</p>
            <p className="text-sm text-gray-500">
              No events match your program constraints. Try adjusting your filters.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-8 space-y-4">
              {events.map((event) => {
                const isSelected = selectedEventIds.has(event.id);
                const isBDIntel = event.prioritySource === 'BD_INTEL';

                return (
                  <div
                    key={event.id}
                    onClick={() => toggleEventSelection(event.id)}
                    className={`cursor-pointer rounded-xl border-2 p-6 bg-white transition-all ${
                      isSelected
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 mt-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleEventSelection(event.id)}
                          className="h-5 w-5 text-red-600 rounded border-gray-300 focus:ring-red-500"
                        />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-semibold text-gray-900">{event.title}</h3>
                              {isBDIntel && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                                  <Sparkles className="h-3 w-3" />
                                  BD Intelligence
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
                              {event.startDate && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  {formatDate(event.startDate)}
                                  {event.endDate && event.endDate !== event.startDate && (
                                    <> - {formatDate(event.endDate)}</>
                                  )}
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

                              {event.personaFitScore !== undefined && (
                                <span className="text-purple-600 font-medium">
                                  Fit: {event.personaFitScore}/100
                                </span>
                              )}
                            </div>

                            {event.bdRationale && (
                              <div className="mt-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                                <p className="text-sm text-purple-900 font-medium mb-1">BD Opportunity</p>
                                <p className="text-sm text-purple-700">{event.bdRationale}</p>
                              </div>
                            )}
                          </div>

                          {isSelected && (
                            <CheckCircle2 className="h-6 w-6 text-red-600 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Fixed bottom bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4">
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold text-gray-900">{selectedEventIds.size}</span> event{selectedEventIds.size !== 1 ? 's' : ''} selected
                  </p>
                </div>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || selectedEventIds.size === 0}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : `Add ${selectedEventIds.size} Event${selectedEventIds.size !== 1 ? 's' : ''} to Program`}
                  </button>
                </div>
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

