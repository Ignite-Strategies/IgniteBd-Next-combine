'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import ContactSelector from '@/components/ContactSelector.jsx';
import { Plus, Save, X, CheckCircle } from 'lucide-react';
import api from '@/lib/api';

/**
 * Blank Proposal Builder
 * Create proposal from scratch with manual deliverable entry (flat schema)
 */
function BlankProposalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState('create'); // 'create' | 'add-deliverables'
  const [proposalId, setProposalId] = useState(null);
  const [contactId, setContactId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [companyHQId, setCompanyHQId] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deliverables, setDeliverables] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load companyHQId on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hqId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId');
      if (hqId) setCompanyHQId(hqId);
    }
  }, []);

  const handleAddDeliverable = () => {
    setDeliverables([
      ...deliverables,
      {
        id: `deliverable-${Date.now()}`,
        phaseName: '',
        deliverableName: '',
        description: '',
        unit: '',
        quantity: null,
        durationUnit: 'hour',
        durationUnits: null,
      },
    ]);
  };

  const handleUpdateDeliverable = (id, updates) => {
    setDeliverables(deliverables.map(d => (d.id === id ? { ...d, ...updates } : d)));
  };

  const handleRemoveDeliverable = (id) => {
    setDeliverables(deliverables.filter(d => d.id !== id));
  };

  // Step 1: Create proposal (without deliverables)
  const handleCreateProposal = async () => {
    if (!title.trim() || !contactId || !companyId) {
      setError('Please fill in all required fields');
      return;
    }

    if (!companyHQId) {
      setError('CompanyHQ ID not found');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Create proposal without deliverables
      const response = await api.post('/api/proposals/create/blank', {
        companyHQId,
        contactId,
        companyId,
        title: title.trim(),
        description: description.trim() || null,
      });

      if (response.data?.success) {
        const proposal = response.data.proposal;
        setProposalId(proposal.id);
        
        // Save to localStorage
        if (typeof window !== 'undefined') {
          const cached = window.localStorage.getItem('proposals');
          const existing = cached ? JSON.parse(cached) : [];
          const updated = [...existing, proposal];
          window.localStorage.setItem('proposals', JSON.stringify(updated));
        }
        
        // Move to add deliverables step
        setStep('add-deliverables');
      } else {
        setError(response.data?.error || 'Failed to create proposal');
      }
    } catch (err) {
      console.error('Error creating proposal:', err);
      setError(err.response?.data?.error || 'Failed to create proposal');
    } finally {
      setSaving(false);
    }
  };

  // Step 2: Save deliverables to existing proposal
  const handleSaveDeliverables = async () => {
    if (!proposalId) {
      setError('Proposal ID not found');
      return;
    }

    // Validate deliverables
    const invalidDeliverables = deliverables.filter(d => !d.deliverableName.trim());
    if (invalidDeliverables.length > 0) {
      setError('Please provide a deliverable name for all items');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Map deliverables to ProposalDeliverable format
      // Store phaseName, unit, durationUnit, durationUnits in notes as JSON
      const deliverablesToSave = deliverables.map(d => {
        const notesData = {
          phaseName: d.phaseName || '',
          unit: d.unit || null,
          durationUnit: d.durationUnit || 'hour',
          durationUnits: d.durationUnits || null,
        };

        return {
          name: d.deliverableName.trim(), // Store deliverableName in name field
          description: d.description || null,
          quantity: d.quantity || 1,
          notes: JSON.stringify(notesData), // Store phaseName and other fields in notes
        };
      });

      // Add deliverables to proposal
      const response = await api.post(`/api/proposals/${proposalId}/deliverables`, {
        deliverables: deliverablesToSave,
      });

      if (response.data?.success) {
        // Redirect to proposal page
        router.push(`/proposals/${proposalId}`);
      } else {
        setError(response.data?.error || 'Failed to save deliverables');
      }
    } catch (err) {
      console.error('Error saving deliverables:', err);
      setError(err.response?.data?.error || 'Failed to save deliverables');
    } finally {
      setSaving(false);
    }
  };

  if (step === 'add-deliverables') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <PageHeader
            title="Add Deliverables"
            subtitle="Add deliverables to your proposal"
            backTo="/client-operations/proposals/create"
            backLabel="Back to Create Proposal"
          />

          {error && (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-8 space-y-6">
            {/* Deliverables Section */}
            <section className="rounded-2xl bg-white p-6 shadow">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Deliverables</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Add deliverables to your proposal. All fields except deliverable name are optional.
                  </p>
                </div>
                <button
                  onClick={handleAddDeliverable}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Deliverable
                </button>
              </div>

              <div className="space-y-4">
                {deliverables.map((deliverable) => (
                  <div key={deliverable.id} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900">Deliverable</h3>
                      <button
                        onClick={() => handleRemoveDeliverable(deliverable.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Phase Name
                        </label>
                        <input
                          type="text"
                          value={deliverable.phaseName}
                          onChange={(e) => handleUpdateDeliverable(deliverable.id, { phaseName: e.target.value })}
                          placeholder="e.g., Collateral Generation"
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Deliverable Name *
                        </label>
                        <input
                          type="text"
                          value={deliverable.deliverableName}
                          onChange={(e) => handleUpdateDeliverable(deliverable.id, { deliverableName: e.target.value })}
                          placeholder="e.g., Persona Development"
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                          required
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Description
                        </label>
                        <textarea
                          value={deliverable.description}
                          onChange={(e) => handleUpdateDeliverable(deliverable.id, { description: e.target.value })}
                          placeholder="Deliverable description..."
                          rows={2}
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Unit
                        </label>
                        <input
                          type="text"
                          value={deliverable.unit}
                          onChange={(e) => handleUpdateDeliverable(deliverable.id, { unit: e.target.value })}
                          placeholder="e.g., item, blog, deck"
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          value={deliverable.quantity || ''}
                          onChange={(e) => handleUpdateDeliverable(deliverable.id, { quantity: e.target.value ? parseInt(e.target.value, 10) : null })}
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Duration Unit
                        </label>
                        <select
                          value={deliverable.durationUnit}
                          onChange={(e) => handleUpdateDeliverable(deliverable.id, { durationUnit: e.target.value })}
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                        >
                          <option value="hour">Hour</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Duration Units
                        </label>
                        <input
                          type="number"
                          value={deliverable.durationUnits || ''}
                          onChange={(e) => handleUpdateDeliverable(deliverable.id, { durationUnits: e.target.value ? parseInt(e.target.value, 10) : null })}
                          placeholder="e.g., 3"
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {deliverables.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                    <p className="text-sm text-gray-600 mb-4">
                      No deliverables added yet. Click "Add Deliverable" to get started.
                    </p>
                    <button
                      onClick={handleAddDeliverable}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                    >
                      <Plus className="h-4 w-4" />
                      Add Your First Deliverable
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* Save Button */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 rounded-2xl shadow-lg">
              <div className="flex items-center justify-end gap-4">
                <button
                  onClick={() => router.push(`/proposals/${proposalId}`)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Skip for Now
                </button>
                <button
                  onClick={handleSaveDeliverables}
                  disabled={saving || deliverables.length === 0}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Deliverables'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: Create proposal
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Start Blank Proposal"
          subtitle="Create a proposal from scratch"
          backTo="/client-operations/proposals/create"
          backLabel="Back to Create Proposal"
        />

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-6">
          {/* Contact Selection */}
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Select Contact</h2>
            <div className="max-w-md">
              <ContactSelector
                contactId={contactId}
                onContactChange={(contact) => {
                  setSelectedContact(contact);
                  setContactId(contact.id);
                  // Get companyId from contact's company
                  if (contact.contactCompanyId) {
                    setCompanyId(contact.contactCompanyId);
                  } else if (contact.contactCompany?.id) {
                    setCompanyId(contact.contactCompany.id);
                  }
                }}
              />
            </div>
            {selectedContact && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="text-sm text-green-800">
                  <strong>Selected:</strong> {selectedContact.firstName} {selectedContact.lastName}
                  {selectedContact.contactCompany?.companyName && (
                    <span> • {selectedContact.contactCompany.companyName}</span>
                  )}
                </p>
              </div>
            )}
          </section>

          {/* Proposal Details */}
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Proposal Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Proposal Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Growth Services Proposal for ABC Corp"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Describe the purpose and goals of this proposal..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>
            </div>
          </section>

          {/* Create Button */}
          <div className="flex items-center justify-end">
            <button
              onClick={handleCreateProposal}
              disabled={saving || !title.trim() || !contactId || !companyId}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Creating...' : 'Create Proposal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BlankProposalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <BlankProposalContent />
    </Suspense>
  );
}
