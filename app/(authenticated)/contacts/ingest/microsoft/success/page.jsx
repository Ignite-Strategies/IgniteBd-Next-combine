'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import CompanySelector from '@/components/CompanySelector';
import { Check, X, Home, User, Sparkles, Loader2, ArrowLeft, Edit2, ChevronRight, ChevronDown, Users } from 'lucide-react';

function MicrosoftSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  const saved = parseInt(searchParams?.get('saved') || '0', 10);
  const skipped = parseInt(searchParams?.get('skipped') || '0', 10);
  const contactIdsParam = searchParams?.get('contactIds') || '';
  
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState([]);
  const [error, setError] = useState(null);
  const [expandedContacts, setExpandedContacts] = useState(new Set()); // Track which contacts are expanded
  
  // Per-contact editing state (keyed by contact ID)
  const [editingNotes, setEditingNotes] = useState({});
  const [notesText, setNotesText] = useState({});
  const [savingNotes, setSavingNotes] = useState({});
  const [editingCompany, setEditingCompany] = useState({});
  const [selectedCompany, setSelectedCompany] = useState({});
  const [savingCompany, setSavingCompany] = useState({});
  const [editingStage, setEditingStage] = useState({});
  const [selectedPipeline, setSelectedPipeline] = useState({});
  const [selectedStage, setSelectedStage] = useState({});
  const [savingStage, setSavingStage] = useState({});
  const [enriching, setEnriching] = useState({});

  useEffect(() => {
    // Parse contact IDs from query param
    const contactIds = contactIdsParam ? contactIdsParam.split(',').filter(Boolean) : [];
    
    if (contactIds.length === 0) {
      setLoading(false);
      return;
    }

    // Fetch contact details for all saved contacts
    async function loadContacts() {
      try {
        // Fetch all contacts in parallel
        const contactPromises = contactIds.map(id => 
          api.get(`/api/contacts/${id}`).catch(err => {
            console.error(`Failed to load contact ${id}:`, err);
            return null;
          })
        );
        
        const responses = await Promise.all(contactPromises);
        const loadedContacts = responses
          .filter(res => res && res.data?.success && res.data?.contact)
          .map(res => res.data.contact);
        
        setContacts(loadedContacts);
      } catch (err) {
        console.error('Failed to load contacts:', err);
        setError('Failed to load imported contacts');
      } finally {
        setLoading(false);
      }
    }

    loadContacts();
  }, [contactIdsParam]);

  // Toggle contact expansion
  function toggleExpand(contactId) {
    setExpandedContacts(prev => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  }

  async function handleSaveNotes(contactId) {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    
    setSavingNotes(prev => ({ ...prev, [contactId]: true }));
    
    try {
      const response = await api.put(`/api/contacts/${contactId}`, {
        notes: (notesText[contactId] || '').trim() || null,
      });
      
      if (response.data?.success) {
        setContacts(prev => prev.map(c => 
          c.id === contactId ? response.data.contact : c
        ));
        setEditingNotes(prev => ({ ...prev, [contactId]: false }));
      } else {
        alert(response.data?.error || 'Failed to save notes');
      }
    } catch (error) {
      console.error('Error saving notes:', error);
      alert(error.response?.data?.error || 'Failed to save notes');
    } finally {
      setSavingNotes(prev => ({ ...prev, [contactId]: false }));
    }
  }

  async function handleSaveCompany(contactId) {
    const contact = contacts.find(c => c.id === contactId);
    const company = selectedCompany[contactId];
    
    if (!contact || !company) {
      alert('Please select a company');
      return;
    }
    
    setSavingCompany(prev => ({ ...prev, [contactId]: true }));
    
    try {
      const response = await api.put(`/api/contacts/${contactId}`, {
        contactCompanyId: company.id,
        companyId: company.id,
      });
      
      if (response.data?.success) {
        setContacts(prev => prev.map(c => 
          c.id === contactId ? response.data.contact : c
        ));
        setEditingCompany(prev => ({ ...prev, [contactId]: false }));
      } else {
        alert(response.data?.error || 'Failed to assign company');
      }
    } catch (error) {
      console.error('Error assigning company:', error);
      alert(error.response?.data?.error || 'Failed to assign company');
    } finally {
      setSavingCompany(prev => ({ ...prev, [contactId]: false }));
    }
  }

  async function handleSaveStage(contactId) {
    const contact = contacts.find(c => c.id === contactId);
    const pipeline = selectedPipeline[contactId];
    const stage = selectedStage[contactId];
    
    if (!contact || !pipeline) return;
    
    if (pipeline !== 'unassigned' && !stage) {
      alert('Please select both pipeline and stage');
      return;
    }
    
    setSavingStage(prev => ({ ...prev, [contactId]: true }));
    try {
      const payload = {
        pipeline: pipeline,
      };
      if (pipeline !== 'unassigned' && stage) {
        payload.stage = stage;
      }
      const response = await api.put(`/api/contacts/${contactId}/pipeline`, payload);
      if (response.data?.success) {
        setContacts(prev => prev.map(c => 
          c.id === contactId ? response.data.contact : c
        ));
        setEditingStage(prev => ({ ...prev, [contactId]: false }));
      } else {
        alert(response.data?.error || 'Failed to update pipeline');
      }
    } catch (error) {
      console.error('Error updating pipeline:', error);
      alert(error.response?.data?.error || 'Failed to update pipeline');
    } finally {
      setSavingStage(prev => ({ ...prev, [contactId]: false }));
    }
  }

  async function handleEnrichContact(contactId) {
    const contact = contacts.find(c => c.id === contactId);
    
    if (!contact?.email) {
      alert('Contact must have an email address to enrich');
      return;
    }
    
    setEnriching(prev => ({ ...prev, [contactId]: true }));
    
    try {
      const enrichResponse = await api.post('/api/contacts/enrich/by-email', {
        contactId: contactId,
      });

      if (!enrichResponse.data?.success || !enrichResponse.data?.redisKey) {
        throw new Error(enrichResponse.data?.error || 'Enrichment failed');
      }

      const saveResponse = await api.post('/api/contacts/enrich/save', {
        contactId: contactId,
        redisKey: enrichResponse.data.redisKey,
      });

      if (!saveResponse.data?.success) {
        throw new Error(saveResponse.data?.error || 'Failed to save enrichment');
      }

      const updatedContactResponse = await api.get(`/api/contacts/${contactId}`);
      if (updatedContactResponse.data?.success && updatedContactResponse.data?.contact) {
        setContacts(prev => prev.map(c => 
          c.id === contactId ? updatedContactResponse.data.contact : c
        ));
        alert('Contact enriched successfully!');
      }
    } catch (err) {
      console.error('Enrichment error:', err);
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to enrich contact';
      alert(errorMessage);
    } finally {
      setEnriching(prev => ({ ...prev, [contactId]: false }));
    }
  }

  function handleFinish() {
    router.push(`/people?companyHQId=${companyHQId}`);
  }

  function handleBackToImport() {
    router.push(`/contacts/ingest/microsoft?companyHQId=${companyHQId}`);
  }

  // Helper function to get display name for a contact
  function getDisplayName(contact) {
    if (!contact) return 'Contact';
    return [contact.firstName, contact.lastName]
      .filter(Boolean)
      .join(' ') || contact.email?.split('@')[0] || 'Contact';
  }

  // Helper function to check if contact is enriched
  function isContactEnriched(contact) {
    return !!(
      contact?.profileSummary ||
      (contact?.seniorityScore !== null && contact?.seniorityScore !== undefined) ||
      contact?.enrichmentRedisKey
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading imported contacts...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || contacts.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="mx-auto max-w-4xl px-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Successfully Imported {saved} Contact{saved !== 1 ? 's' : ''}
                </h1>
                {skipped > 0 && (
                  <p className="text-gray-600 mt-1">
                    {skipped} contact{skipped !== 1 ? 's' : ''} skipped (already exist)
                  </p>
                )}
              </div>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-800">{error}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleFinish}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Back to People Hub
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Success Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Successfully Imported {saved} Contact{saved !== 1 ? 's' : ''}
                </h1>
                {skipped > 0 && (
                  <p className="text-sm text-gray-600">
                    {skipped} skipped (already exist)
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleBackToImport}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Import
            </button>
          </div>
          <p className="text-sm text-gray-600">
            Expand each contact to add notes, assign company, or enrich with additional data
          </p>
        </div>

        {/* Contacts List */}
        <div className="bg-white rounded-lg shadow border mb-6">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold">Imported Contacts</h2>
              <span className="text-sm text-gray-500">({contacts.length})</span>
            </div>

            <div className="space-y-2">
              {contacts.map((contact) => {
                const isExpanded = expandedContacts.has(contact.id);
                const contactCompany = contact.companies || contact.company || contact.contactCompany || null;
                const contactDisplayName = getDisplayName(contact);
                const contactIsEnriched = isContactEnriched(contact);
                const contactPipeline = contact.pipelines?.pipeline || contact.pipeline?.pipeline || 'unassigned';
                const contactStage = contact.pipelines?.stage || contact.pipeline?.stage || null;

                return (
                  <div
                    key={contact.id}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    {/* Contact Header - Clickable to expand/collapse */}
                    <button
                      onClick={() => toggleExpand(contact.id)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <User className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 truncate">
                            {contactDisplayName}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{contact.email}</div>
                          {contactCompany && (
                            <div className="text-xs text-gray-400 truncate">{contactCompany.companyName}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {contactIsEnriched && (
                          <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded font-medium">
                            Enriched
                          </span>
                        )}
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="px-4 py-4 border-t border-gray-200 bg-gray-50">

                        {/* Pipeline Status */}
                        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
                          {!editingStage[contact.id] ? (
                            <>
                              <span className="rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-600">
                                {contactPipeline}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-600">
                                  {contactStage || 'No Stage'}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingStage(prev => ({ ...prev, [contact.id]: true }));
                                    setSelectedPipeline(prev => ({ ...prev, [contact.id]: contactPipeline }));
                                    setSelectedStage(prev => ({ ...prev, [contact.id]: contactStage || '' }));
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
                                value={selectedPipeline[contact.id] || 'unassigned'}
                                onChange={(e) => {
                                  const pipeline = e.target.value;
                                  setSelectedPipeline(prev => ({ ...prev, [contact.id]: pipeline }));
                                  if (pipeline === 'unassigned') {
                                    setSelectedStage(prev => ({ ...prev, [contact.id]: '' }));
                                  } else if (pipeline === 'prospect') {
                                    setSelectedStage(prev => ({ ...prev, [contact.id]: 'need-to-engage' }));
                                  } else {
                                    setSelectedStage(prev => ({ ...prev, [contact.id]: 'interest' }));
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
                              {selectedPipeline[contact.id] !== 'unassigned' && (
                                <select
                                  value={selectedStage[contact.id] || ''}
                                  onChange={(e) => setSelectedStage(prev => ({ ...prev, [contact.id]: e.target.value }))}
                                  className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-600 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                                >
                                  {selectedPipeline[contact.id] === 'prospect' && (
                                    <>
                                      <option value="need-to-engage">Need to Engage</option>
                                      <option value="interest">Interest</option>
                                      <option value="meeting">Meeting</option>
                                      <option value="proposal">Proposal</option>
                                      <option value="contract">Contract</option>
                                      <option value="contract-signed">Contract Signed</option>
                                    </>
                                  )}
                                  {selectedPipeline[contact.id] === 'client' && (
                                    <>
                                      <option value="kickoff">Kickoff</option>
                                      <option value="work-started">Work Started</option>
                                      <option value="work-delivered">Work Delivered</option>
                                      <option value="sustainment">Sustainment</option>
                                      <option value="renewal">Renewal</option>
                                      <option value="terminated-contract">Terminated</option>
                                    </>
                                  )}
                                  {selectedPipeline[contact.id] === 'collaborator' && (
                                    <>
                                      <option value="interest">Interest</option>
                                      <option value="meeting">Meeting</option>
                                      <option value="moa">MOA</option>
                                      <option value="agreement">Agreement</option>
                                    </>
                                  )}
                                  {selectedPipeline[contact.id] === 'institution' && (
                                    <>
                                      <option value="interest">Interest</option>
                                      <option value="meeting">Meeting</option>
                                      <option value="moa">MOA</option>
                                      <option value="agreement">Agreement</option>
                                    </>
                                  )}
                                </select>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveStage(contact.id);
                                }}
                                disabled={savingStage[contact.id]}
                                className="px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium flex items-center gap-1"
                              >
                                {savingStage[contact.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                Save
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingStage(prev => ({ ...prev, [contact.id]: false }));
                                  setSelectedPipeline(prev => ({ ...prev, [contact.id]: contactPipeline }));
                                  setSelectedStage(prev => ({ ...prev, [contact.id]: contactStage || '' }));
                                }}
                                className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="mb-4 flex flex-wrap gap-2">
                          {contact.email && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEnrichContact(contact.id);
                              }}
                              disabled={enriching[contact.id]}
                              className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
                            >
                              {enriching[contact.id] ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Enriching...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-4 w-4" />
                                  {contactIsEnriched ? 'Re-enrich Contact' : 'Enrich Contact'}
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {/* Contact Information */}
                        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4 text-sm">
                          <div>
                            <dt className="font-semibold text-gray-500 mb-1">Email</dt>
                            <dd className="text-gray-900">{contact.email || '—'}</dd>
                          </div>
                          <div>
                            <dt className="font-semibold text-gray-500 mb-1">Phone</dt>
                            <dd className="text-gray-900">{contact.phone || '—'}</dd>
                          </div>
                          <div>
                            <dt className="font-semibold text-gray-500 mb-1">Title</dt>
                            <dd className="text-gray-900">{contact.title || '—'}</dd>
                          </div>
                          <div>
                            <dt className="font-semibold text-gray-500 mb-1">Company</dt>
                            <dd className="text-gray-900">
                              {!editingCompany[contact.id] ? (
                                <div className="flex items-center gap-2">
                                  <span>
                                    {contactCompany?.companyName || <span className="text-gray-400 italic">No company assigned</span>}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingCompany(prev => ({ ...prev, [contact.id]: true }));
                                      setSelectedCompany(prev => ({ ...prev, [contact.id]: contactCompany }));
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
                                    companyId={contactCompany?.id || null}
                                    selectedCompany={selectedCompany[contact.id]}
                                    onCompanySelect={(company) => setSelectedCompany(prev => ({ ...prev, [contact.id]: company }))}
                                    showLabel={false}
                                    placeholder="Search or create company..."
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSaveCompany(contact.id);
                                      }}
                                      disabled={savingCompany[contact.id] || !selectedCompany[contact.id]}
                                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
                                    >
                                      {savingCompany[contact.id] ? (
                                        <>
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                          Saving...
                                        </>
                                      ) : (
                                        <>
                                          <Check className="h-3 w-3" />
                                          Save
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingCompany(prev => ({ ...prev, [contact.id]: false }));
                                        setSelectedCompany(prev => ({ ...prev, [contact.id]: contactCompany }));
                                      }}
                                      disabled={savingCompany[contact.id]}
                                      className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 font-medium flex items-center gap-2"
                                    >
                                      <X className="h-3 w-3" />
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </dd>
                          </div>
                        </dl>

                        {/* Notes Section */}
                        <div className="border-t border-gray-200 pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-gray-900">Notes</h3>
                            {!editingNotes[contact.id] && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingNotes(prev => ({ ...prev, [contact.id]: true }));
                                  setNotesText(prev => ({ ...prev, [contact.id]: contact.notes || '' }));
                                }}
                                className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                                title="Edit notes"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          {!editingNotes[contact.id] ? (
                            <div>
                              {contact.notes ? (
                                <p className="text-sm text-gray-600 whitespace-pre-wrap">{contact.notes}</p>
                              ) : (
                                <p className="text-sm text-gray-400 italic">Add notes from meetings, emails, and relationship updates.</p>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <textarea
                                value={notesText[contact.id] || ''}
                                onChange={(e) => setNotesText(prev => ({ ...prev, [contact.id]: e.target.value }))}
                                placeholder="Add notes from meetings, emails, and relationship updates..."
                                className="w-full min-h-[100px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 resize-y"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveNotes(contact.id);
                                  }}
                                  disabled={savingNotes[contact.id]}
                                  className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {savingNotes[contact.id] ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      Saving...
                                    </>
                                  ) : (
                                    <>
                                      <Check className="h-4 w-4" />
                                      Save
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingNotes(prev => ({ ...prev, [contact.id]: false }));
                                    setNotesText(prev => ({ ...prev, [contact.id]: contact.notes || '' }));
                                  }}
                                  disabled={savingNotes[contact.id]}
                                  className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                                >
                                  <X className="h-4 w-4" />
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end">
          <button
            onClick={handleFinish}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Back to People Hub
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MicrosoftSuccess() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <MicrosoftSuccessContent />
    </Suspense>
  );
}
