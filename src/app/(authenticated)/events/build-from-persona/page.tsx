'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';
import { UserCircle, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';

export default function BuildFromPersonaPage() {
  const router = useRouter();
  const [personas, setPersonas] = useState([]);
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [mode, setMode] = useState<'select' | 'quick'>('select');

  // Quick persona form state
  const [quickPersona, setQuickPersona] = useState({
    title: '',
    industry: '',
    region: '',
    investmentFocus: '',
  });

  // Filter state
  const [priorityFilters, setPriorityFilters] = useState<string[]>([]);
  const [travelPreference, setTravelPreference] = useState('anywhere');
  const [budgetPreference, setBudgetPreference] = useState('standard');
  const [userRegion, setUserRegion] = useState<string | null>(null);

  useEffect(() => {
    loadPersonas();
    // Try to get user region from localStorage or company data
    const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
    if (companyHQId) {
      // Could fetch company data to get region, but for now use a placeholder
      setUserRegion(null);
    }
  }, []);

  const loadPersonas = async () => {
    try {
      setLoading(true);
      const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
      
      if (!companyHQId) {
        console.warn('No companyHQId found');
        setLoading(false);
        return;
      }

      const response = await api.get(`/api/personas?companyHQId=${companyHQId}`);
      if (response.data && Array.isArray(response.data)) {
        setPersonas(response.data);
      }
    } catch (err) {
      console.error('Error loading personas:', err);
      alert('Failed to load personas. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const priorityFilterOptions = [
    { id: 'well-known', label: 'Most well-known' },
    { id: 'well-attended', label: 'Most well-attended' },
    { id: 'bd-exposure', label: 'Biggest BD exposure' },
    { id: 'local-travel', label: 'Local / Easy travel' },
    { id: 'cost-effective', label: 'Cost-effective' },
    { id: 'allocator-density', label: 'Top allocator density' },
    { id: 'gp-density', label: 'Top GP/dealflow density' },
  ];

  const togglePriorityFilter = (filterId: string) => {
    setPriorityFilters((prev) =>
      prev.includes(filterId)
        ? prev.filter((f) => f !== filterId)
        : [...prev, filterId]
    );
  };

  const handleGenerate = async () => {
    // Validate persona
    if (mode === 'select' && !selectedPersona) {
      alert('Please select a persona first');
      return;
    }

    if (mode === 'quick') {
      if (!quickPersona.title || !quickPersona.industry) {
        alert('Please fill in at least Title and Industry for quick persona');
        return;
      }
    }

    // Validate filters
    if (priorityFilters.length === 0) {
      alert('Please select at least one priority filter');
      return;
    }

    try {
      setGenerating(true);

      // Build persona object
      const personaToUse = mode === 'select' 
        ? selectedPersona
        : {
            title: quickPersona.title,
            industry: quickPersona.industry,
            location: quickPersona.region,
            description: `Quick persona: ${quickPersona.title} in ${quickPersona.industry}`,
            whatTheyWant: quickPersona.investmentFocus,
          };

      // Call recommendation API
      const response = await api.post('/api/events/recommend', {
        persona: personaToUse,
        filters: {
          priorityTypes: priorityFilters,
          travelPreference,
          budgetPreference,
        },
        userRegion,
      });

      if (response.data?.success && response.data.events) {
        // Store results in sessionStorage and navigate
        sessionStorage.setItem('eventRecommendations', JSON.stringify(response.data.events));
        sessionStorage.setItem('eventPersona', JSON.stringify(personaToUse));
        sessionStorage.setItem('eventFilters', JSON.stringify({
          priorityTypes: priorityFilters,
          travelPreference,
          budgetPreference,
        }));
        router.push('/events/results');
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
          subtitle="Select a persona or create a quick one, then configure filters to generate event recommendations"
          backTo="/events"
          backLabel="Back to Events"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Persona Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Mode Toggle */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex gap-4 mb-6">
                <button
                  onClick={() => setMode('select')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                    mode === 'select'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Select Existing Persona
                </button>
                <button
                  onClick={() => setMode('quick')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                    mode === 'quick'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Quick Persona Input
                </button>
              </div>

              {mode === 'select' ? (
                <div>
                  {loading ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600">Loading personas...</p>
                    </div>
                  ) : personas.length === 0 ? (
                    <div className="text-center py-8">
                      <UserCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-lg font-semibold text-gray-800 mb-2">No personas found</p>
                      <p className="text-sm text-gray-500 mb-4">
                        Create personas first or use Quick Persona Input
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {personas.map((persona: any) => (
                        <div
                          key={persona.id}
                          onClick={() => setSelectedPersona(persona)}
                          className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                            selectedPersona?.id === persona.id
                              ? 'border-red-500 bg-red-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="radio"
                              checked={selectedPersona?.id === persona.id}
                              onChange={() => setSelectedPersona(persona)}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900">
                                {persona.personName || persona.title || 'Untitled Persona'}
                              </h4>
                              {persona.title && (
                                <p className="text-sm text-gray-600 mt-1">{persona.title}</p>
                              )}
                              {persona.industry && (
                                <p className="text-sm text-gray-500 mt-1">Industry: {persona.industry}</p>
                              )}
                              {persona.location && (
                                <p className="text-sm text-gray-500">Location: {persona.location}</p>
                              )}
                            </div>
                            {selectedPersona?.id === persona.id && (
                              <CheckCircle2 className="h-5 w-5 text-red-600 flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={quickPersona.title}
                      onChange={(e) => setQuickPersona({ ...quickPersona, title: e.target.value })}
                      placeholder="e.g., Chief Investment Officer"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Industry *
                    </label>
                    <input
                      type="text"
                      value={quickPersona.industry}
                      onChange={(e) => setQuickPersona({ ...quickPersona, industry: e.target.value })}
                      placeholder="e.g., Private Equity, Healthcare"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Region
                    </label>
                    <input
                      type="text"
                      value={quickPersona.region}
                      onChange={(e) => setQuickPersona({ ...quickPersona, region: e.target.value })}
                      placeholder="e.g., New York, US"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Investment Focus
                    </label>
                    <textarea
                      value={quickPersona.investmentFocus}
                      onChange={(e) => setQuickPersona({ ...quickPersona, investmentFocus: e.target.value })}
                      placeholder="e.g., Growth-stage companies, B2B SaaS, Healthcare tech"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Filters Panel */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sticky top-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>

              {/* Priority Filters */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Priority Filters *
                </label>
                <div className="space-y-2">
                  {priorityFilterOptions.map((option) => (
                    <label
                      key={option.id}
                      className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={priorityFilters.includes(option.id)}
                        onChange={() => togglePriorityFilter(option.id)}
                        className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Travel Preference */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Travel Preference
                </label>
                <div className="space-y-2">
                  {[
                    { id: 'anywhere', label: 'Will travel anywhere' },
                    { id: 'domestic', label: 'Only domestic' },
                    { id: 'major-hubs', label: 'Only major hubs' },
                    { id: 'near-me', label: 'Near me' },
                  ].map((option) => (
                    <label
                      key={option.id}
                      className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50"
                    >
                      <input
                        type="radio"
                        name="travel"
                        value={option.id}
                        checked={travelPreference === option.id}
                        onChange={(e) => setTravelPreference(e.target.value)}
                        className="border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Budget Preference */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Budget Preference
                </label>
                <div className="space-y-2">
                  {[
                    { id: 'budget', label: 'Budget' },
                    { id: 'standard', label: 'Standard' },
                    { id: 'premium', label: 'Premium' },
                  ].map((option) => (
                    <label
                      key={option.id}
                      className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50"
                    >
                      <input
                        type="radio"
                        name="budget"
                        value={option.id}
                        checked={budgetPreference === option.id}
                        onChange={(e) => setBudgetPreference(e.target.value)}
                        className="border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={generating || priorityFilters.length === 0}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Generate Events
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

