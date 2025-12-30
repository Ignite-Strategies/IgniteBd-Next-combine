'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Users, Building2, Loader2, ArrowLeft, Save } from 'lucide-react';
import api from '@/lib/api';

function BuildFromContactContent() {
  // TEMPORARY: Page load verification
  console.log('🎯 BUILD-FROM-CONTACT PAGE LOADED', {
    time: new Date().toISOString(),
    random: Math.random(),
  });
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  const urlContactId = searchParams?.get('contactId') || '';

  // Contacts list state
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Persona generation state
  const [generating, setGenerating] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [personaGenerated, setPersonaGenerated] = useState(false); // Track if persona has been generated
  const [rawResponse, setRawResponse] = useState(null); // Debug: raw API response

  // Form fields (hydrated from API response)
  const [personName, setPersonName] = useState('');
  const [title, setTitle] = useState('');
  const [companyType, setCompanyType] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [industry, setIndustry] = useState('');
  const [coreGoal, setCoreGoal] = useState('');
  const [painPoints, setPainPoints] = useState('');
  const [whatProductNeeds, setWhatProductNeeds] = useState('');

  // Save state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Fetch contacts on mount
  useEffect(() => {
    if (!companyHQId) {
      setLoadingContacts(false);
      return;
    }

    const fetchContacts = async () => {
      setLoadingContacts(true);
      setError('');
      try {
        const response = await api.get(`/api/contacts?companyHQId=${companyHQId}`);
        if (response.data && Array.isArray(response.data)) {
          // API returns array directly
          setContacts(response.data);
        } else if (response.data?.success && Array.isArray(response.data.contacts)) {
          // API returns { success: true, contacts: [...] }
          setContacts(response.data.contacts);
        } else if (Array.isArray(response.data?.contacts)) {
          // API returns { contacts: [...] }
          setContacts(response.data.contacts);
        } else {
          setError('Failed to load contacts: Invalid response format');
        }
      } catch (err) {
        console.error('Failed to fetch contacts:', err);
        setError(err.response?.data?.error || err.message || 'Failed to load contacts');
      } finally {
        setLoadingContacts(false);
      }
    };

    fetchContacts();
  }, [companyHQId]);

  // Auto-select contact from URL if provided
  useEffect(() => {
    if (urlContactId && contacts.length > 0 && !generating && !selectedContactId && companyHQId) {
      const contactExists = contacts.some(c => c.id === urlContactId);
      if (contactExists) {
        // Auto-select and generate for this contact
        handleContactSelect(urlContactId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlContactId, contacts.length, companyHQId]);

  // Filter contacts
  const filteredContacts = contacts.filter((contact) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
    const email = (contact.email || '').toLowerCase();
    const companyName = (contact.company?.companyName || contact.contactCompany?.companyName || '').toLowerCase();
    return fullName.includes(query) || email.includes(query) || companyName.includes(query);
  });

  // Handle contact selection - generate persona
  const handleContactSelect = async (contactId) => {
    if (!companyHQId || generating) return;

    setGenerating(true);
    setError('');
    setSelectedContactId(contactId);

    // Clear previous form data and hide form
    setPersonName('');
    setTitle('');
    setCompanyType('');
    setCompanySize('');
    setIndustry('');
    setCoreGoal('');
    setPainPoints('');
    setWhatProductNeeds('');
    setRawResponse(null);
    setPersonaGenerated(false);

    try {
      console.log('🚀 Calling /api/personas/generate-minimal with:', { companyHQId, contactId });
      
      // Generate persona - owner is derived from Firebase token
      const response = await api.post('/api/personas/generate-minimal', {
        companyHQId,
        contactId,
      });

      console.log('✅ API Response received:', response.data);
      console.log('📦 Full response object:', JSON.stringify(response.data, null, 2));

      // Store raw response for debugging
      setRawResponse(response.data);

      if (response.data?.success && response.data?.persona) {
        console.log('✅ Persona data:', response.data.persona);
        // Hydrate form fields from API response
        const persona = response.data.persona;
        setPersonName(persona.personName || '');
        setTitle(persona.title || '');
        setCompanyType(persona.companyType || '');
        setCompanySize(persona.companySize || '');
        setIndustry(persona.industry || '');
        setCoreGoal(persona.coreGoal || '');
        setPainPoints(Array.isArray(persona.painPoints) ? persona.painPoints.join('\n') : (persona.painPoints || ''));
        setWhatProductNeeds(persona.whatProductNeeds || '');
        setPersonaGenerated(true); // Show form after persona is generated
      } else {
        console.error('❌ API returned success=false:', response.data);
        setError(response.data?.error || 'Failed to generate persona');
      }
    } catch (err) {
      console.error('❌ Failed to generate persona:', err);
      console.error('❌ Error response:', err.response?.data);
      setRawResponse(err.response?.data || { error: err.message });
      setError(err.response?.data?.error || err.message || 'Failed to generate persona');
    } finally {
      setGenerating(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!companyHQId) {
      setError('Company context is required');
      return;
    }

    if (!personName.trim() || !title.trim() || !companyType.trim() || !companySize.trim() || !industry.trim() || !coreGoal.trim() || !whatProductNeeds.trim()) {
      setError('All required fields must be filled');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Get ownerId from localStorage for save route
      const ownerId = typeof window !== 'undefined' ? localStorage.getItem('ownerId') : null;
      if (!ownerId) {
        throw new Error('Owner ID not found. Please sign in again.');
      }

      // Parse painPoints from textarea (one per line)
      const painPointsArray = painPoints.trim()
        ? painPoints.split('\n').map(p => p.trim()).filter(p => p.length > 0)
        : [];

      const payload = {
        personName: personName.trim(),
        title: title.trim(),
        company: companyType.trim(), // companyType maps to company field
        companySize: companySize.trim(),
        industry: industry.trim(),
        coreGoal: coreGoal.trim(),
        needForOurProduct: whatProductNeeds.trim(),
        painPoints: painPointsArray,
        role: null,
        seniority: null,
        potentialPitch: null,
      };

      const response = await api.post('/api/personas/save', {
        persona: payload,
        companyHQId,
        ownerId,
      });

      if (response.data?.success) {
        router.push(`/personas?companyHQId=${companyHQId}&saved=true`);
      } else {
        setError(response.data?.error || 'Failed to save persona');
      }
    } catch (err) {
      console.error('Failed to save persona:', err);
      setError(err.response?.data?.error || 'Failed to save persona');
    } finally {
      setSaving(false);
    }
  };

  if (!companyHQId) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Company context is required
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Build Persona from Contact</h1>
          <p className="mt-2 text-gray-600">
            Select a contact to generate a persona, then review and save
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Debug: Raw API Response */}
        {rawResponse && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-blue-900">Debug: API Response</h3>
            <pre className="overflow-auto rounded bg-white p-3 text-xs text-gray-800 max-h-64">
              {JSON.stringify(rawResponse, null, 2)}
            </pre>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Contact Selection */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Select Contact</h2>

            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            {/* Loading Contacts */}
            {loadingContacts && (
              <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-red-600" />
                <p className="mt-2 text-sm text-gray-600">Loading contacts...</p>
              </div>
            )}

            {/* Contacts List */}
            {!loadingContacts && (
              <>
                {filteredContacts.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
                    <Users className="mx-auto h-8 w-8 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-600">
                      {searchQuery ? 'No contacts match your search' : 'No contacts available'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredContacts.map((contact) => {
                      const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unnamed';
                      const companyName = contact.company?.companyName || contact.contactCompany?.companyName || 'No Company';
                      const isSelected = selectedContactId === contact.id;
                      const isGenerating = generating && selectedContactId === contact.id;

                      return (
                        <div
                          key={contact.id}
                          onClick={() => !generating && handleContactSelect(contact.id)}
                          className={`cursor-pointer rounded-lg border-2 p-3 transition ${
                            isGenerating
                              ? 'border-red-300 bg-red-50 cursor-wait'
                              : isSelected
                              ? 'border-red-500 bg-red-50'
                              : 'border-gray-200 bg-white hover:border-red-300 hover:bg-red-50'
                          } ${generating && !isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-gray-900 truncate">{fullName}</h3>
                              {contact.title && (
                                <p className="text-xs text-gray-600 truncate">{contact.title}</p>
                              )}
                              <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                                <Building2 className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{companyName}</span>
                              </div>
                            </div>
                            {isGenerating && (
                              <Loader2 className="h-4 w-4 animate-spin text-red-600 flex-shrink-0 ml-2" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right: Persona Form - Only show after persona is generated */}
          {personaGenerated ? (
            <div>
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Persona Details</h2>

              <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
                {/* Person Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Persona Name *
                  </label>
                  <input
                    type="text"
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    disabled={generating}
                  />
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    disabled={generating}
                  />
                </div>

                {/* Company Type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Company Type *
                  </label>
                  <input
                    type="text"
                    value={companyType}
                    onChange={(e) => setCompanyType(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    disabled={generating}
                  />
                </div>

                {/* Company Size */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Company Size *
                  </label>
                  <input
                    type="text"
                    value={companySize}
                    onChange={(e) => setCompanySize(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    disabled={generating}
                  />
                </div>

                {/* Industry */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Industry *
                  </label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    disabled={generating}
                  />
                </div>

                {/* Core Goal */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Core Goal *
                  </label>
                  <textarea
                    value={coreGoal}
                    onChange={(e) => setCoreGoal(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    disabled={generating}
                  />
                </div>

                {/* Pain Points */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Pain Points *
                  </label>
                  <textarea
                    value={painPoints}
                    onChange={(e) => setPainPoints(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    disabled={generating}
                  />
                </div>

                {/* What Product Needs */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    What Product Needs *
                  </label>
                  <textarea
                    value={whatProductNeeds}
                    onChange={(e) => setWhatProductNeeds(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    disabled={generating}
                  />
                </div>

              {/* Save Button */}
              <div className="pt-4">
                <button
                  onClick={handleSave}
                  disabled={saving || generating || !personName.trim() || !title.trim() || !companyType.trim() || !companySize.trim() || !industry.trim() || !coreGoal.trim() || !whatProductNeeds.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Persona
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          ) : (
            <div>
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Persona Details</h2>
              <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
                <p className="text-sm text-gray-600">Select a contact to generate a persona</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BuildFromContactPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-red-600" />
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <BuildFromContactContent />
    </Suspense>
  );
}

