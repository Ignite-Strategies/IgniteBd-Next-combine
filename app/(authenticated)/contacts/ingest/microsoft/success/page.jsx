'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import CompanySelector from '@/components/CompanySelector';
import { Check, X, Home, Mail, User, ChevronDown, ChevronUp, Sparkles, Building2, FileText, Loader2 } from 'lucide-react';

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
  
  // Per-contact state
  const [expandedContacts, setExpandedContacts] = useState(new Set());
  const [editingNotes, setEditingNotes] = useState(new Map()); // contactId -> notes text
  const [savingNotes, setSavingNotes] = useState(new Set());
  const [editingCompany, setEditingCompany] = useState(new Map()); // contactId -> selected company
  const [savingCompany, setSavingCompany] = useState(new Set());
  const [enriching, setEnriching] = useState(new Set()); // contactId -> enriching status

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

  function toggleExpand(contactId) {
    const newExpanded = new Set(expandedContacts);
    if (newExpanded.has(contactId)) {
      newExpanded.delete(contactId);
    } else {
      newExpanded.add(contactId);
    }
    setExpandedContacts(newExpanded);
  }

  async function handleSaveNotes(contactId) {
    const notesText = editingNotes.get(contactId) || '';
    setSavingNotes(prev => new Set(prev).add(contactId));
    
    try {
      const response = await api.put(`/api/contacts/${contactId}`, {
        notes: notesText.trim() || null,
      });
      
      if (response.data?.success) {
        // Update contact in state
        setContacts(prev => prev.map(c => 
          c.id === contactId ? response.data.contact : c
        ));
        // Clear editing state
        const newEditing = new Map(editingNotes);
        newEditing.delete(contactId);
        setEditingNotes(newEditing);
      } else {
        alert(response.data?.error || 'Failed to save notes');
      }
    } catch (error) {
      console.error('Error saving notes:', error);
      alert(error.response?.data?.error || 'Failed to save notes');
    } finally {
      setSavingNotes(prev => {
        const next = new Set(prev);
        next.delete(contactId);
        return next;
      });
    }
  }

  async function handleSaveCompany(contactId) {
    const selectedCompany = editingCompany.get(contactId);
    if (!selectedCompany) {
      alert('Please select a company');
      return;
    }
    
    setSavingCompany(prev => new Set(prev).add(contactId));
    
    try {
      const response = await api.put(`/api/contacts/${contactId}`, {
        contactCompanyId: selectedCompany.id,
        companyId: selectedCompany.id,
      });
      
      if (response.data?.success) {
        // Update contact in state
        setContacts(prev => prev.map(c => 
          c.id === contactId ? response.data.contact : c
        ));
        // Clear editing state
        const newEditing = new Map(editingCompany);
        newEditing.delete(contactId);
        setEditingCompany(newEditing);
      } else {
        alert(response.data?.error || 'Failed to assign company');
      }
    } catch (error) {
      console.error('Error assigning company:', error);
      alert(error.response?.data?.error || 'Failed to assign company');
    } finally {
      setSavingCompany(prev => {
        const next = new Set(prev);
        next.delete(contactId);
        return next;
      });
    }
  }

  async function handleEnrichContact(contact) {
    if (!contact.email) {
      alert('Contact must have an email address to enrich');
      return;
    }
    
    setEnriching(prev => new Set(prev).add(contact.id));
    
    try {
      // Step 1: Enrich by email
      const enrichResponse = await api.post('/api/contacts/enrich/by-email', {
        contactId: contact.id,
      });

      if (!enrichResponse.data?.success || !enrichResponse.data?.redisKey) {
        throw new Error(enrichResponse.data?.error || 'Enrichment failed');
      }

      // Step 2: Automatically save the enrichment
      const saveResponse = await api.post('/api/contacts/enrich/save', {
        contactId: contact.id,
        redisKey: enrichResponse.data.redisKey,
      });

      if (!saveResponse.data?.success) {
        throw new Error(saveResponse.data?.error || 'Failed to save enrichment');
      }

      // Step 3: Refresh contact data
      const updatedContactResponse = await api.get(`/api/contacts/${contact.id}`);
      if (updatedContactResponse.data?.success && updatedContactResponse.data?.contact) {
        setContacts(prev => prev.map(c => 
          c.id === contact.id ? updatedContactResponse.data.contact : c
        ));
        alert('Contact enriched successfully!');
      }
    } catch (err) {
      console.error('Enrichment error:', err);
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to enrich contact';
      alert(errorMessage);
    } finally {
      setEnriching(prev => {
        const next = new Set(prev);
        next.delete(contact.id);
        return next;
      });
    }
  }

  function handleGoHome() {
    router.push(`/contacts/view?companyHQId=${companyHQId}`);
  }

  function handleFinished() {
    router.push(`/contacts/ingest/microsoft?companyHQId=${companyHQId}`);
  }

  function handleEditFullPage(contactId) {
    router.push(`/contacts/${contactId}?companyHQId=${companyHQId}`);
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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="mx-auto max-w-4xl px-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">{error}</p>
            <button
              onClick={handleFinished}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-4xl px-6">
        {/* Success Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Successfully Imported {saved} Contact{saved !== 1 ? 's' : ''}
              </h1>
              {skipped > 0 && (
                <p className="text-gray-600 mt-1">
                  {skipped} contact{skipped !== 1 ? 's' : ''} skipped (already exist)
                </p>
              )}
              <p className="text-sm text-gray-500 mt-2">
                Expand each contact to add notes, assign company, or enrich with additional data
              </p>
            </div>
          </div>
        </div>

        {/* Contacts List */}
        {contacts.length > 0 ? (
          <div className="space-y-4 mb-6">
            {contacts.map((contact) => {
              const displayName = [contact.firstName, contact.lastName]
                .filter(Boolean)
                .join(' ') || contact.email.split('@')[0];
              
              const isExpanded = expandedContacts.has(contact.id);
              const isEditingNotes = editingNotes.has(contact.id);
              const isEditingCompany = editingCompany.has(contact.id);
              const isSavingNotes = savingNotes.has(contact.id);
              const isSavingCompany = savingCompany.has(contact.id);
              const isEnriching = enriching.has(contact.id);
              
              const currentCompany = contact.companies || contact.company || contact.contactCompany || null;
              const notesText = editingNotes.get(contact.id) ?? (contact.notes || '');
              const selectedCompany = editingCompany.get(contact.id) || currentCompany;
              
              const isEnriched = !!(
                contact.profileSummary ||
                (contact.seniorityScore !== null && contact.seniorityScore !== undefined) ||
                contact.enrichmentRedisKey
              );

              return (
                <div
                  key={contact.id}
                  className="bg-white rounded-lg shadow border overflow-hidden"
                >
                  {/* Contact Header - Always Visible */}
                  <div 
                    className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => toggleExpand(contact.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 flex items-center gap-3">
                        <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-medium text-gray-900 truncate">
                            {displayName}
                          </h3>
                          <div className="flex items-center gap-4 mt-1">
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Mail className="h-4 w-4" />
                              <span className="truncate">{contact.email}</span>
                            </div>
                            {currentCompany && (
                              <div className="flex items-center gap-1 text-sm text-gray-500">
                                <Building2 className="h-4 w-4" />
                                <span className="truncate">{currentCompany.companyName}</span>
                              </div>
                            )}
                            {isEnriched && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                                Enriched
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t px-6 py-4 space-y-6">
                      {/* Basic Info */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-gray-500">First Name</label>
                          <p className="text-sm text-gray-900 mt-1">
                            {contact.firstName || <span className="text-gray-400">—</span>}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500">Last Name</label>
                          <p className="text-sm text-gray-900 mt-1">
                            {contact.lastName || <span className="text-gray-400">—</span>}
                          </p>
                        </div>
                        {contact.title && (
                          <div>
                            <label className="text-xs font-medium text-gray-500">Title</label>
                            <p className="text-sm text-gray-900 mt-1">{contact.title}</p>
                          </div>
                        )}
                        {contact.phone && (
                          <div>
                            <label className="text-xs font-medium text-gray-500">Phone</label>
                            <p className="text-sm text-gray-900 mt-1">{contact.phone}</p>
                          </div>
                        )}
                      </div>

                      {/* Company Assignment */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium text-gray-700">Company</label>
                          {!isEditingCompany && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const newEditing = new Map(editingCompany);
                                newEditing.set(contact.id, currentCompany);
                                setEditingCompany(newEditing);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                            >
                              {currentCompany ? 'Change' : 'Assign'}
                            </button>
                          )}
                        </div>
                        {!isEditingCompany ? (
                          <p className="text-sm text-gray-900">
                            {currentCompany?.companyName || <span className="text-gray-400 italic">No company assigned</span>}
                          </p>
                        ) : (
                          <div className="space-y-2">
                            <CompanySelector
                              companyId={currentCompany?.id || null}
                              selectedCompany={selectedCompany}
                              onCompanySelect={(company) => {
                                const newEditing = new Map(editingCompany);
                                newEditing.set(contact.id, company);
                                setEditingCompany(newEditing);
                              }}
                              showLabel={false}
                              placeholder="Search or create company..."
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveCompany(contact.id);
                                }}
                                disabled={isSavingCompany || !selectedCompany}
                                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
                              >
                                {isSavingCompany ? (
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
                                  const newEditing = new Map(editingCompany);
                                  newEditing.delete(contact.id);
                                  setEditingCompany(newEditing);
                                }}
                                disabled={isSavingCompany}
                                className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 font-medium flex items-center gap-2"
                              >
                                <X className="h-3 w-3" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Notes */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium text-gray-700">Notes</label>
                          {!isEditingNotes && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const newEditing = new Map(editingNotes);
                                newEditing.set(contact.id, contact.notes || '');
                                setEditingNotes(newEditing);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                            >
                              {contact.notes ? 'Edit' : 'Add'}
                            </button>
                          )}
                        </div>
                        {!isEditingNotes ? (
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">
                            {contact.notes || <span className="text-gray-400 italic">No notes yet</span>}
                          </p>
                        ) : (
                          <div className="space-y-2">
                            <textarea
                              value={notesText}
                              onChange={(e) => {
                                const newEditing = new Map(editingNotes);
                                newEditing.set(contact.id, e.target.value);
                                setEditingNotes(newEditing);
                              }}
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
                                disabled={isSavingNotes}
                                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
                              >
                                {isSavingNotes ? (
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
                                  const newEditing = new Map(editingNotes);
                                  newEditing.delete(contact.id);
                                  setEditingNotes(newEditing);
                                }}
                                disabled={isSavingNotes}
                                className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 font-medium flex items-center gap-2"
                              >
                                <X className="h-3 w-3" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 pt-4 border-t">
                        {contact.email && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEnrichContact(contact);
                            }}
                            disabled={isEnriching}
                            className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
                          >
                            {isEnriching ? (
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditFullPage(contact.id);
                          }}
                          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
                        >
                          <FileText className="h-4 w-4" />
                          Full Detail Page
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <div className="flex items-start">
              <X className="h-5 w-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-yellow-800 mb-1">
                  No contacts to display
                </h3>
                <p className="text-sm text-yellow-700">
                  All selected contacts were skipped because they already exist in your database.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleFinished}
            className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
          >
            Import More Contacts
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={handleGoHome}
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
