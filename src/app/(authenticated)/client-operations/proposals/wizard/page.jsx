'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { useProposals } from '../layout';
import { useContacts } from '@/app/(authenticated)/contacts/layout';
import api from '@/lib/api';

export default function ProposalWizardPage() {
  const router = useRouter();
  const { addProposal, companyHQId } = useProposals();
  const { contacts, refreshContacts, hydrated: contactsHydrated } = useContacts();

  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companyNameInput, setCompanyNameInput] = useState('');
  const [proposalFields, setProposalFields] = useState({
    purpose: '',
    totalPrice: '',
  });
  const [deliverables, setDeliverables] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loadingCompany, setLoadingCompany] = useState(false);

  // Hydrate contacts on mount
  useEffect(() => {
    if (!contactsHydrated && contacts.length === 0) {
      refreshContacts();
    }
  }, [contactsHydrated, contacts.length, refreshContacts]);

  // Filter contacts by search
  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) {
      return contacts.slice(0, 20);
    }
    const searchLower = contactSearch.toLowerCase().trim();
    return contacts.filter(
      (contact) => {
        const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
        const email = (contact.email || '').toLowerCase();
        const company = (contact.contactCompany?.companyName || '').toLowerCase();
        return (
          fullName.includes(searchLower) ||
          email.includes(searchLower) ||
          company.includes(searchLower)
        );
      }
    ).slice(0, 20);
  }, [contacts, contactSearch]);

  // Handle contact selection - auto-hydrate company
  const handleContactSelect = async (contact) => {
    setSelectedContact(contact);
    setError('');
    
    // Auto-hydrate company if contact has one
    if (contact.contactCompany) {
      setSelectedCompany(contact.contactCompany);
      setCompanyNameInput(contact.contactCompany.companyName);
    } else {
      // No company - clear and let them enter
      setSelectedCompany(null);
      setCompanyNameInput('');
    }
  };

  // Handle company confirmation/creation
  const handleCompanyConfirm = async () => {
    if (!companyHQId || !selectedContact) return;
    if (!companyNameInput.trim()) {
      setError('Please enter a company name');
      return;
    }

    setLoadingCompany(true);
    setError('');

    try {
      // Upsert Company (scoped to companyHQId)
      const createResponse = await api.post('/api/companies', {
        companyHQId,
        companyName: companyNameInput.trim(),
      });

      const company = createResponse.data?.company;
      if (!company) {
        throw new Error('Failed to create or find company');
      }

      // Link contact to company
      await api.put(`/api/contacts/${selectedContact.id}`, {
        contactCompanyId: company.id,
      });

      // Refresh contacts to get updated data
      await refreshContacts();
      
      // Get updated contact
      const updatedContacts = await api.get(`/api/contacts?companyHQId=${companyHQId}`);
      const updatedContact = updatedContacts.data?.contacts?.find(
        (c) => c.id === selectedContact.id
      );

      if (updatedContact?.contactCompany) {
        setSelectedCompany(updatedContact.contactCompany);
        setSelectedContact(updatedContact);
        setCompanyNameInput(updatedContact.contactCompany.companyName);
      } else {
        setSelectedCompany(company);
        setCompanyNameInput(company.companyName);
      }
    } catch (err) {
      console.error('Error confirming company:', err);
      setError('Failed to confirm company. Please try again.');
    } finally {
      setLoadingCompany(false);
    }
  };

  // Add deliverable
  const handleAddDeliverable = () => {
    setDeliverables([
      ...deliverables,
      {
        id: `temp-${Date.now()}`,
        typeOfWork: '',
        quantity: 1,
        actualDeliverable: '',
      },
    ]);
  };

  // Remove deliverable
  const handleRemoveDeliverable = (id) => {
    setDeliverables(deliverables.filter((d) => d.id !== id));
  };

  // Update deliverable
  const handleUpdateDeliverable = (id, updates) => {
    setDeliverables(
      deliverables.map((d) => (d.id === id ? { ...d, ...updates } : d))
    );
  };

  // Submit proposal
  const handleSubmit = async () => {
    if (!companyHQId || !selectedContact) {
      setError('Please select a contact');
      return;
    }

    if (!selectedCompany && !companyNameInput.trim()) {
      setError('Please confirm or enter a company name');
      return;
    }

    // If company not confirmed yet, confirm it first
    if (!selectedCompany && companyNameInput.trim()) {
      await handleCompanyConfirm();
      if (!selectedCompany) {
        return; // Error already set
      }
    }

    setSubmitting(true);
    setError('');

    try {
      // Build phases from deliverables
      const phases = deliverables.length > 0
        ? [
            {
              id: 1,
              name: 'Foundation',
              weeks: '1-4',
              color: 'red',
              goal: 'Deliver core deliverables',
              deliverables: deliverables.map((d) => d.actualDeliverable).filter(Boolean),
              outcome: 'Core deliverables completed',
            },
          ]
        : null;

      // Build milestones from deliverables
      const milestones = deliverables.map((deliverable, index) => ({
        week: index + 1,
        phase: 'Foundation',
        phaseColor: 'red',
        milestone: deliverable.typeOfWork || `Deliverable ${index + 1}`,
        deliverable: deliverable.actualDeliverable,
        phaseId: 1,
      }));

      const payload = {
        companyHQId,
        clientName: `${selectedContact.firstName || ''} ${selectedContact.lastName || ''}`.trim() || selectedContact.email,
        clientCompany: selectedCompany.companyName,
        companyId: selectedCompany.id,
        purpose: proposalFields.purpose,
        totalPrice: proposalFields.totalPrice
          ? Number.parseFloat(proposalFields.totalPrice.replace(/[^0-9.]/g, ''))
          : null,
        status: 'draft',
        phases,
        milestones,
        preparedBy: typeof window !== 'undefined' ? window.localStorage.getItem('ownerId') : null,
      };

      const response = await api.post('/api/proposals', payload);
      const proposal = response.data?.proposal;

      if (!proposal) {
        throw new Error('Proposal response missing payload');
      }

      // Add to context
      addProposal(proposal);

      // Navigate to proposal detail
      router.push(`/client-operations/proposals/${proposal.id}`);
    } catch (err) {
      console.error('Error creating proposal:', err);
      setError(err.response?.data?.error || 'Unable to save proposal. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Create Proposal"
          subtitle="Contact-first proposal creation"
          backTo="/client-operations/proposals"
          backLabel="Back to Proposals"
        />

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Contact Selection */}
          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              1. Select Contact
            </h2>
            <input
              type="text"
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              placeholder="Search contacts by name, email, or company..."
              className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
            />
            {selectedContact && (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {selectedContact.firstName} {selectedContact.lastName}
                    </p>
                    <p className="text-sm text-gray-600">{selectedContact.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedContact(null);
                      setSelectedCompany(null);
                      setCompanyNameInput('');
                    }}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Change
                  </button>
                </div>
              </div>
            )}
            {!selectedContact && (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {filteredContacts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">
                    {contacts.length === 0
                      ? 'No contacts found. Create a contact first.'
                      : 'No contacts match your search.'}
                  </p>
                ) : (
                  filteredContacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => handleContactSelect(contact)}
                      className="w-full rounded-lg border border-gray-200 bg-white p-4 text-left transition hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {contact.firstName} {contact.lastName}
                          </p>
                          <p className="text-sm text-gray-600">{contact.email}</p>
                          {contact.contactCompany && (
                            <p className="text-xs text-gray-500">
                              {contact.contactCompany.companyName}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Company Confirmation - Only show if contact selected */}
          {selectedContact && (
            <div className="rounded-2xl bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                2. Confirm Business
              </h2>
              {selectedCompany ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="text-sm text-gray-600 mb-1">Company</p>
                  <p className="font-semibold text-gray-900">{selectedCompany.companyName}</p>
                  <button
                    onClick={() => {
                      setSelectedCompany(null);
                      setCompanyNameInput(selectedCompany.companyName);
                    }}
                    className="mt-2 text-sm text-red-600 hover:text-red-700"
                  >
                    Change Company
                  </button>
                </div>
              ) : (
                <div>
                  <p className="mb-4 text-sm text-gray-600">
                    Enter the company name for this proposal:
                  </p>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={companyNameInput}
                      onChange={(e) => setCompanyNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && companyNameInput.trim()) {
                          handleCompanyConfirm();
                        }
                      }}
                      placeholder="Company name"
                      className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                      disabled={loadingCompany}
                    />
                    <button
                      onClick={handleCompanyConfirm}
                      disabled={loadingCompany || !companyNameInput.trim()}
                      className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingCompany ? 'Confirming...' : 'Confirm'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Proposal Fields - Only show if company confirmed */}
          {selectedCompany && (
            <>
              <div className="rounded-2xl bg-white p-6 shadow">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">
                  3. Proposal Details
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      Purpose / Summary
                    </label>
                    <textarea
                      value={proposalFields.purpose}
                      onChange={(e) =>
                        setProposalFields({ ...proposalFields, purpose: e.target.value })
                      }
                      rows={4}
                      placeholder="Describe the engagement objective, desired outcomes, or solution."
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      Total Price (optional)
                    </label>
                    <input
                      type="text"
                      value={proposalFields.totalPrice}
                      onChange={(e) =>
                        setProposalFields({ ...proposalFields, totalPrice: e.target.value })
                      }
                      placeholder="$12,000"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    />
                  </div>
                </div>
              </div>

              {/* Deliverables */}
              <div className="rounded-2xl bg-white p-6 shadow">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">
                  4. Deliverables
                </h2>
                <p className="mb-6 text-sm text-gray-600">
                  Define what you'll deliver for this engagement.
                </p>
                <div className="space-y-4">
                  {deliverables.map((deliverable) => (
                    <div
                      key={deliverable.id}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                    >
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-gray-700">
                            Type of Work
                          </label>
                          <input
                            type="text"
                            value={deliverable.typeOfWork}
                            onChange={(e) =>
                              handleUpdateDeliverable(deliverable.id, {
                                typeOfWork: e.target.value,
                              })
                            }
                            placeholder="e.g., Strategy, Design"
                            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-gray-700">
                            How Many
                          </label>
                          <input
                            type="number"
                            value={deliverable.quantity}
                            onChange={(e) =>
                              handleUpdateDeliverable(deliverable.id, {
                                quantity: parseInt(e.target.value) || 1,
                              })
                            }
                            min="1"
                            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-gray-700">
                            Actual Deliverable
                          </label>
                          <input
                            type="text"
                            value={deliverable.actualDeliverable}
                            onChange={(e) =>
                              handleUpdateDeliverable(deliverable.id, {
                                actualDeliverable: e.target.value,
                              })
                            }
                            placeholder="e.g., 3 Target Personas"
                            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveDeliverable(deliverable.id)}
                        className="mt-2 text-xs text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={handleAddDeliverable}
                    className="w-full rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-red-500 hover:bg-red-50"
                  >
                    + Add Deliverable
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => router.push('/client-operations/proposals')}
                  className="rounded-lg bg-gray-100 px-5 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                >
                  {submitting ? 'Creating...' : 'Create Proposal'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
