'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { DollarSign, MapPin, Search, Calendar, Users } from 'lucide-react';
import api from '@/lib/api';
import PersonaSearch from '../build-from-persona/PersonaSearch';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
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
  event_tuner_states?: { state: string }[];
  event_tuner_personas?: { personas: Persona }[];
}

export default function PreferencesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  
  // Direct read from localStorage - NO HOOKS
  const [ownerId, setOwnerId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('ownerId');
    if (stored) setOwnerId(stored);
  }, []);
  const [loading, setLoading] = useState(true);
  const [existingTunerId, setExistingTunerId] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [costRange, setCostRange] = useState<string>('');
  const [travelDistance, setTravelDistance] = useState<string>('');
  const [preferredStates, setPreferredStates] = useState<string[]>([]);
  const [eventSearchRawText, setEventSearchRawText] = useState('');
  const [conferencesPerQuarter, setConferencesPerQuarter] = useState<number | ''>('');
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ownerId && companyHQId) {
      loadPreviousTuner();
    }
  }, [ownerId, companyHQId]);

  const loadPreviousTuner = async () => {
    try {
      setLoading(true);
      if (!companyHQId || !ownerId) return;

      // Get the most recent active tuner
      const response = await api.get(`/api/event-tuners/list?companyHQId=${companyHQId}&ownerId=${ownerId}&isActive=true`);
      
      if (response.data?.success && response.data.tuners && response.data.tuners.length > 0) {
        const tuner = response.data.tuners[0]; // Most recent
        setExistingTunerId(tuner.id);
        
        // Populate form with existing tuner data
        setName(tuner.name || '');
        setCostRange(tuner.costRange || '');
        setTravelDistance(tuner.travelDistance || '');
        setEventSearchRawText(tuner.eventSearchRawText || '');
        setConferencesPerQuarter(tuner.conferencesPerQuarter || '');
        setPreferredStates(tuner.event_tuner_states?.map(ps => ps.state) || []);
        
        // Set persona if exists
        if (tuner.event_tuner_personas && tuner.event_tuner_personas.length > 0) {
          setSelectedPersona(tuner.event_tuner_personas[0].personas);
        }
      }
    } catch (err: any) {
      console.error('Error loading previous tuner:', err);
      // Don't show error - just proceed with new preferences
    } finally {
      setLoading(false);
    }
  };

  const toggleState = (state: string) => {
    setPreferredStates(prev =>
      prev.includes(state)
        ? prev.filter(s => s !== state)
        : [...prev, state]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a name for your preferences');
      return;
    }

    if (!ownerId || !companyHQId) {
      alert('Please ensure you are logged in and have a company selected.');
      return;
    }

    try {
      setSaving(true);

      if (existingTunerId) {
        // TODO: Update existing tuner instead of creating new one
        // For now, create a new one (we'll add update endpoint later)
      }

      // Create/Update EventTuner (this IS the preferences)
      const response = await api.post('/api/event-tuners/create', {
        companyHQId,
        ownerId,
        name: name.trim(),
        costRange: costRange || null,
        travelDistance: travelDistance || null,
        preferredStates: preferredStates.length > 0 ? preferredStates : undefined,
        eventSearchRawText: eventSearchRawText.trim() || null,
        conferencesPerQuarter: conferencesPerQuarter ? Number(conferencesPerQuarter) : null,
        personaIds: selectedPersona ? [selectedPersona.id] : undefined,
      });

      if (response.data?.success) {
        const tunerId = response.data.tuner.id;
        // Redirect to ready-to-plan with the tuner ID
        router.push(`/events/ready-to-plan?tunerId=${tunerId}`);
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (err: any) {
      console.error('Error saving preferences:', err);
      alert(err.response?.data?.error || 'Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!hydrated || loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Set Preferences"
          subtitle="Name your preference based on something you can remember. You can have more preferences later or edit this same version."
          backTo="/events"
          backLabel="Back to Events"
        />

        {existingTunerId && (
          <div className="mt-4 mb-6 rounded-lg bg-blue-50 border border-blue-200 p-4">
            <p className="text-sm text-blue-800">
              <strong>Previous preferences loaded.</strong> You can update them here. This gets us started to help you choose your events.
            </p>
          </div>
        )}

        <div className="mt-8 space-y-6">
          {/* Preference Name */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Preference Name</h3>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q1 2025 Preferences, West Coast Events, Budget-Friendly"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
            />
            <p className="text-sm text-gray-500 mt-2">
              Give your preferences a name you can remember. You can create more preferences later or edit this one.
            </p>
          </div>

          {/* Cost Range */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Cost Range
            </h3>
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
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Travel Distance
            </h3>
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
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Preferred States (Optional)
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Select states where you'd like events to be located. Leave empty for any location.
            </p>
            <div className="grid grid-cols-5 md:grid-cols-10 gap-2 max-h-64 overflow-y-auto">
              {US_STATES.map((state) => (
                <label
                  key={state}
                  className={`cursor-pointer px-3 py-2 text-center text-sm font-medium rounded-lg border-2 transition-colors ${
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
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Keywords (Optional)
            </h3>
            <input
              type="text"
              value={eventSearchRawText}
              onChange={(e) => setEventSearchRawText(e.target.value)}
              placeholder="e.g., fintech, healthcare, startup"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
            />
          </div>

          {/* Conferences Per Quarter */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Conferences Per Quarter (Optional)
            </h3>
            <input
              type="number"
              min="1"
              value={conferencesPerQuarter}
              onChange={(e) => setConferencesPerQuarter(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="e.g., 4"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
            />
          </div>

          {/* Persona Selection (Optional) */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="h-5 w-5" />
              Persona (Optional)
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Select a persona to prioritize events with BD intelligence signals
            </p>
            <PersonaSearch
              selectedPersona={selectedPersona}
              onSelectPersona={setSelectedPersona}
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Preferences & Ready to Plan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
