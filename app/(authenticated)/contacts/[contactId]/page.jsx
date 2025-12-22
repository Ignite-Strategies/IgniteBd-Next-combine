'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Phone, Building2, ArrowLeft, Sparkles, X, Edit2, Check, X as XIcon, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import PageHeader from '@/components/PageHeader.jsx';
import { useContactsContext } from '@/hooks/useContacts';
import ContactOutlook from '@/components/enrichment/ContactOutlook';
import CompanySelector from '@/components/CompanySelector';

export default function ContactDetailPage({ params }) {
  const router = useRouter();
  const { contacts, refreshContacts } = useContactsContext();
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
              setError(response.data?.error || 'Contact not found.');
              setLoading(false);
            }
          }
        } catch (apiErr) {
          console.error('Error fetching contact from API:', apiErr);
          // If we have cached contact, keep showing it even if API fails
          if (!cachedContact && isMounted) {
            setError('Unable to load contact details.');
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

  const displayName = useMemo(() => {
    if (!contact) return 'Contact';
    return (
      contact.goesBy ||
      [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
      'Contact'
    );
  }, [contact]);

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

      if (!enrichResponse.data?.success || !enrichResponse.data?.redisKey) {
        throw new Error(enrichResponse.data?.error || 'Enrichment failed');
      }

      // Step 2: Automatically save the enrichment
      const saveResponse = await api.post('/api/contacts/enrich/save', {
        contactId,
        redisKey: enrichResponse.data.redisKey,
      });

      if (!saveResponse.data?.success) {
        throw new Error(saveResponse.data?.error || 'Failed to save enrichment');
      }

      // Step 3: Refresh contact data
      const updatedContactResponse = await api.get(`/api/contacts/${contactId}`);
      if (updatedContactResponse.data?.success && updatedContactResponse.data?.contact) {
        setContact(updatedContactResponse.data.contact);
        setNotesText(updatedContactResponse.data.contact.notes || '');
        if (refreshContacts) {
          refreshContacts();
        }
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
                {contact.pipelines?.pipeline || contact.pipeline?.pipeline || 'Prospect'}
              </span>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-600">
                  {contact.pipelines?.stage || contact.pipeline?.stage || 'Unassigned Stage'}
                </span>
                <button
                  onClick={() => {
                    const currentPipeline = contact.pipelines?.pipeline || contact.pipeline?.pipeline || 'prospect';
                    const currentStage = contact.pipelines?.stage || contact.pipeline?.stage || 'interest';
                    setEditingStage(true);
                    setSelectedPipeline(currentPipeline);
                    setSelectedStage(currentStage);
                  }}
                  className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                  title="Change stage"
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
                  // Reset stage when pipeline changes
                  setSelectedStage('interest');
                }}
                className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-600 border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="prospect">Prospect</option>
                <option value="client">Client</option>
                <option value="collaborator">Collaborator</option>
                <option value="institution">Institution</option>
              </select>
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-600 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                {selectedPipeline === 'prospect' && (
                  <>
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
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </>
                )}
                {selectedPipeline === 'institution' && (
                  <>
                    <option value="interest">Interest</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </>
                )}
              </select>
              <button
                onClick={async () => {
                  if (!selectedPipeline || !selectedStage) {
                    alert('Please select both pipeline and stage');
                    return;
                  }
                  setSavingStage(true);
                  try {
                    // Use dedicated pipeline route
                    const response = await api.put(`/api/contacts/${contactId}/pipeline`, {
                      pipeline: selectedPipeline,
                      stage: selectedStage,
                    });
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
                                
                                // Update localStorage immediately
                                if (typeof window !== 'undefined') {
                                  const cachedContacts = window.localStorage.getItem('contacts');
                                  if (cachedContacts) {
                                    try {
                                      const contacts = JSON.parse(cachedContacts);
                                      const updatedContacts = contacts.map((c) =>
                                        c.id === contactId ? updatedContact : c
                                      );
                                      window.localStorage.setItem('contacts', JSON.stringify(updatedContacts));
                                    } catch (err) {
                                      console.warn('Failed to update localStorage:', err);
                                    }
                                  }
                                }
                                
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

          <section className="rounded-2xl bg-white p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Notes</h3>
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
                <div className="flex gap-2">
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

          {/* Contact Outlook Section - Only show if contact has enrichment data */}
          {/* This is a "clue" during enrichment, not a persistent thing on all contacts */}
          {(contact.enrichmentSource || contact.enrichmentRedisKey || 
            contact.seniorityScore !== null || contact.buyingPowerScore !== null) && (
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
      </div>
    </div>
  );
}
