'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Plus, Edit2, Trash2, DollarSign, MapPin, Calendar, Loader2, Sparkles, X, FileText } from 'lucide-react';
import api from '@/lib/api';
import PersonaSearch from '../build-from-persona/PersonaSearch';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DC', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

interface Persona {
  id: string;
  personName?: string;
  title?: string;
  industry?: string;
  location?: string;
}

interface EventTuner {
  id: string;
  name: string;
  conferencesPerQuarter?: number | null;
  costRange?: string | null;
  travelDistance?: string | null;
  eventSearchRawText?: string | null;
  createdAt: string;
  event_tuner_states?: { state: string }[];
  event_tuner_personas?: { personas: Persona }[];
}

const EventPickerPageContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [tuners, setTuners] = useState<EventTuner[]>([]);
  const [loadingTuners, setLoadingTuners] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedTunerId, setSelectedTunerId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [costRange, setCostRange] = useState<string>('');
  const [travelDistance, setTravelDistance] = useState<string>('');
  const [preferredStates, setPreferredStates] = useState<string[]>([]);
  const [eventSearchRawText, setEventSearchRawText] = useState('');
  const [conferencesPerQuarter, setConferencesPerQuarter] = useState<number | ''>('');
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [additionalContext, setAdditionalContext] = useState(''); // NEW: Additional context for AI
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

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

  // Load preference - just set the title, don't clobber the form
  const handleSelectPreference = (tuner: EventTuner) => {
    setSelectedTunerId(tuner.id);
    // Only load the title - keep the form clean
    setName(tuner.name || '');
    // Clear additional context when selecting a preference
    setAdditionalContext('');
  };

  const clearForm = () => {
    setSelectedTunerId(null);
    setName('');
    setCostRange('');
    setTravelDistance('');
    setPreferredStates([]);
    setEventSearchRawText('');
    setConferencesPerQuarter('');
    setSelectedPersona(null);
    setAdditionalContext('');
  };

  const toggleState = (state: string) => {
    setPreferredStates(prev =>
      prev.includes(state)
        ? prev.filter(s => s !== state)
        : [...prev, state]
    );
  };

  const handleGenerateEvents = async () => {
    if (!ownerId || !companyHQId) {
      alert('Please ensure you are logged in and have a company selected.');
      return;
    }

    try {
      setGenerating(true);
      setGenerationError(null);

      let tunerId: string;
      
      if (selectedTunerId) {
        // Use the selected preference - don't update it, just use it
        tunerId = selectedTunerId;
        
        // If additional context was provided, update the tuner with it
        if (additionalContext.trim()) {
          // Load the tuner to get current search text
          const tunerResponse = await api.get(`/api/event-tuners/${selectedTunerId}`);
          const currentSearchText = tunerResponse.data?.tuner?.eventSearchRawText || '';
          const combinedSearchText = currentSearchText 
            ? `${currentSearchText}. Additional context: ${additionalContext.trim()}`
            : `Additional context: ${additionalContext.trim()}`;
          
          await api.patch(`/api/event-tuners/${selectedTunerId}`, {
            eventSearchRawText: combinedSearchText,
          });
        }
      } else {
        // Create new tuner from form
        if (!name.trim()) {
          alert('Please enter a title for your event preferences');
          setGenerating(false);
          return;
        }

        const response = await api.post('/api/event-tuners/create', {
          companyHQId,
          ownerId,
          name: name.trim(),
          costRange: costRange || null,
          travelDistance: travelDistance || null,
          preferredStates: preferredStates.length > 0 ? preferredStates : undefined,
          eventSearchRawText: eventSearchRawText.trim() || (additionalContext.trim() ? `Additional context: ${additionalContext.trim()}` : null),
          conferencesPerQuarter: conferencesPerQuarter ? Number(conferencesPerQuarter) : null,
          personaIds: selectedPersona ? [selectedPersona.id] : undefined,
        });

        if (!response.data?.success) {
          throw new Error('Failed to save preferences');
        }
        tunerId = response.data.tuner.id;
      }

      // If additional context is provided, append it to eventSearchRawText for OpenAI
      let finalSearchText = eventSearchRawText.trim();
      if (additionalContext.trim()) {
        finalSearchText = finalSearchText 
          ? `${finalSearchText}. Additional context: ${additionalContext.trim()}`
          : `Additional context: ${additionalContext.trim()}`;
        
        // Update the tuner with combined search text
        await api.patch(`/api/event-tuners/${tunerId}`, {
          eventSearchRawText: finalSearchText,
        });
      }

      // Now call OpenAI to generate events
      const response = await api.get(`/api/event-tuners/${tunerId}/pick-events`);

      if (response.data?.success) {
      // Store generated events in localStorage (temporary state)
      const eventsData = {
        eventPickerModel: response.data.eventPickerModel || [],
        tunerId: tunerId,
      };
      localStorage.setItem('tempPickedEvents', JSON.stringify(eventsData));

        // Navigate AFTER successful generation
        const url = companyHQId 
          ? `/events/search-pick/${tunerId}?tunerId=${tunerId}&companyHQId=${companyHQId}`
          : `/events/search-pick/${tunerId}?tunerId=${tunerId}`;
        router.push(url);
      } else {
        throw new Error(response.data?.error || 'Failed to generate events');
      }
    } catch (err: any) {
      console.error('Failed to generate events:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to generate events. Please try again.';
      setGenerationError(errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteTuner = async (tunerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete these preferences? This cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(tunerId);
      await api.delete(`/api/event-tuners/${tunerId}`);
      
      // If deleted tuner was selected, clear form
      if (selectedTunerId === tunerId) {
        clearForm();
      }
      
      await loadTuners();
    } catch (err: any) {
      console.error('Error deleting tuner:', err);
      alert(err.response?.data?.error || 'Failed to delete preferences. Please try again.');
    } finally {
      setDeletingId(null);
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
      {/* Loading Overlay - Following OpenAI Pattern */}
      {generating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-30 backdrop-blur-sm">
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-xl max-w-md mx-4">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-red-600" />
            <p className="mt-4 text-lg font-semibold text-gray-900">Generating Your Events...</p>
            <p className="mt-2 text-sm text-gray-600">This may take a moment. We're finding events that match your preferences.</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {generationError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="rounded-lg border border-red-200 bg-white p-6 text-center shadow-xl max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-red-900">Error Generating Events</h3>
              <button
                onClick={() => setGenerationError(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-red-700 mb-4">{generationError}</p>
            <button
              onClick={() => setGenerationError(null)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Pick Your Events"
          subtitle="Fill out your preferences below or select from saved preferences on the right"
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form - Left/Center (2/3 width) */}
          <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Event Preferences</h2>

              {generationError && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-sm font-medium text-red-900">{generationError}</p>
                </div>
              )}

              <div className="space-y-6">
                {/* Title */}
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="title"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Q1 2025 Events, West Coast Conferences"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                  />
                </div>

                {/* Body (from template) - This is the preferences form */}
                <div className="space-y-4">
                  {/* Cost Range */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Cost Range
                    </label>
                    <select
                      value={costRange}
                      onChange={(e) => setCostRange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                    >
                      <option value="">No limit</option>
                      <option value="FREE">Free</option>
                      <option value="LOW_0_500">Low ($0-$500)</option>
                      <option value="MEDIUM_500_2000">Medium ($500-$2,000)</option>
                      <option value="HIGH_2000_5000">High ($2,000-$5,000)</option>
                      <option value="PREMIUM_5000_PLUS">Premium ($5,000+)</option>
                    </select>
                  </div>

                  {/* Travel Distance */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Travel Distance
                    </label>
                    <select
                      value={travelDistance}
                      onChange={(e) => setTravelDistance(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                    >
                      <option value="">No limit</option>
                      <option value="LOCAL">Local</option>
                      <option value="REGIONAL">Regional</option>
                      <option value="DOMESTIC">Domestic</option>
                      <option value="INTERNATIONAL">International</option>
                    </select>
                  </div>

                  {/* Preferred States */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preferred States (Optional)
                    </label>
                    <div className="grid grid-cols-5 md:grid-cols-10 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                      {US_STATES.map((state) => (
                        <label
                          key={state}
                          className={`cursor-pointer px-2 py-1 text-center text-xs font-medium rounded border-2 transition-colors ${
                            preferredStates.includes(state)
                              ? 'bg-red-600 text-white border-red-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={preferredStates.includes(state)}
                            onChange={() => toggleState(state)}
                            className="sr-only"
                          />
                          {state}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Search Keywords */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Search Keywords (Optional)
                    </label>
                    <input
                      type="text"
                      value={eventSearchRawText}
                      onChange={(e) => setEventSearchRawText(e.target.value)}
                      placeholder="e.g., fintech, healthcare, startup"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                    />
                  </div>

                  {/* Conferences Per Quarter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Conferences Per Quarter (Optional)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={conferencesPerQuarter}
                      onChange={(e) => setConferencesPerQuarter(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="e.g., 4"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                    />
                  </div>

                  {/* Persona Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Persona (Optional)
                    </label>
                    <PersonaSearch
                      selectedPersona={selectedPersona}
                      onSelectPersona={setSelectedPersona}
                    />
                  </div>
                </div>

                {/* Add additional context for AI (NEW) */}
                <div>
                  <label htmlFor="additionalContext" className="block text-sm font-medium text-gray-700 mb-2">
                    Add Additional Context for AI (Optional)
                  </label>
                  <textarea
                    id="additionalContext"
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    placeholder="e.g., Focus on events with strong networking opportunities, prefer events in tech hubs, looking for speaking opportunities..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Provide any additional context that will help AI find better events for you.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={clearForm}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleGenerateEvents}
                    disabled={generating || !name.trim()}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Get Events
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Preferences Sidebar - Right (1/3 width) */}
          <div className="lg:col-span-1">
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm sticky top-8">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Saved Preferences
                  </h3>
                  <button
                    onClick={clearForm}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    New
                  </button>
                </div>
              </div>
              <div className="p-4 max-h-[calc(100vh-12rem)] overflow-y-auto">
                {loadingTuners ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    <span className="ml-2 text-xs text-gray-600">Loading...</span>
                  </div>
                ) : tuners.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">No saved preferences</p>
                    <p className="text-xs text-gray-400 mt-1">Create one to get started</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tuners.map((tuner) => (
                      <div
                        key={tuner.id}
                        className={`group cursor-pointer rounded-lg border-2 p-3 transition-all ${
                          selectedTunerId === tuner.id
                            ? 'border-red-500 bg-red-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                        onClick={() => handleSelectPreference(tuner)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-900 flex-1">{tuner.name}</h4>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Navigate to edit page
                                const url = companyHQId 
                                  ? `/events/preferences?tunerId=${tuner.id}&companyHQId=${companyHQId}`
                                  : `/events/preferences?tunerId=${tuner.id}`;
                                router.push(url);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteTuner(tuner.id, e)}
                              disabled={deletingId === tuner.id}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                              title="Delete"
                            >
                              {deletingId === tuner.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </div>
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
                              <span>{tuner.conferencesPerQuarter} per quarter</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function EventPickerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-8">
            <Loader2 className="animate-spin h-6 w-6 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <EventPickerPageContent />
    </Suspense>
  );
}
