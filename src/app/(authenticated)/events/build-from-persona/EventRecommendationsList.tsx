'use client';

import { useState } from 'react';
import { ExternalLink, Save, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import type { EventSuggestion } from '@/types/events';

interface EventRecommendationsListProps {
  events: EventSuggestion[];
  personaId?: string | null;
}

export default function EventRecommendationsList({ events, personaId }: EventRecommendationsListProps) {
  const [saving, setSaving] = useState<string | null>(null);

  const handleSave = async (event: EventSuggestion) => {
    try {
      setSaving(event.name);
      
      // Get userId from Firebase token or localStorage
      const userId = localStorage.getItem('userId') || localStorage.getItem('firebaseUid') || '';

      const response = await api.post('/api/events/save', {
        eventSuggestion: event,
        userId,
        personaId: personaId || null,
      });

      if (response.data?.success) {
        alert('Event saved successfully!');
      } else {
        throw new Error('Failed to save event');
      }
    } catch (err: any) {
      console.error('Error saving event:', err);
      alert(err.response?.data?.error || 'Failed to save event. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 bg-green-50';
    if (score >= 6) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getProducerTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      Association: 'bg-blue-100 text-blue-800',
      Commercial: 'bg-purple-100 text-purple-800',
      Media: 'bg-pink-100 text-pink-800',
      Institution: 'bg-indigo-100 text-indigo-800',
      Corporate: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (events.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Event Recommendations</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event, index) => (
          <div
            key={index}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-all"
          >
            {/* Header */}
            <div className="mb-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900 flex-1 pr-2">
                  {event.name}
                </h3>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${getProducerTypeColor(
                    event.producerType
                  )}`}
                >
                  {event.producerType}
                </span>
              </div>
              <p className="text-sm text-gray-600">{event.organization}</p>
            </div>

            {/* Location & Date */}
            {(event.location || event.dateRange) && (
              <div className="mb-4 text-sm text-gray-500 space-y-1">
                {event.location && <p>📍 {event.location}</p>}
                {event.dateRange && <p>📅 {event.dateRange}</p>}
              </div>
            )}

            {/* Total Score */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Total Score</span>
                <span className={`text-lg font-bold px-3 py-1 rounded ${getScoreColor(event.totalScore)}`}>
                  {event.totalScore}
                </span>
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="mb-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Well-Known</span>
                <span className="font-medium">{event.wellKnownScore}/10</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Attendance</span>
                <span className="font-medium">{event.attendanceScore}/10</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">BD Value</span>
                <span className="font-medium">{event.bdValueScore}/10</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Travel Fit</span>
                <span className="font-medium">{event.travelFitScore}/10</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Cost</span>
                <span className="font-medium">{event.costScore}/10</span>
              </div>
            </div>

            {/* Relevance Reason */}
            <div className="mb-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">{event.relevanceReason}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {event.url && (
                <a
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Visit Website
                </a>
              )}
              <button
                onClick={() => handleSave(event)}
                disabled={saving === event.name}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {saving === event.name ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

