'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import CompanySelector from '@/components/CompanySelector';
import PageHeader from '@/components/PageHeader.jsx';
import { Check, X, Home, Mail, User, Sparkles, Building2, FileText, Loader2, ArrowLeft, ArrowRight, Edit2, ChevronRight } from 'lucide-react';

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
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Per-contact editing state
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [editingCompany, setEditingCompany] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [savingCompany, setSavingCompany] = useState(false);
  const [editingStage, setEditingStage] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [savingStage, setSavingStage] = useState(false);
  const [enriching, setEnriching] = useState(false);

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

  // Update local state when current contact changes
  const currentContact = contacts[currentIndex];
  useEffect(() => {
    if (currentContact) {
      setNotesText(currentContact.notes || '');
      setEditingNotes(false);
      setEditingCompany(false);
      setEditingStage(false);
      const currentCompany = currentContact.companies || currentContact.company || currentContact.contactCompany || null;
      setSelectedCompany(currentCompany);
      const currentPipeline = currentContact.pipelines?.pipeline || currentContact.pipeline?.pipeline || 'unassigned';
      const currentStage = currentContact.pipelines?.stage || currentContact.pipeline?.stage || null;
      setSelectedPipeline(currentPipeline);
      setSelectedStage(currentStage || '');
    }
  }, [currentContact]);

  function handlePrevious() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }

  function handleNext() {
    if (currentIndex < contacts.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }

  async function handleSaveNotes() {
    if (!currentContact) return;
    setSavingNotes(true);
    
    try {
      const response = await api.put(`/api/contacts/${currentContact.id}`, {
        notes: notesText.trim() || null,
      });
      
      if (response.data?.success) {
        setContacts(prev => prev.map((c, idx) => 
          idx === currentIndex ? response.data.contact : c
        ));
        setEditingNotes(false);
      } else {
        alert(response.data?.error || 'Failed to save notes');
      }
    } catch (error) {
      console.error('Error saving notes:', error);
      alert(error.response?.data?.error || 'Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleSaveCompany() {
    if (!currentContact || !selectedCompany) {
      alert('Please select a company');
      return;
    }
    
    setSavingCompany(true);
    
    try {
      const response = await api.put(`/api/contacts/${currentContact.id}`, {
        contactCompanyId: selectedCompany.id,
        companyId: selectedCompany.id,
      });
      
      if (response.data?.success) {
        setContacts(prev => prev.map((c, idx) => 
          idx === currentIndex ? response.data.contact : c
        ));
        setEditingCompany(false);
      } else {
        alert(response.data?.error || 'Failed to assign company');
      }
    } catch (error) {
      console.error('Error assigning company:', error);
      alert(error.response?.data?.error || 'Failed to assign company');
    } finally {
      setSavingCompany(false);
    }
  }

  async function handleSaveStage() {
    if (!currentContact || !selectedPipeline) return;
    
    if (selectedPipeline !== 'unassigned' && !selectedStage) {
      alert('Please select both pipeline and stage');
      return;
    }
    
    setSavingStage(true);
    try {
      const payload = {
        pipeline: selectedPipeline,
      };
      if (selectedPipeline !== 'unassigned' && selectedStage) {
        payload.stage = selectedStage;
      }
      const response = await api.put(`/api/contacts/${currentContact.id}/pipeline`, payload);
      if (response.data?.success) {
        setContacts(prev => prev.map((c, idx) => 
          idx === currentIndex ? response.data.contact : c
        ));
        setEditingStage(false);
      } else {
        alert(response.data?.error || 'Failed to update pipeline');
      }
    } catch (error) {
      console.error('Error updating pipeline:', error);
      alert(error.response?.data?.error || 'Failed to update pipeline');
    } finally {
      setSavingStage(false);
    }
  }

  async function handleEnrichContact() {
    if (!currentContact?.email) {
      alert('Contact must have an email address to enrich');
      return;
    }
    
    setEnriching(true);
    
    try {
      const enrichResponse = await api.post('/api/contacts/enrich/by-email', {
        contactId: currentContact.id,
      });

      if (!enrichResponse.data?.success || !enrichResponse.data?.redisKey) {
        throw new Error(enrichResponse.data?.error || 'Enrichment failed');
      }

      const saveResponse = await api.post('/api/contacts/enrich/save', {
        contactId: currentContact.id,
        redisKey: enrichResponse.data.redisKey,
      });

      if (!saveResponse.data?.success) {
        throw new Error(saveResponse.data?.error || 'Failed to save enrichment');
      }

      const updatedContactResponse = await api.get(`/api/contacts/${currentContact.id}`);
      if (updatedContactResponse.data?.success && updatedContactResponse.data?.contact) {
        setContacts(prev => prev.map((c, idx) => 
          idx === currentIndex ? updatedContactResponse.data.contact : c
        ));
        alert('Contact enriched successfully!');
      }
    } catch (err) {
      console.error('Enrichment error:', err);
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to enrich contact';
      alert(errorMessage);
    } finally {
      setEnriching(false);
    }
  }

  function handleFinish() {
    router.push(`/contacts/view?companyHQId=${companyHQId}`);
  }

  function handleSkipAll() {
    router.push(`/contacts/view?companyHQId=${companyHQId}`);
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
                Go to People Hub
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const displayName = currentContact ? (
    [currentContact.firstName, currentContact.lastName]
      .filter(Boolean)
      .join(' ') || currentContact.email.split('@')[0]
  ) : 'Contact';

  const currentCompany = currentContact?.companies || currentContact?.company || currentContact?.contactCompany || null;
  const isEnriched = currentContact ? !!(
    currentContact.profileSummary ||
    (currentContact.seniorityScore !== null && currentContact.seniorityScore !== undefined) ||
    currentContact.enrichmentRedisKey
  ) : false;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Success Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
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
        </div>

        {/* Contact Counter */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-medium text-gray-700">
            Contact {currentIndex + 1} of {contacts.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex === contacts.length - 1}
              className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Contact Detail Card */}
        <div className="bg-white rounded-lg shadow border">
          <PageHeader
            title={displayName}
            subtitle="Review and update contact details"
            backTo={`/contacts/ingest/microsoft?companyHQId=${companyHQId}`}
            backLabel="Back to Import"
          />

          {/* Pipeline Status */}
          <div className="px-6 pb-4 flex flex-wrap items-center gap-4 text-sm">
            {!editingStage ? (
              <>
                <span className="rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-600">
                  {currentContact?.pipelines?.pipeline || currentContact?.pipeline?.pipeline || 'Unassigned'}
                </span>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-600">
                    {currentContact?.pipelines?.stage || currentContact?.pipeline?.stage || 'No Stage'}
                  </span>
                  <button
                    onClick={() => setEditingStage(true)}
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
                <button
                  onClick={handleSaveStage}
                  disabled={savingStage}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium flex items-center gap-1"
                >
                  {savingStage ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingStage(false);
                    const currentPipeline = currentContact?.pipelines?.pipeline || currentContact?.pipeline?.pipeline || 'unassigned';
                    const currentStage = currentContact?.pipelines?.stage || currentContact?.pipeline?.stage || null;
                    setSelectedPipeline(currentPipeline);
                    setSelectedStage(currentStage || '');
                  }}
                  className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="px-6 pb-4 flex flex-wrap gap-2">
            {currentContact?.email && (
              <button
                onClick={handleEnrichContact}
                disabled={enriching}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
              >
                {enriching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enriching...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {isEnriched ? 'Re-enrich Contact' : 'Enrich Contact'}
                  </>
                )}
              </button>
            )}
            {isEnriched && (
              <span className="px-3 py-2 text-sm bg-purple-100 text-purple-700 rounded-lg font-medium">
                ✓ Enriched
              </span>
            )}
          </div>

          {/* Contact Information */}
          <div className="px-6 pb-6 border-t">
            <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 mt-6">
              <div>
                <dt className="text-sm font-semibold text-gray-500">Preferred Name</dt>
                <dd className="mt-1 text-base text-gray-900">
                  {currentContact?.goesBy || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-gray-500">Email</dt>
                <dd className="mt-1 text-base text-gray-900">
                  {currentContact?.email || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-gray-500">Company</dt>
                <dd className="mt-1">
                  {!editingCompany ? (
                    <div className="flex items-center gap-2">
                      <span className="text-base text-gray-900">
                        {currentCompany?.companyName || <span className="text-gray-400 italic">No company assigned</span>}
                      </span>
                      <button
                        onClick={() => {
                          setEditingCompany(true);
                          setSelectedCompany(currentCompany);
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
                        companyId={currentCompany?.id || null}
                        selectedCompany={selectedCompany}
                        onCompanySelect={(company) => setSelectedCompany(company)}
                        showLabel={false}
                        placeholder="Search or create company..."
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveCompany}
                          disabled={savingCompany || !selectedCompany}
                          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
                        >
                          {savingCompany ? (
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
                          onClick={() => {
                            setEditingCompany(false);
                            setSelectedCompany(currentCompany);
                          }}
                          disabled={savingCompany}
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
              <div>
                <dt className="text-sm font-semibold text-gray-500">Full Name</dt>
                <dd className="mt-1 text-base text-gray-900">
                  {displayName}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-gray-500">Phone</dt>
                <dd className="mt-1 text-base text-gray-900">
                  {currentContact?.phone || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-gray-500">Title</dt>
                <dd className="mt-1 text-base text-gray-900">
                  {currentContact?.title || '—'}
                </dd>
              </div>
            </dl>
          </div>

          {/* Notes Section */}
          <div className="px-6 pb-6 border-t">
            <div className="flex items-center justify-between mt-6 mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Notes</h3>
              {!editingNotes && (
                <button
                  onClick={() => {
                    setEditingNotes(true);
                    setNotesText(currentContact?.notes || '');
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
                {currentContact?.notes ? (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{currentContact.notes}</p>
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
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingNotes ? (
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
                    onClick={() => {
                      setEditingNotes(false);
                      setNotesText(currentContact?.notes || '');
                    }}
                    disabled={savingNotes}
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

        {/* Navigation Footer */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={handleSkipAll}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
          >
            Skip All & Go to People Hub
          </button>
          <div className="flex items-center gap-3">
            {currentIndex === contacts.length - 1 ? (
              <button
                onClick={handleFinish}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
              >
                Finish
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
              >
                Next Contact
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
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
