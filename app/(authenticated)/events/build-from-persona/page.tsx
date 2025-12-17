'use client';

import { useState } from 'react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';
import PersonaSearch from './PersonaSearch';
import EventFilters from './EventFilters';
import EventRecommendationsList from './EventRecommendationsList';
import type { EventSuggestion } from '@/types/events';

interface Persona {
  id: string;
  personName?: string;
  title?: string;
  industry?: string;
  location?: string;
}

export default function BuildFromPersonaPage() {
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [events, setEvents] = useState<EventSuggestion[]>([]);
  const [generating, setGenerating] = useState(false);

  // Filter state
  const [priorityFilters, setPriorityFilters] = useState<string[]>([]);
  const [travelPreference, setTravelPreference] = useState('anywhere');
  const [budgetPreference, setBudgetPreference] = useState('standard');
  const [userRegion, setUserRegion] = useState<string | null>(null);

  const togglePriorityFilter = (filterId: string) => {
    setPriorityFilters((prev) =>
      prev.includes(filterId)
        ? prev.filter((f) => f !== filterId)
        : [...prev, filterId]
    );
  };

  const handleGenerate = async () => {
    // Validate persona
    if (!selectedPersona) {
      alert('Please select a persona first');
      return;
    }

    // Validate filters
    if (priorityFilters.length === 0) {
      alert('Please select at least one priority filter');
      return;
    }

    try {
      setGenerating(true);

      // Call recommendation API
      const response = await api.post('/api/events/recommend', {
        persona: selectedPersona,
        filters: {
          priorityTypes: priorityFilters,
          travelPreference,
          budgetPreference,
        },
        userRegion,
      });

      if (response.data?.success && response.data.events) {
        setEvents(response.data.events);
        // Scroll to results
        setTimeout(() => {
          const resultsElement = document.getElementById('event-results');
          if (resultsElement) {
            resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      } else {
        throw new Error('Failed to generate recommendations');
      }
    } catch (err: any) {
      console.error('Error generating events:', err);
      alert(err.response?.data?.error || err.message || 'Failed to generate event recommendations. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Build from Persona"
          subtitle="Select a persona and configure filters to generate event recommendations"
          backTo="/events"
          backLabel="Back to Events"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Persona Selection */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Persona</h3>
              <PersonaSearch
                selectedPersona={selectedPersona}
                onSelectPersona={setSelectedPersona}
              />
            </div>
          </div>

          {/* Right: Filters Panel */}
          <div className="lg:col-span-1">
            <EventFilters
              priorityFilters={priorityFilters}
              onTogglePriorityFilter={togglePriorityFilter}
              travelPreference={travelPreference}
              onTravelPreferenceChange={setTravelPreference}
              budgetPreference={budgetPreference}
              onBudgetPreferenceChange={setBudgetPreference}
              onGenerate={handleGenerate}
              generating={generating}
            />
          </div>
        </div>

        {/* Results Section */}
        {events.length > 0 && (
          <div id="event-results" className="mt-12">
            <EventRecommendationsList events={events} personaId={selectedPersona?.id} />
          </div>
        )}
      </div>
    </div>
  );
}
