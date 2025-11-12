'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { useProposals } from '../layout';
import { useContacts } from '@/app/(authenticated)/contacts/layout';
import api from '@/lib/api';

const WIZARD_STEPS = {
  CONTACT_SELECT: 'contact-select',
  CONFIRM_BUSINESS: 'confirm-business',
  PROPOSAL_FIELDS: 'proposal-fields',
  DELIVERABLES: 'deliverables',
  REVIEW: 'review',
};

export default function ProposalWizardPage() {
  const router = useRouter();
  const { addProposal, companyHQId } = useProposals();
  const { contacts, refreshContacts } = useContacts();

  const [currentStep, setCurrentStep] = useState(WIZARD_STEPS.CONTACT_SELECT);
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [contactSearch, setContactSearch] = useState('');
  const [proposalFields, setProposalFields] = useState({
    purpose: '',
    totalPrice: '',
  });
  const [deliverables, setDeliverables] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Hydrate contacts on mount
  useEffect(() => {
    if (contacts.length === 0) {
      refreshContacts();
    }
  }, [contacts.length, refreshContacts]);

  // Filter contacts by search
  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts.slice(0, 20);
    const searchLower = contactSearch.toLowerCase();
    return contacts.filter(
      (contact) =>
        contact.firstName?.toLowerCase().includes(searchLower) ||
        contact.lastName?.toLowerCase().includes(searchLower) ||
        contact.email?.toLowerCase().includes(searchLower) ||
        contact.contactCompany?.companyName?.toLowerCase().includes(searchLower)
    ).slice(0, 20);
  }, [contacts, contactSearch]);

  // Handle contact selection
  const handleContactSelect = (contact) => {
    setSelectedContact(contact);
    // Auto-set company if contact has one
    if (contact.contactCompany) {
      setSelectedCompany(contact.contactCompany);
      setCurrentStep(WIZARD_STEPS.CONFIRM_BUSINESS);
    } else {
      setCurrentStep(WIZARD_STEPS.CONFIRM_BUSINESS);
    }
  };

  // Handle company confirmation/creation
  const handleCompanyConfirm = async (companyName) => {
    if (!companyHQId || !selectedContact) return;

    try {
      // Follow contact-first pattern: link to tenant, then create based on contact/companyId associations
      // Step 1: Upsert Company (scoped to companyHQId)
      const createResponse = await api.post('/api/companies', {
        companyHQId,
        companyName,
      });

      const company = createResponse.data?.company;
      if (!company) {
        throw new Error('Failed to create or find company');
      }

      // Step 2: Link contact to company
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
      } else {
        // Set company directly if contact doesn't have it yet
        setSelectedCompany(company);
      }
      
      setCurrentStep(WIZARD_STEPS.PROPOSAL_FIELDS);
    } catch (err) {
      console.error('Error confirming company:', err);
      setError('Failed to confirm company. Please try again.');
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
    if (!companyHQId || !selectedContact || !selectedCompany) {
      setError('Missing required information.');
      return;
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
              deliverables: deliverables.map((d) => d.actualDeliverable),
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
      setError('Unable to save proposal. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Create Proposal"
          subtitle="Contact-first proposal creation wizard"
          backTo="/client-operations/proposals"
          backLabel="Back to Proposals"
        />

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[
              { key: WIZARD_STEPS.CONTACT_SELECT, label: 'Select Contact' },
              { key: WIZARD_STEPS.CONFIRM_BUSINESS, label: 'Confirm Business' },
              { key: WIZARD_STEPS.PROPOSAL_FIELDS, label: 'Proposal Fields' },
              { key: WIZARD_STEPS.DELIVERABLES, label: 'Deliverables' },
              { key: WIZARD_STEPS.REVIEW, label: 'Review' },
            ].map((step, index, array) => {
              const stepIndex = Object.values(WIZARD_STEPS).indexOf(step.key);
              const currentIndex = Object.values(WIZARD_STEPS).indexOf(currentStep);
              const isActive = stepIndex === currentIndex;
              const isCompleted = stepIndex < currentIndex;

              return (
                <div key={step.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                        isActive
                          ? 'border-red-600 bg-red-600 text-white'
                          : isCompleted
                            ? 'border-green-600 bg-green-600 text-white'
                            : 'border-gray-300 bg-white text-gray-400'
                      }`}
                    >
                      {isCompleted ? '✓' : index + 1}
                    </div>
                    <p
                      className={`mt-2 text-xs ${
                        isActive ? 'font-semibold text-red-600' : 'text-gray-500'
                      }`}
                    >
                      {step.label}
                    </p>
                  </div>
                  {index < array.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-2 ${
                        isCompleted ? 'bg-green-600' : 'bg-gray-300'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-2xl bg-white p-6 shadow">
          {/* Step 1: Contact Select */}
          {currentStep === WIZARD_STEPS.CONTACT_SELECT && (
            <div>
              <h2 className="mb-4 text-xl font-semibold text-gray-900">
                Select Contact
              </h2>
              <p className="mb-6 text-sm text-gray-600">
                Search and select the contact for this proposal.
              </p>
              <input
                type="text"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Search contacts by name or email..."
                className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {filteredContacts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">
                    No contacts found. Create a contact first.
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
                        {selectedContact?.id === contact.id && (
                          <span className="text-green-600">✓</span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Step 2: Confirm Business */}
          {currentStep === WIZARD_STEPS.CONFIRM_BUSINESS && (
            <div>
              <h2 className="mb-4 text-xl font-semibold text-gray-900">
                Confirm Business
              </h2>
              {selectedCompany ? (
                <div>
                  <p className="mb-4 text-sm text-gray-600">
                    Company: <span className="font-semibold">{selectedCompany.companyName}</span>
                  </p>
                  <button
                    onClick={() => setCurrentStep(WIZARD_STEPS.PROPOSAL_FIELDS)}
                    className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                  >
                    Continue
                  </button>
                </div>
              ) : (
                <div>
                  <p className="mb-4 text-sm text-gray-600">
                    Enter the company name for {selectedContact?.firstName} {selectedContact?.lastName}:
                  </p>
                  <input
                    type="text"
                    placeholder="Company name"
                    className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.target.value) {
                        handleCompanyConfirm(e.target.value);
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      const input = document.querySelector('input[placeholder="Company name"]');
                      if (input?.value) {
                        handleCompanyConfirm(input.value);
                      }
                    }}
                    className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                  >
                    Confirm & Continue
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Proposal Fields */}
          {currentStep === WIZARD_STEPS.PROPOSAL_FIELDS && (
            <div>
              <h2 className="mb-4 text-xl font-semibold text-gray-900">
                Proposal Details
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
                <button
                  onClick={() => setCurrentStep(WIZARD_STEPS.DELIVERABLES)}
                  className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Continue to Deliverables
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Deliverables */}
          {currentStep === WIZARD_STEPS.DELIVERABLES && (
            <div>
              <h2 className="mb-4 text-xl font-semibold text-gray-900">
                Deliverables
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
                          placeholder="e.g., Strategy, Design, Development"
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
                <button
                  onClick={() => setCurrentStep(WIZARD_STEPS.REVIEW)}
                  className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Continue to Review
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {currentStep === WIZARD_STEPS.REVIEW && (
            <div>
              <h2 className="mb-4 text-xl font-semibold text-gray-900">Review</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500">Contact</p>
                  <p className="font-semibold text-gray-900">
                    {selectedContact?.firstName} {selectedContact?.lastName}
                  </p>
                  <p className="text-sm text-gray-600">{selectedContact?.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Company</p>
                  <p className="font-semibold text-gray-900">
                    {selectedCompany?.companyName}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Purpose</p>
                  <p className="text-sm text-gray-900">{proposalFields.purpose || 'N/A'}</p>
                </div>
                {proposalFields.totalPrice && (
                  <div>
                    <p className="text-xs text-gray-500">Total Price</p>
                    <p className="font-semibold text-gray-900">
                      ${Number.parseFloat(proposalFields.totalPrice.replace(/[^0-9.]/g, '')).toLocaleString()}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500">Deliverables ({deliverables.length})</p>
                  <ul className="mt-2 space-y-1">
                    {deliverables.map((d, idx) => (
                      <li key={d.id} className="text-sm text-gray-700">
                        {idx + 1}. {d.actualDeliverable || d.typeOfWork || 'Untitled'}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setCurrentStep(WIZARD_STEPS.DELIVERABLES)}
                    className="rounded-lg bg-gray-100 px-5 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                  >
                    {submitting ? 'Creating...' : 'Create Proposal'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

