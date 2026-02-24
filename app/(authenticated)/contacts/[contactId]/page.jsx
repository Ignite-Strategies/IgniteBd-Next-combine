'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Phone, Building2, ArrowLeft, Sparkles, X, Edit2, Check, X as XIcon, Loader2, UserCircle, Users, Eye, List, Wand2 } from 'lucide-react';
import api from '@/lib/api';
import PageHeader from '@/components/PageHeader.jsx';
import { useContactsContext } from '@/hooks/useContacts';
import ContactOutlook from '@/components/enrichment/ContactOutlook';
import CompanySelector from '@/components/CompanySelector';

export default function ContactDetailPage({ params }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || (typeof window !== 'undefined' ? localStorage.getItem('companyHQId') : '') || '';
  const { contacts, refreshContacts } = useContactsContext();
  const [lists, setLists] = useState([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contact, setContact] = useState(null);
  const [contactId, setContactId] = useState(null);

  // Handle params (may be sync or async in Next.js)
  useEffect(() => {
    const resolveParams = async () => {
      if (params && typeof params.then === 'function') {
        // Params is a Promise (Next.js 15+)
        const resolvedParams = await params;
        setContactId(resolvedParams?.contactId);
      } else if (params?.contactId) {
        // Params is an object
        setContactId(params.contactId);
      }
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!contactId) return;

    let isMounted = true;
    const loadContact = async () => {
      try {
        setLoading(true);
        setError('');
        
        // Try to find in cached contacts first (fast initial render)
        const cachedContact = contacts.find((item) => item.id === contactId);
        if (cachedContact && isMounted) {
          setContact(cachedContact);
          setNotesText(cachedContact.notes || '');
          setLoading(false); // Show cached data immediately
        }

        // Fetch fresh data from API
        try {
          const response = await api.get(`/api/contacts/${contactId}`);
          if (!isMounted) return;
          
          if (response.data?.success && response.data.contact) {
            setContact(response.data.contact);
            setNotesText(response.data.contact.notes || '');
            setLoading(false);
            // Don't call refreshContacts here - it causes infinite loops
            // The contact detail is already fresh, no need to refresh the list
          } else {
            if (!cachedContact && isMounted) {
              const errorMsg = response.data?.error || response.data?.details || 'Contact not found.';
              console.error('API returned error:', response.data);
              setError(errorMsg);
              setLoading(false);
            }
          }
        } catch (apiErr) {
          console.error('Error fetching contact from API:', apiErr);
          console.error('Error details:', {
            message: apiErr?.message,
            status: apiErr?.status,
            type: apiErr?.type,
            response: apiErr?.response?.data,
            stack: apiErr?.stack,
          });
          
          // If we have cached contact, keep showing it even if API fails
          if (!cachedContact && isMounted) {
            // Extract error message from various possible error formats
            const errorMsg = 
              apiErr?.response?.data?.error ||
              apiErr?.response?.data?.details ||
              apiErr?.message ||
              apiErr?.type ||
              'Unable to load contact details.';
            
            // Include status code if available for debugging
            const statusCode = apiErr?.status || apiErr?.response?.status;
            const fullErrorMsg = statusCode 
              ? `${errorMsg} (Status: ${statusCode})`
              : errorMsg;
            
            setError(fullErrorMsg);
            setLoading(false);
          } else if (isMounted) {
            setLoading(false); // We have cached data, just stop loading
          }
        }
      } catch (err) {
        console.error('Error loading contact:', err);
        if (!isMounted) return;
        const cachedContact = contacts.find((item) => item.id === contactId);
        if (!cachedContact) {
          setError('Unable to load contact details.');
          setLoading(false);
        }
      }
    };

    loadContact();
    return () => {
      isMounted = false;
    };
    // Only depend on contactId - remove contacts and refreshContacts to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState('');
  const [enrichingCareer, setEnrichingCareer] = useState(false);
  const [careerEnrichError, setCareerEnrichError] = useState('');
  const [showRawJSON, setShowRawJSON] = useState(false);
  const [rawJSON, setRawJSON] = useState(null);
  const [editingCompany, setEditingCompany] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [savingCompany, setSavingCompany] = useState(false);
  const [editingStage, setEditingStage] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [savingStage, setSavingStage] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [showAddToListModal, setShowAddToListModal] = useState(false);
  const [showEnrichmentDetails, setShowEnrichmentDetails] = useState(false);
  const [editingPersona, setEditingPersona] = useState(false);
  const [selectedPersonaSlug, setSelectedPersonaSlug] = useState(null);
  const [savingPersona, setSavingPersona] = useState(false);
  const [suggestingPersona, setSuggestingPersona] = useState(false);
  const [personaSuggestion, setPersonaSuggestion] = useState(null);
  const [showPersonaSuggestionModal, setShowPersonaSuggestionModal] = useState(false);
  const [availablePersonas, setAvailablePersonas] = useState([]);
  const [loadingPersonas, setLoadingPersonas] = useState(false);
  const [lastEmail, setLastEmail] = useState(null);
  const [loadingLastEmail, setLoadingLastEmail] = useState(false);
  const [buildingEmail, setBuildingEmail] = useState(false);
  
  // Load last email send info
  useEffect(() => {
    if (!contactId) return;
    
    setLoadingLastEmail(true);
    api.get(`/api/contacts/${contactId}/email-history`)
      .then((response) => {
        if (response.data?.success && response.data.activities?.length > 0) {
          // Get most recent email
          const mostRecent = response.data.activities[0];
          setLastEmail(mostRecent);
          // Store all emails for snippets
          setEmailHistory(response.data.activities);
        } else {
          setLastEmail(null);
          setEmailHistory([]);
        }
      })
      .catch((error) => {
        console.error('Error loading email history:', error);
        setLastEmail(null);
        setEmailHistory([]);
      })
      .finally(() => {
        setLoadingLastEmail(false);
      });
  }, [contactId]);
  
  // Load contact lists when modal opens
  useEffect(() => {
    if (showAddToListModal && lists.length === 0 && !loadingLists) {
      setLoadingLists(true);
      api.get('/api/contact-lists')
        .then((response) => {
          if (response.data?.success && Array.isArray(response.data.lists)) {
            setLists(response.data.lists);
          }
        })
        .catch((error) => {
          console.error('Error loading contact lists:', error);
        })
        .finally(() => {
          setLoadingLists(false);
        });
    }
  }, [showAddToListModal, lists.length, loadingLists]);

  // Load available personas when editing persona
  useEffect(() => {
    if (editingPersona && availablePersonas.length === 0 && !loadingPersonas) {
      setLoadingPersonas(true);
      api.get('/api/outreach-personas')
        .then((response) => {
          if (response.data?.success && Array.isArray(response.data.personas)) {
            setAvailablePersonas(response.data.personas);
          }
        })
        .catch((error) => {
          console.error('Error loading personas:', error);
        })
        .finally(() => {
          setLoadingPersonas(false);
        });
    }
  }, [editingPersona, availablePersonas.length, loadingPersonas]);

  // Set selected persona when contact loads
  useEffect(() => {
    if (contact?.outreachPersonaSlug) {
      setSelectedPersonaSlug(contact.outreachPersonaSlug);
    }
  }, [contact?.outreachPersonaSlug]);

  const handleSuggestPersona = async () => {
    if (!contactId) return;
    
    setSuggestingPersona(true);
    try {
      const response = await api.post(`/api/contacts/${contactId}/suggest-persona`, {
        note: editingNotes ? notesText : undefined, // Use current notes text if editing
      });
      
      if (response.data?.success) {
        setPersonaSuggestion(response.data);
        setShowPersonaSuggestionModal(true);
      } else {
        alert(response.data?.error || 'Failed to suggest persona');
      }
    } catch (error) {
      console.error('Error suggesting persona:', error);
      alert(error.response?.data?.error || 'Failed to suggest persona');
    } finally {
      setSuggestingPersona(false);
    }
  };

  const handleApplySuggestedPersona = async () => {
    if (!personaSuggestion?.suggestedPersonaSlug || !contactId) return;
    
    setSavingPersona(true);
    try {
      const response = await api.put(`/api/contacts/${contactId}`, {
        outreachPersonaSlug: personaSuggestion.suggestedPersonaSlug,
      });
      
      if (response.data?.success) {
        setContact(response.data.contact);
        setSelectedPersonaSlug(personaSuggestion.suggestedPersonaSlug);
        setShowPersonaSuggestionModal(false);
        setPersonaSuggestion(null);
        if (refreshContacts) {
          refreshContacts();
        }
      } else {
        alert(response.data?.error || 'Failed to apply persona');
      }
    } catch (error) {
      console.error('Error applying persona:', error);
      alert(error.response?.data?.error || 'Failed to apply persona');
    } finally {
      setSavingPersona(false);
    }
  };

  const displayName = useMemo(() => {
    if (!contact) return 'Contact';
    return (
      contact.goesBy ||
      [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
      'Contact'
    );
  }, [contact]);

  // Check if contact has FULL intelligence enrichment (not just basic LinkedIn data)
  // Uses useMemo (not useEffect) - automatically recalculates when contact changes
  // Only returns true if we have actual intelligence data (scores, summaries), not just basic enrichment metadata
  const isEnriched = useMemo(() => {
    if (!contact) return false;
    
    // Only consider "enriched" if we have actual intelligence data:
    // 1. profileSummary - GPT-generated summary (indicates full intelligence sweep)
    // 2. Intelligence scores - computed from enrichment data
    // 3. enrichmentRedisKey - legacy Redis reference (indicates full enrichment flow)
    
    // NOTE: enrichmentSource and enrichmentPayload alone are NOT enough
    // These are set by simple LinkedIn save, but don't indicate full intelligence
    
    return !!(
      contact.profileSummary || // GPT summary from enrichment (most reliable indicator)
      (contact.seniorityScore !== null && contact.seniorityScore !== undefined) || // Intelligence score
      (contact.buyingPowerScore !== null && contact.buyingPowerScore !== undefined) || // Intelligence score
      contact.enrichmentRedisKey // Legacy Redis key (fallback - indicates full enrichment flow)
    );
  }, [contact]);

  const [showEnrichSuccessModal, setShowEnrichSuccessModal] = useState(false);

  const handleEnrichCareer = async () => {
    if (!contactId || (!contact?.linkedinUrl && !contact?.email)) {
      setCareerEnrichError('Contact must have a LinkedIn URL or email address');
      return;
    }
    
    setEnrichingCareer(true);
    setCareerEnrichError('');
    
    try {
      const response = await api.post(`/api/contacts/${contactId}/enrich-career`, {
        companyHQId,
        linkedinUrl: contact.linkedinUrl,
        email: contact.email,
      });
      
      if (response.data?.success) {
        // Refresh contact data
        const refreshResponse = await api.get(`/api/contacts/${contactId}`);
        if (refreshResponse.data?.success && refreshResponse.data.contact) {
          setContact(refreshResponse.data.contact);
          setNotesText(refreshResponse.data.contact.notes || '');
          if (refreshContacts) {
            refreshContacts();
          }
        }
        alert('Career history enriched successfully!');
      } else {
        throw new Error(response.data?.error || 'Career enrichment failed');
      }
    } catch (err) {
      console.error('Career enrichment error:', err);
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to enrich career history';
      setCareerEnrichError(errorMessage);
    } finally {
      setEnrichingCareer(false);
    }
  };

  const handleEnrichContact = async () => {
    if (!contactId || !contact?.email) {
      setEnrichError('Contact must have an email address to enrich');
      return;
    }

    setEnriching(true);
    setEnrichError('');

    try {
      // Step 1: Enrich by email
      const enrichResponse = await api.post('/api/contacts/enrich/by-email', {
        contactId,
      });

      if (!enrichResponse.data?.success) {
        throw new Error(enrichResponse.data?.error || 'Enrichment failed');
      }

      // Step 2: Save the enrichment (use Redis key if present, otherwise pass raw payload when Redis failed)
      const redisKey = enrichResponse.data?.redisKey || null;
      const rawApolloResponse = enrichResponse.data?.rawApolloResponse || null;
      if (!redisKey && !rawApolloResponse) {
        throw new Error('No enrichment data returned. Please try again.');
      }

      const savePayload = {
        contactId,
        ...(redisKey ? { redisKey } : { rawEnrichmentPayload: rawApolloResponse }),
      };
      const saveResponse = await api.post('/api/contacts/enrich/save', savePayload);

      if (!saveResponse.data?.success) {
        throw new Error(saveResponse.data?.error || 'Failed to save enrichment');
      }

      // Check if intelligence was actually saved
      const hasIntelligence = saveResponse.data?.contact?.seniorityScore !== undefined ||
        saveResponse.data?.contact?.profileSummary !== undefined;

      // Step 3: Refresh contact data
      const updatedContactResponse = await api.get(`/api/contacts/${contactId}`);
      if (updatedContactResponse.data?.success && updatedContactResponse.data?.contact) {
        setContact(updatedContactResponse.data.contact);
        setNotesText(updatedContactResponse.data.contact.notes || '');
        if (refreshContacts) {
          refreshContacts();
        }
      }

      // Step 4: Show success modal if intelligence was saved
      if (hasIntelligence) {
        setShowEnrichSuccessModal(true);
      }
    } catch (err) {
      console.error('Enrichment error:', err);
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to enrich contact';
      setEnrichError(errorMessage);
    } finally {
      setEnriching(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-lg font-semibold text-gray-800">Loading contact…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-lg font-semibold text-red-600">
              {error || 'Contact not found.'}
            </p>
            <button
              type="button"
              onClick={() => router.push('/people')}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Back to People Hub
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title={displayName}
          subtitle="Full profile, pipeline status, and relationship notes."
          backTo="/contacts/view"
          backLabel="Back to People Hub"
        />

        <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-gray-600 shadow hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          {!editingStage ? (
            <>
              <span className="rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-600">
                {contact.pipelines?.pipeline || contact.pipeline?.pipeline || 'Unassigned'}
              </span>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-600">
                  {contact.pipelines?.stage || contact.pipeline?.stage || 'No Stage'}
                </span>
                <button
                  onClick={() => {
                    const currentPipeline = contact.pipelines?.pipeline || contact.pipeline?.pipeline || 'unassigned';
                    const currentStage = contact.pipelines?.stage || contact.pipeline?.stage || null;
                    setEditingStage(true);
                    setSelectedPipeline(currentPipeline);
                    setSelectedStage(currentStage || '');
                  }}
                  className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                  title="Change pipeline and stage"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={selectedPipeline}
                onChange={(e) => {
                  setSelectedPipeline(e.target.value);
                  // Reset stage when pipeline changes (unless it's unassigned)
                  if (e.target.value === 'unassigned') {
                    setSelectedStage('');
                  } else if (e.target.value === 'prospect') {
                    setSelectedStage('need-to-engage');
                  } else {
                    setSelectedStage('interest');
                  }
                }}
                className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-600 border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="unassigned">Unassigned</option>
                <option value="prospect">Prospect</option>
                <option value="client">Client</option>
                <option value="collaborator">Collaborator</option>
                <option value="institution">Institution</option>
              </select>
              {selectedPipeline !== 'unassigned' && (
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value)}
                  className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-600 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  {selectedPipeline === 'prospect' && (
                    <>
                      <option value="need-to-engage">Need to Engage</option>
                      <option value="interest">Interest</option>
                      <option value="meeting">Meeting</option>
                      <option value="proposal">Proposal</option>
                      <option value="contract">Contract</option>
                      <option value="contract-signed">Contract Signed</option>
                    </>
                  )}
                  {selectedPipeline === 'client' && (
                    <>
                      <option value="kickoff">Kickoff</option>
                      <option value="work-started">Work Started</option>
                      <option value="work-delivered">Work Delivered</option>
                      <option value="sustainment">Sustainment</option>
                      <option value="renewal">Renewal</option>
                      <option value="terminated-contract">Terminated</option>
                    </>
                  )}
                  {selectedPipeline === 'collaborator' && (
                    <>
                      <option value="interest">Interest</option>
                      <option value="meeting">Meeting</option>
                      <option value="moa">MOA</option>
                      <option value="agreement">Agreement</option>
                    </>
                  )}
                  {selectedPipeline === 'institution' && (
                    <>
                      <option value="interest">Interest</option>
                      <option value="meeting">Meeting</option>
                      <option value="moa">MOA</option>
                      <option value="agreement">Agreement</option>
                    </>
                  )}
                </select>
              )}
              {selectedPipeline === 'unassigned' && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-600">
                  No Stage
                </span>
              )}
              <button
                onClick={async () => {
                  if (!selectedPipeline) {
                    alert('Please select a pipeline');
                    return;
                  }
                  // Stage is required for all pipelines except unassigned
                  if (selectedPipeline !== 'unassigned' && !selectedStage) {
                    alert('Please select both pipeline and stage');
                    return;
                  }
                  setSavingStage(true);
                  try {
                    // Use dedicated pipeline route
                    // For unassigned, don't send stage (or send null)
                    const payload = {
                      pipeline: selectedPipeline,
                    };
                    if (selectedPipeline !== 'unassigned' && selectedStage) {
                      payload.stage = selectedStage;
                    }
                    const response = await api.put(`/api/contacts/${contactId}/pipeline`, payload);
                    if (response.data?.success) {
                      setContact(response.data.contact);
                      setEditingStage(false);
                      if (refreshContacts) {
                        refreshContacts();
                      }
                    } else {
                      alert(response.data?.error || 'Failed to update pipeline');
                    }
                  } catch (error) {
                    console.error('Error updating pipeline:', error);
                    alert(error.response?.data?.error || 'Failed to update pipeline');
                  } finally {
                    setSavingStage(false);
                  }
                }}
                disabled={savingStage}
                className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="h-3 w-3" />
                {savingStage ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setEditingStage(false);
                  setSelectedPipeline(null);
                  setSelectedStage(null);
                }}
                disabled={savingStage}
                className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Career Enrichment Error */}
          {careerEnrichError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-800 mb-1">
                    Career Enrichment failed
                  </h3>
                  <p className="text-sm text-red-700">{careerEnrichError}</p>
                </div>
                <button
                  onClick={() => setCareerEnrichError('')}
                  className="text-red-400 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          
          {/* Enrichment Error */}
          {enrichError && (
            <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <X className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-sm font-semibold text-red-900">
                      Enrichment failed
                    </p>
                    <p className="text-xs text-red-700">
                      {enrichError}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEnrichError('')}
                  className="rounded-lg p-1 text-red-600 transition hover:bg-red-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <section className="rounded-2xl bg-white p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Contact Information
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                {isEnriched ? (
                  // Show "Build Persona" as primary, other actions as secondary if enriched
                  <>
                    <button
                      onClick={() => {
                        const companyHQId = typeof window !== 'undefined' ? localStorage.getItem('companyHQId') || localStorage.getItem('companyId') : '';
                        router.push(`/personas/build-from-contact?companyHQId=${companyHQId}&contactId=${contactId}`);
                      }}
                      className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700"
                    >
                      <UserCircle className="h-4 w-4" />
                      Build Persona
                    </button>
                    {contact?.email && (
                      <button
                        onClick={() => {
                          const url = companyHQId 
                            ? `/outreach/compose?contactId=${contactId}&companyHQId=${companyHQId}`
                            : `/outreach/compose?contactId=${contactId}`;
                          router.push(url);
                        }}
                        className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                        title="Send Email"
                      >
                        <Mail className="h-4 w-4" />
                        Email
                      </button>
                    )}
                    <button
                      onClick={() => setShowAddToListModal(true)}
                      className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      title="Add to List"
                    >
                      <List className="h-4 w-4" />
                      Add to List
                    </button>
                    {contact?.enrichmentPayload && (
                      <button
                        onClick={() => setShowEnrichmentDetails(true)}
                        className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                        title="View Enrichment Details"
                      >
                        <Eye className="h-4 w-4" />
                        Details
                      </button>
                    )}
                    <button
                      onClick={handleEnrichCareer}
                      disabled={enrichingCareer || (!contact?.linkedinUrl && !contact?.email)}
                      className="flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Get Full Career History"
                    >
                      {enrichingCareer ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Get Full Career History
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  // Show "Enrich Contact" as primary, other actions as secondary if not enriched
                  <>
                    <button
                      onClick={handleEnrichContact}
                      disabled={enriching || !contact?.email}
                      className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {enriching ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Enriching...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Enrich Contact
                        </>
                      )}
                    </button>
                    {contact?.email && (
                      <button
                        onClick={() => {
                          const url = companyHQId 
                            ? `/outreach/compose?contactId=${contactId}&companyHQId=${companyHQId}`
                            : `/outreach/compose?contactId=${contactId}`;
                          router.push(url);
                        }}
                        className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                        title="Send Email"
                      >
                        <Mail className="h-4 w-4" />
                        Email
                      </button>
                    )}
                    <button
                      onClick={() => setShowAddToListModal(true)}
                      className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      title="Add to List"
                    >
                      <List className="h-4 w-4" />
                      Add to List
                    </button>
                  </>
                )}
              </div>
            </div>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-semibold text-gray-500">Preferred Name</dt>
                <dd className="mt-1 text-base text-gray-900">
                  {contact.goesBy || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-gray-500">Full Name</dt>
                <dd className="mt-1 text-base text-gray-900">
                  {[contact.firstName, contact.lastName].filter(Boolean).join(' ') || '—'}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-gray-400" />
                <div>
                  <dt className="text-sm font-semibold text-gray-500">Email</dt>
                  <dd className="mt-1 text-base text-gray-900">
                    {contact.email || '—'}
                  </dd>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-gray-400" />
                <div>
                  <dt className="text-sm font-semibold text-gray-500">Phone</dt>
                  <dd className="mt-1 text-base text-gray-900">
                    {contact.phone || '—'}
                  </dd>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-gray-400" />
                <div className="flex-1">
                  <dt className="text-sm font-semibold text-gray-500 mb-1">Company</dt>
                  {!editingCompany ? (
                    <div className="flex items-center gap-2">
                      <dd className="text-base text-gray-900">
                        {contact.companies?.companyName || contact.company?.companyName || contact.contactCompany?.companyName || contact.companyName || 'No company assigned'}
                      </dd>
                      <button
                        onClick={() => {
                          const existingCompany = contact.companies || contact.company || contact.contactCompany || null;
                          setEditingCompany(true);
                          setSelectedCompany(existingCompany);
                        }}
                        className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                        title="Assign company"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <CompanySelector
                        companyId={contact.companies?.id || contact.company?.id || contact.contactCompany?.id || null}
                        selectedCompany={selectedCompany || contact.companies || contact.company || contact.contactCompany || null}
                        onCompanySelect={(company) => {
                          setSelectedCompany(company);
                        }}
                        showLabel={false}
                        placeholder="Search or create company..."
                        companyHQId={companyHQId || undefined}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            if (!selectedCompany) {
                              alert('Please select or create a company');
                              return;
                            }
                            setSavingCompany(true);
                            try {
                              const response = await api.put(`/api/contacts/${contactId}`, {
                                contactCompanyId: selectedCompany.id,
                                companyId: selectedCompany.id,
                              });
                              if (response.data?.success) {
                                const updatedContact = response.data.contact;
                                setContact(updatedContact);
                                setEditingCompany(false);
                                
                                // NO localStorage - API only
                                
                                // Refresh contacts list via context
                                if (refreshContacts) {
                                  refreshContacts();
                                }
                              } else {
                                alert(response.data?.error || 'Failed to assign company');
                              }
                            } catch (error) {
                              console.error('Error assigning company:', error);
                              alert(error.response?.data?.error || 'Failed to assign company');
                            } finally {
                              setSavingCompany(false);
                            }
                          }}
                          disabled={savingCompany || !selectedCompany}
                          className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Check className="h-4 w-4" />
                          {savingCompany ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingCompany(false);
                            setSelectedCompany(null);
                          }}
                          disabled={savingCompany}
                          className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                        >
                          <XIcon className="h-4 w-4" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <dt className="text-sm font-semibold text-gray-500">Title</dt>
                <dd className="mt-1 text-base text-gray-900">
                  {contact.title || '—'}
                </dd>
              </div>
            </dl>
          </section>

          {/* Outreach Persona Section */}
          <section className="rounded-2xl bg-white p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Outreach Persona</h3>
              {!editingPersona && (
                <button
                  onClick={() => {
                    setEditingPersona(true);
                    setSelectedPersonaSlug(contact.outreachPersonaSlug || null);
                  }}
                  className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                  title="Edit persona"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              )}
            </div>
            {!editingPersona ? (
              <div>
                {contact.outreachPersonaSlug ? (
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-700">
                      {contact.outreachPersonaSlug}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No outreach persona assigned. Generate one from notes or select manually.</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <select
                  value={selectedPersonaSlug || ''}
                  onChange={(e) => setSelectedPersonaSlug(e.target.value || null)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  disabled={loadingPersonas}
                >
                  <option value="">No persona (unassigned)</option>
                  {loadingPersonas ? (
                    <option>Loading personas...</option>
                  ) : (
                    availablePersonas.map((persona) => (
                      <option key={persona.slug} value={persona.slug}>
                        {persona.name} ({persona.slug})
                      </option>
                    ))
                  )}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setSavingPersona(true);
                      try {
                        const response = await api.put(`/api/contacts/${contactId}`, {
                          outreachPersonaSlug: selectedPersonaSlug || null,
                        });
                        if (response.data?.success) {
                          setContact(response.data.contact);
                          setEditingPersona(false);
                          if (refreshContacts) {
                            refreshContacts();
                          }
                        } else {
                          alert(response.data?.error || 'Failed to save persona');
                        }
                      } catch (error) {
                        console.error('Error saving persona:', error);
                        alert(error.response?.data?.error || 'Failed to save persona');
                      } finally {
                        setSavingPersona(false);
                      }
                    }}
                    disabled={savingPersona}
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Check className="h-4 w-4" />
                    {savingPersona ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingPersona(false);
                      setSelectedPersonaSlug(contact.outreachPersonaSlug || null);
                    }}
                    disabled={savingPersona}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    <XIcon className="h-4 w-4" />
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Notes</h3>
              <div className="flex items-center gap-2">
                {!editingNotes && contact.notes && (
                  <button
                    onClick={handleSuggestPersona}
                    disabled={suggestingPersona}
                    className="flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Generate persona from notes"
                  >
                    {suggestingPersona ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4" />
                        Generate Persona
                      </>
                    )}
                  </button>
                )}
                {!editingNotes && (
                  <button
                    onClick={() => {
                      setEditingNotes(true);
                      setNotesText(contact.notes || '');
                    }}
                    className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                    title="Edit notes"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            {!editingNotes ? (
              <div>
                {contact.notes ? (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{contact.notes}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">Add notes from meetings, emails, and relationship updates.</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="Add notes from meetings, emails, and relationship updates..."
                  className="w-full min-h-[120px] rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 resize-y"
                  autoFocus
                />
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={async () => {
                      setSavingNotes(true);
                      try {
                        const response = await api.put(`/api/contacts/${contactId}`, {
                          notes: notesText.trim() || null,
                        });
                        if (response.data?.success) {
                          setContact(response.data.contact);
                          setEditingNotes(false);
                          if (refreshContacts) {
                            refreshContacts();
                          }
                        } else {
                          alert(response.data?.error || 'Failed to save notes');
                        }
                      } catch (error) {
                        console.error('Error saving notes:', error);
                        alert(error.response?.data?.error || 'Failed to save notes');
                      } finally {
                        setSavingNotes(false);
                      }
                    }}
                    disabled={savingNotes}
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Check className="h-4 w-4" />
                    {savingNotes ? 'Saving...' : 'Save'}
                  </button>
                  {notesText.trim() && (
                    <button
                      onClick={handleSuggestPersona}
                      disabled={suggestingPersona || savingNotes}
                      className="flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Generate persona from these notes"
                    >
                      {suggestingPersona ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-4 w-4" />
                          Generate Persona
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingNotes(false);
                      setNotesText(contact.notes || '');
                    }}
                    disabled={savingNotes}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    <XIcon className="h-4 w-4" />
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Email History Section */}
          <section className="rounded-2xl bg-white p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Email History</h3>
              <div className="flex items-center gap-2">
                {emailHistory.length === 0 && (
                  <button
                    onClick={() => {
                      const url = companyHQId 
                        ? `/outreach/record-off-platform?contactId=${contactId}&companyHQId=${companyHQId}`
                        : `/outreach/record-off-platform?contactId=${contactId}`;
                      router.push(url);
                    }}
                    className="flex items-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700"
                  >
                    <Plus className="h-4 w-4" />
                    Add Email Manually
                  </button>
                )}
                <button
                  onClick={async () => {
                    setBuildingEmail(true);
                    try {
                      // Build email with persona and relationship context
                      const response = await api.post(`/api/contacts/${contactId}/build-email`, {
                        personaSlug: contact.outreachPersonaSlug || null,
                        relationshipContext: contact.outreachPersonaSlug ? {
                          // We could fetch relationship context here if stored, but for now use persona
                        } : undefined,
                        companyHQId: companyHQId || undefined,
                      });
                      
                      if (response.data?.success) {
                        // Navigate to compose with generated email
                        const params = new URLSearchParams({
                          contactId,
                          ...(companyHQId && { companyHQId }),
                          ...(response.data.subject && { subject: response.data.subject }),
                          ...(response.data.body && { body: response.data.body }),
                          emailType: response.data.emailType || 'FIRST_TIME',
                        });
                        router.push(`/outreach/compose?${params.toString()}`);
                      } else {
                        // If generation fails, still navigate to compose
                        const url = companyHQId 
                          ? `/outreach/compose?contactId=${contactId}&companyHQId=${companyHQId}`
                          : `/outreach/compose?contactId=${contactId}`;
                        router.push(url);
                      }
                    } catch (error) {
                      console.error('Error building email:', error);
                      // On error, still navigate to compose
                      const url = companyHQId 
                        ? `/outreach/compose?contactId=${contactId}&companyHQId=${companyHQId}`
                        : `/outreach/compose?contactId=${contactId}`;
                      router.push(url);
                    } finally {
                      setBuildingEmail(false);
                    }
                  }}
                  disabled={buildingEmail}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {buildingEmail ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Building...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      Build Outreach Email
                    </>
                  )}
                </button>
              </div>
            </div>
            {loadingLastEmail ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading email history...
              </div>
            ) : emailHistory.length > 0 ? (
              <div className="space-y-4">
                {emailHistory.slice(0, 5).map((email, idx) => (
                  <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span>{new Date(email.date).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className="capitalize">{email.type === 'platform' ? 'Platform' : 'Off-Platform'}</span>
                        {email.platform && (
                          <>
                            <span>•</span>
                            <span>{email.platform}</span>
                          </>
                        )}
                      </div>
                      {email.type === 'platform' && email.hasResponded && (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                          ✓ Responded
                        </span>
                      )}
                    </div>
                    <div className="mb-2 font-medium text-gray-900">{email.subject || 'No subject'}</div>
                    {email.notes && (
                      <div className="text-sm text-gray-600 line-clamp-2">{email.notes}</div>
                    )}
                  </div>
                ))}
                {emailHistory.length > 5 && (
                  <p className="text-sm text-gray-500 italic">
                    Showing 5 of {emailHistory.length} emails
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                <p className="mb-2 text-sm text-gray-600">No emails sent yet.</p>
                <p className="text-sm text-gray-500">
                  Click "Build Outreach Email" to send your first email, or "Add Email Manually" to record an off-platform email.
                </p>
              </div>
            )}
          </section>

          {/* Contact Outlook Section - Only show if contact has FULL intelligence enrichment */}
          {/* Only show if we have actual intelligence data (scores, summaries), not just basic enrichment */}
          {isEnriched && (
            <ContactOutlook 
              contact={contact} 
              onViewRawJSON={(json) => {
                setRawJSON(json);
                setShowRawJSON(true);
              }}
            />
          )}

          {/* Client Portal Access - Removed from contact detail page */}
          {/* This is a special UX that should be handled in a dedicated client portal management area */}
        </div>


        {/* Raw JSON Modal */}
        {showRawJSON && rawJSON && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <h2 className="text-xl font-bold text-gray-900">Raw Enrichment JSON</h2>
                <button
                  onClick={() => {
                    setShowRawJSON(false);
                    setRawJSON(null);
                  }}
                  className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6">
                <pre className="text-xs bg-gray-50 p-4 rounded-lg overflow-x-auto">
                  {JSON.stringify(rawJSON, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Enrichment Success Modal */}
        {showEnrichSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-xl">
              <div className="p-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="rounded-full p-3 bg-green-100">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
                  Contact Enriched Successfully!
                </h2>
                <p className="text-gray-600 text-center mb-6">
                  All intelligence scores and profile data have been saved. What would you like to do next?
                </p>
                
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setShowEnrichSuccessModal(false);
                      const companyHQId = typeof window !== 'undefined' ? localStorage.getItem('companyHQId') || localStorage.getItem('companyId') : '';
                      router.push(`/personas/build-from-contact?companyHQId=${companyHQId}&contactId=${contactId}`);
                    }}
                    className="w-full flex items-center justify-between rounded-lg border-2 border-purple-600 bg-purple-50 px-6 py-4 text-left transition hover:bg-purple-100"
                  >
                    <div className="flex items-center gap-3">
                      <UserCircle className="h-5 w-5 text-purple-600" />
                      <div>
                        <div className="font-semibold text-gray-900">Build Persona</div>
                        <div className="text-sm text-gray-600">Create a persona from this enriched contact</div>
                      </div>
                    </div>
                    <ArrowLeft className="h-5 w-5 text-purple-600 rotate-180" />
                  </button>

                  <button
                    onClick={() => {
                      setShowEnrichSuccessModal(false);
                      // Refresh to show updated contact
                      window.location.reload();
                    }}
                    className="w-full flex items-center justify-between rounded-lg border-2 border-blue-600 bg-blue-50 px-6 py-4 text-left transition hover:bg-blue-100"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-blue-600" />
                      <div>
                        <div className="font-semibold text-gray-900">View Contact</div>
                        <div className="text-sm text-gray-600">See full contact details and intelligence</div>
                      </div>
                    </div>
                    <ArrowLeft className="h-5 w-5 text-blue-600 rotate-180" />
                  </button>

                  <button
                    onClick={() => {
                      setShowEnrichSuccessModal(false);
                      router.push(`/outreach/compose?contactId=${contactId}`);
                    }}
                    className="w-full flex items-center justify-between rounded-lg border-2 border-red-600 bg-red-50 px-6 py-4 text-left transition hover:bg-red-100"
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-red-600" />
                      <div>
                        <div className="font-semibold text-gray-900">Send an Email</div>
                        <div className="text-sm text-gray-600">Compose and send a personalized email</div>
                      </div>
                    </div>
                    <ArrowLeft className="h-5 w-5 text-red-600 rotate-180" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add to List Modal */}
        {showAddToListModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Add to List</h2>
                <button
                  onClick={() => setShowAddToListModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {loadingLists ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500">Loading lists...</span>
                  </div>
                ) : lists && lists.length > 0 ? (
                  lists.map((list) => (
                    <button
                      key={list.id}
                      onClick={async () => {
                        try {
                          await api.post(`/api/contact-lists/${list.id}/contacts`, {
                            contactId: contactId,
                          });
                          setShowAddToListModal(false);
                          alert(`Contact added to ${list.name}`);
                        } catch (error) {
                          console.error('Error adding contact to list:', error);
                          alert(error.response?.data?.error || 'Failed to add contact to list');
                        }
                      }}
                      className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
                    >
                      <div className="font-medium text-gray-900">{list.name}</div>
                      {list.description && (
                        <div className="text-sm text-gray-500">{list.description}</div>
                      )}
                    </button>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No lists available. Create a list first.</p>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => router.push('/contacts/list-builder')}
                  className="flex-1 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
                >
                  Create New List
                </button>
                <button
                  onClick={() => setShowAddToListModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Enrichment Details Modal */}
        {showEnrichmentDetails && contact?.enrichmentPayload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 p-6 max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Enrichment Details</h2>
                <button
                  onClick={() => setShowEnrichmentDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                  {JSON.stringify(contact.enrichmentPayload, null, 2)}
                </pre>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowEnrichmentDetails(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Persona Suggestion Modal */}
        {showPersonaSuggestionModal && personaSuggestion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Persona Suggestion</h2>
                <button
                  onClick={() => {
                    setShowPersonaSuggestionModal(false);
                    setPersonaSuggestion(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {personaSuggestion.suggestedPersonaSlug ? (
                <div className="space-y-4">
                  {/* Relationship Context - Source of Truth */}
                  {personaSuggestion.relationshipContext && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">
                        Relationship Context <span className="text-xs font-normal text-gray-500">(Source of Truth)</span>
                      </h3>
                      <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 space-y-2 text-sm">
                        {/* Factual extracted data */}
                        {personaSuggestion.relationshipContext.formerCompany && (
                          <div>
                            <span className="font-semibold text-gray-700">Former Company:</span>{' '}
                            <span className="text-gray-600">{personaSuggestion.relationshipContext.formerCompany}</span>
                          </div>
                        )}
                        {personaSuggestion.relationshipContext.primaryWork && (
                          <div>
                            <span className="font-semibold text-gray-700">Primary Work:</span>{' '}
                            <span className="text-gray-600">{personaSuggestion.relationshipContext.primaryWork}</span>
                          </div>
                        )}
                        {personaSuggestion.relationshipContext.relationshipQuality && (
                          <div>
                            <span className="font-semibold text-gray-700">Relationship Quality:</span>{' '}
                            <span className="text-gray-600">{personaSuggestion.relationshipContext.relationshipQuality}</span>
                          </div>
                        )}
                        {personaSuggestion.relationshipContext.opportunityType && (
                          <div>
                            <span className="font-semibold text-gray-700">Opportunity Type:</span>{' '}
                            <span className="text-gray-600">{personaSuggestion.relationshipContext.opportunityType}</span>
                          </div>
                        )}
                        
                        {/* Relationship dimensions */}
                        {(personaSuggestion.relationshipContext.contextOfRelationship || 
                          personaSuggestion.relationshipContext.relationshipRecency || 
                          personaSuggestion.relationshipContext.companyAwareness) && (
                          <div className="pt-2 mt-2 border-t border-blue-200">
                            <div className="text-xs font-semibold text-gray-600 mb-1">Relationship Dimensions:</div>
                            {personaSuggestion.relationshipContext.contextOfRelationship && (
                              <div className="text-xs">
                                <span className="font-semibold text-gray-700">Type:</span>{' '}
                                <span className="text-gray-600">{personaSuggestion.relationshipContext.contextOfRelationship.replace(/_/g, ' ')}</span>
                              </div>
                            )}
                            {personaSuggestion.relationshipContext.relationshipRecency && (
                              <div className="text-xs">
                                <span className="font-semibold text-gray-700">Recency:</span>{' '}
                                <span className="text-gray-600">{personaSuggestion.relationshipContext.relationshipRecency.replace(/_/g, ' ')}</span>
                              </div>
                            )}
                            {personaSuggestion.relationshipContext.companyAwareness && (
                              <div className="text-xs">
                                <span className="font-semibold text-gray-700">Awareness:</span>{' '}
                                <span className="text-gray-600">{personaSuggestion.relationshipContext.companyAwareness.replace(/_/g, ' ')}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Persona - Fills Gaps */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Suggested Persona <span className="text-xs font-normal text-gray-500">(Fills Gaps, Drives Templates)</span>
                    </h3>
                    <div className="rounded-lg bg-purple-50 border border-purple-200 p-3">
                      <div className="font-semibold text-purple-900">{personaSuggestion.suggestedPersonaSlug}</div>
                      {personaSuggestion.confidence !== undefined && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span>Confidence</span>
                            <span>{personaSuggestion.confidence}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-purple-600 h-2 rounded-full transition-all"
                              style={{ width: `${personaSuggestion.confidence}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {personaSuggestion.reasoning && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Reasoning</h3>
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                        {personaSuggestion.reasoning}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4 border-t">
                    <button
                      onClick={handleApplySuggestedPersona}
                      disabled={savingPersona}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingPersona ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Applying...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          Apply Persona
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowPersonaSuggestionModal(false);
                        setPersonaSuggestion(null);
                      }}
                      disabled={savingPersona}
                      className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600">Unable to suggest a persona from the notes.</p>
                  <button
                    onClick={() => {
                      setShowPersonaSuggestionModal(false);
                      setPersonaSuggestion(null);
                    }}
                    className="mt-4 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
