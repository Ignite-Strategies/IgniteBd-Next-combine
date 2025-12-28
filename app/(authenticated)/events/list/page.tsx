'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { List, Loader2, MapPin, Calendar, DollarSign, Sparkles } from 'lucide-react';
import api from '@/lib/api';

interface EventOp {
  id: string;
  title: string;
  description?: string | null;
  eventType: string;
  startDate?: string | null;
  endDate?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  costBand?: string | null;
  status: string;
  source: string;
  prioritySource?: string | null;
  eventPlanId?: string | null;
  eventTunerId?: string | null;
  createdAt: string;
}

export default function EventsListPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventOp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const companyHQId = localStorage.getItem('companyHQId') || '';
      const ownerId = localStorage.getItem('ownerId') || '';

      if (!companyHQId || !ownerId) {
        setLoading(false);
        return;
      }

      const response = await api.get(`/api/events/ops/list?companyHQId=${companyHQId}&ownerId=${ownerId}`);
      
      if (response.data?.success) {
        setEvents(response.data.eventOps || []);
      }
    } catch (err: any) {
      console.error('Error loading events:', err);
      alert(err.response?.data?.error || 'Failed to load events. Please try again.');
    } finally {
      setLoading(false);
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

  const formatEventType = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONSIDERING':
        return 'bg-yellow-100 text-yellow-800';
      case 'SHORTLIST':
        return 'bg-blue-100 text-blue-800';
      case 'GOING':
        return 'bg-green-100 text-green-800';
      case 'PASSED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-gray-400 mx-auto mb-4" />
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
          title="Your Events"
          subtitle={`View all events you've selected (${events.length} total)`}
          backTo="/events"
          backLabel="Back to Events"
        />

        {events.length === 0 ? (
          <div className="mt-8 text-center py-12 rounded-xl border border-gray-200 bg-white">
            <List className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-800 mb-2">No events yet</p>
            <p className="text-sm text-gray-500 mb-4">
              Start by researching events by persona or setting your plan
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => router.push('/events/build-from-persona')}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Research by Persona
              </button>
              <button
                onClick={() => router.push('/events/set-plan')}
                className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Set Your Plan
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {events.map((event) => (
              <div
                key={event.id}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">{event.title}</h3>
                      {event.prioritySource === 'BD_INTEL' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                          <Sparkles className="h-3 w-3" />
                          BD Intelligence
                        </span>
                      )}
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(event.status)}`}>
                        {event.status}
                      </span>
                    </div>

                    {event.description && (
                      <p className="text-sm text-gray-600 mb-3">{event.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
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

                      {event.costBand && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          {event.costBand}
                        </div>
                      )}

                      <span className="text-gray-500">
                        {formatEventType(event.eventType)}
                      </span>

                      <span className="text-gray-400 text-xs">
                        {formatEventType(event.source)} source
                      </span>
                    </div>
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

