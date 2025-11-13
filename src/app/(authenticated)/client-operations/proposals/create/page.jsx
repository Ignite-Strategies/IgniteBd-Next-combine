'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { useProposals } from '../layout';
import { Plus, X, Package, Calendar, RefreshCw, Search, Mail, User, Save, DollarSign } from 'lucide-react';
import api from '@/lib/api';
import { getContactsRegistry } from '@/lib/services/contactsRegistry';

export default function CreateProposalPage() {
  const router = useRouter();
  const { addProposal, companyHQId } = useProposals();
  const [registry] = useState(() => getContactsRegistry());

  // Contact selection
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companyNameInput, setCompanyNameInput] = useState('');
  const [companyConfirmed, setCompanyConfirmed] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingCompany, setLoadingCompany] = useState(false);
  
  // Proposal fields
  const [proposalName, setProposalName] = useState('');
  const [proposalDescription, setProposalDescription] = useState('');
  
  // Services
  const [savedServices, setSavedServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  
  // Phases
  const [phases, setPhases] = useState([]);
  
  // Compensation
  const [manualTotalPrice, setManualTotalPrice] = useState(null);
  const [paymentStructure, setPaymentStructure] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Load contacts from registry on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!registry.hydrated) {
      registry.loadFromCache();
    }
    if (companyHQId) {
      loadSavedServices();
    }
  }, [companyHQId, registry]);

  // Fetch contacts from API
  const fetchContactsFromAPI = useCallback(async () => {
    if (!companyHQId) return;
    setLoadingContacts(true);
    setError('');
    try {
      const response = await api.get(`/api/contacts?companyHQId=${companyHQId}`);
      if (response.data?.success && response.data.contacts) {
        registry.hydrate(response.data.contacts);
        registry.saveToCache();
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
      setError('Failed to load contacts. Please try again.');
    } finally {
      setLoadingContacts(false);
    }
  }, [companyHQId, registry]);

  const refreshContacts = useCallback(() => {
    registry.loadFromCache();
  }, [registry]);

  const availableContacts = useMemo(() => {
    if (typeof window === 'undefined') return [];
    if (!contactSearch || !contactSearch.trim()) {
      return registry.getAll().slice(0, 20);
    }
    return registry.search(contactSearch).slice(0, 20);
  }, [contactSearch, registry]);

  // Auto-generate proposal name
  useEffect(() => {
    if (selectedContact && selectedCompany) {
      const contactName = `${selectedContact.firstName || ''} ${selectedContact.lastName || ''}`.trim() || selectedContact.email;
      setProposalName(`Proposal for ${selectedCompany.companyName}`);
    }
  }, [selectedContact, selectedCompany]);

  const loadSavedServices = async () => {
    if (!companyHQId) return;
    setLoadingServices(true);
    try {
      const response = await api.get(`/api/products?companyHQId=${companyHQId}`);
      setSavedServices(response.data || []);
    } catch (err) {
      console.error('Error loading products:', err);
      setSavedServices([]);
    } finally {
      setLoadingServices(false);
    }
  };

  const handleContactSelect = async (contact) => {
    setSelectedContact(contact);
    setError('');
    if (contact.contactCompany) {
      setCompanyNameInput(contact.contactCompany.companyName);
    } else {
      setCompanyNameInput('');
    }
    setCompanyConfirmed(false);
    setSelectedCompany(null);
  };

  const handleCompanyConfirm = async () => {
    if (!companyNameInput.trim() || !selectedContact) return;
    setLoadingCompany(true);
    setError('');
    try {
      const upsertResponse = await api.post('/api/companies', {
        companyName: companyNameInput.trim(),
        companyHQId,
      });
      const company = upsertResponse.data?.company;
      if (!company) throw new Error('Failed to create or find company');

      await api.put(`/api/contacts/${selectedContact.id}`, {
        contactCompanyId: company.id,
      });

      await fetchContactsFromAPI();
      const updatedContact = registry.getById(selectedContact.id);
      if (updatedContact?.contactCompany) {
        setSelectedCompany(updatedContact.contactCompany);
        setSelectedContact(updatedContact);
        setCompanyNameInput(updatedContact.contactCompany.companyName);
      } else {
        setSelectedCompany(company);
        setCompanyNameInput(company.companyName);
        registry.updateContact(selectedContact.id, { contactCompany: company });
      }
      setCompanyConfirmed(true);
    } catch (err) {
      console.error('Error confirming company:', err);
      setError('Failed to confirm company. Please try again.');
    } finally {
      setLoadingCompany(false);
    }
  };

  const handleSelectService = (service) => {
    const existing = selectedServices.find(s => s.serviceId === service.id);
    if (existing) {
      setSelectedServices(selectedServices.map(s => 
        s.serviceId === service.id 
          ? { ...s, quantity: s.quantity + 1, price: s.unitPrice * (s.quantity + 1) }
          : s
      ));
    } else {
      const unitPrice = service.price || 0;
      setSelectedServices([
        ...selectedServices,
        {
          serviceId: service.id,
          name: service.name,
          description: service.description || service.valueProp || '',
          type: service.category || 'general',
          unitPrice: unitPrice,
          quantity: 1,
          price: unitPrice,
        }
      ]);
    }
  };

  const handleUpdateServiceQuantity = (serviceId, quantity) => {
    setSelectedServices(selectedServices.map(s => {
      if (s.serviceId === serviceId) {
        const newQuantity = Math.max(1, quantity);
        return {
          ...s,
          quantity: newQuantity,
          price: s.unitPrice * newQuantity,
        };
      }
      return s;
    }));
  };

  const handleRemoveService = (serviceId) => {
    setSelectedServices(selectedServices.filter(s => s.serviceId !== serviceId));
  };

  const totalPrice = useMemo(() => {
    if (manualTotalPrice !== null) return manualTotalPrice;
    return selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);
  }, [selectedServices, manualTotalPrice]);

  const handleAddPhase = () => {
    setPhases([
      ...phases,
      {
        id: `phase-${Date.now()}`,
        name: '',
        weeks: '',
        color: phases.length === 0 ? 'red' : phases.length === 1 ? 'yellow' : 'purple',
        goal: '',
        deliverables: [],
        coreWork: [],
        outcome: '',
      }
    ]);
  };

  const handleUpdatePhase = (phaseId, updates) => {
    setPhases(phases.map(p => p.id === phaseId ? { ...p, ...updates } : p));
  };

  const handleAddDeliverableToPhase = (phaseId) => {
    setPhases(phases.map(p => {
      if (p.id === phaseId) {
        return {
          ...p,
          deliverables: [...(p.deliverables || []), ''],
        };
      }
      return p;
    }));
  };

  const handleUpdateDeliverableInPhase = (phaseId, index, value) => {
    setPhases(phases.map(p => {
      if (p.id === phaseId) {
        const deliverables = [...(p.deliverables || [])];
        deliverables[index] = value;
        return { ...p, deliverables };
      }
      return p;
    }));
  };

  const handleAddCoreWorkToPhase = (phaseId) => {
    setPhases(phases.map(p => {
      if (p.id === phaseId) {
        return {
          ...p,
          coreWork: [...(p.coreWork || []), ''],
        };
      }
      return p;
    }));
  };

  const handleUpdateCoreWorkInPhase = (phaseId, index, value) => {
    setPhases(phases.map(p => {
      if (p.id === phaseId) {
        const coreWork = [...(p.coreWork || [])];
        coreWork[index] = value;
        return { ...p, coreWork };
      }
      return p;
    }));
  };

  const handleSubmit = async () => {
    if (!proposalName.trim()) {
      setError('Proposal title is required');
      return;
    }
    if (!selectedContact || !selectedCompany) {
      setError('Please select a contact and confirm company');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const serviceInstances = selectedServices.map(s => ({
        name: s.name,
        description: s.description,
        type: s.type,
        quantity: s.quantity,
        unitPrice: s.unitPrice,
        price: s.price,
      }));

      const compensation = {
        total: totalPrice,
        currency: 'USD',
        paymentStructure: paymentStructure || (phases.length > 0 
          ? `${phases.length} payments of $${Math.round(totalPrice / phases.length)}`
          : `$${totalPrice.toLocaleString()}`),
      };

      const payload = {
        companyHQId,
        clientName: `${selectedContact.firstName || ''} ${selectedContact.lastName || ''}`.trim() || selectedContact.email,
        clientCompany: selectedCompany.companyName,
        companyId: selectedCompany.id,
        purpose: proposalDescription || proposalName,
        status: 'draft',
        serviceInstances,
        phases: phases.length > 0 ? phases : null,
        milestones: [],
        compensation,
        totalPrice,
        preparedBy: null,
      };

      const response = await api.post('/api/proposals', payload);
      const proposal = response.data?.proposal;

      if (!proposal) {
        throw new Error('Proposal response missing payload');
      }

      addProposal(proposal);
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
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Create Proposal"
          subtitle="Single-page proposal creation"
          backTo="/client-operations/proposals"
          backLabel="Back to Proposals"
        />

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Single Page Vertical Scroll Form */}
        <div className="mt-8 space-y-8">
          {/* Contact Selection */}
          <section className="rounded-2xl bg-white p-8 shadow">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <User className="h-6 w-6 text-red-600" />
              Contact & Company
            </h2>
            
            {selectedContact && selectedCompany ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                      <User className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {selectedContact.firstName} {selectedContact.lastName}
                      </p>
                      {selectedContact.email && (
                        <div className="flex items-center gap-2 mt-1">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <p className="text-sm text-gray-600">{selectedContact.email}</p>
                        </div>
                      )}
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {selectedCompany.companyName}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedContact(null);
                      setSelectedCompany(null);
                      setCompanyConfirmed(false);
                    }}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Change
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search contacts by name, email, or company..."
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                  <button
                    onClick={refreshContacts}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  {companyHQId && (
                    <button
                      onClick={fetchContactsFromAPI}
                      disabled={loadingContacts}
                      className="px-4 py-2 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:opacity-50 flex items-center gap-2 text-blue-600"
                    >
                      <RefreshCw className={`h-4 w-4 ${loadingContacts ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                </div>

                {availableContacts.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {availableContacts.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => handleContactSelect(contact)}
                        className="w-full text-left p-4 rounded-lg border-2 border-gray-200 hover:border-red-300 hover:bg-red-50 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                            <User className="h-5 w-5 text-red-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {contact.firstName} {contact.lastName}
                            </p>
                            {contact.email && (
                              <p className="text-sm text-gray-600">{contact.email}</p>
                            )}
                            {contact.contactCompany?.companyName && (
                              <p className="text-xs text-gray-500">{contact.contactCompany.companyName}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedContact && !companyConfirmed && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="mb-2 text-sm text-gray-600">Confirm company name:</p>
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
                        className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                      >
                        {loadingCompany ? 'Confirming...' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Proposal Details */}
          <section className="rounded-2xl bg-white p-8 shadow">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Package className="h-6 w-6 text-red-600" />
                  Proposal Details
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      Proposal Title *
                    </label>
                    <input
                      type="text"
                      value={proposalName}
                      onChange={(e) => setProposalName(e.target.value)}
                      placeholder="Proposal for Company Name"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      Description <span className="text-gray-500 font-normal">(Internal Use Only)</span>
                    </label>
                    <textarea
                      value={proposalDescription}
                      onChange={(e) => setProposalDescription(e.target.value)}
                      rows={4}
                      placeholder="Internal notes about what this proposal covers..."
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    />
                  </div>
                </div>
          </section>

          {/* Services */}
          <section className="rounded-2xl bg-white p-8 shadow">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Package className="h-6 w-6 text-red-600" />
                    Services
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push('/products/builder')}
                      className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
                    >
                      <Plus className="h-4 w-4" />
                      Create Product
                    </button>
                    <button
                      onClick={loadSavedServices}
                      disabled={loadingServices}
                      className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-4 w-4 ${loadingServices ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>
                </div>

                {savedServices.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm text-gray-600 mb-4">No saved services yet.</p>
                    <button
                      onClick={() => router.push('/products/builder')}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                    >
                      Create Your First Product
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {savedServices.map((service) => {
                      const selected = selectedServices.find(s => s.serviceId === service.id);
                      return (
                        <div
                          key={service.id}
                          className={`rounded-lg border p-4 ${
                            selected
                              ? 'border-red-500 bg-red-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-gray-900">{service.name}</h3>
                                {service.type && (
                                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                                    {service.type}
                                  </span>
                                )}
                              </div>
                              {service.description && (
                                <p className="text-sm text-gray-600 mb-2">{service.description}</p>
                              )}
                              <p className="text-sm font-semibold text-gray-900">
                                ${(service.price || 0).toLocaleString()} per unit
                              </p>
                            </div>
                            {selected ? (
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleUpdateServiceQuantity(service.id, selected.quantity - 1)}
                                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    value={selected.quantity}
                                    onChange={(e) => handleUpdateServiceQuantity(service.id, parseInt(e.target.value) || 1)}
                                    className="w-16 rounded border border-gray-300 px-2 py-1 text-center text-sm"
                                    min="1"
                                  />
                                  <button
                                    onClick={() => handleUpdateServiceQuantity(service.id, selected.quantity + 1)}
                                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                                  >
                                    +
                                  </button>
                                </div>
                                <p className="text-sm font-semibold text-gray-900">
                                  ${selected.price.toLocaleString()}
                                </p>
                                <button
                                  onClick={() => handleRemoveService(service.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleSelectService(service)}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                              >
                                Add
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {selectedServices.length > 0 && (
                  <div className="mt-6 rounded-lg border-2 border-red-200 bg-red-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900">Total Price:</span>
                      <span className="text-2xl font-bold text-red-600">
                        ${totalPrice.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
          </section>

          {/* Phases */}
          <section className="rounded-2xl bg-white p-8 shadow">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Calendar className="h-6 w-6 text-red-600" />
                    Phases
                  </h2>
                  <button
                    onClick={handleAddPhase}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700"
                  >
                    <Plus className="h-4 w-4" />
                    Add Phase
                  </button>
                </div>

                <div className="space-y-6">
                  {phases.map((phase, index) => {
                    const colorClasses = {
                      red: 'border-red-200 bg-red-50',
                      yellow: 'border-yellow-200 bg-yellow-50',
                      purple: 'border-purple-200 bg-purple-50',
                    };
                    return (
                      <div
                        key={phase.id}
                        className={`rounded-lg border p-6 ${colorClasses[phase.color] || colorClasses.red}`}
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-gray-900">Phase {index + 1}</h3>
                          <button
                            onClick={() => setPhases(phases.filter(p => p.id !== phase.id))}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>

                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-gray-700">Phase Name</label>
                              <input
                                type="text"
                                value={phase.name}
                                onChange={(e) => handleUpdatePhase(phase.id, { name: e.target.value })}
                                placeholder="e.g., Foundation"
                                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-gray-700">Weeks</label>
                              <input
                                type="text"
                                value={phase.weeks}
                                onChange={(e) => handleUpdatePhase(phase.id, { weeks: e.target.value })}
                                placeholder="e.g., 1-3"
                                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-semibold text-gray-700">Goal</label>
                            <textarea
                              value={phase.goal}
                              onChange={(e) => handleUpdatePhase(phase.id, { goal: e.target.value })}
                              placeholder="Phase goal..."
                              rows={2}
                              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                            />
                          </div>

                          <div>
                            <div className="mb-2 flex items-center justify-between">
                              <label className="block text-xs font-semibold text-gray-700">Deliverables</label>
                              <button
                                onClick={() => handleAddDeliverableToPhase(phase.id)}
                                className="text-xs text-red-600 hover:text-red-700"
                              >
                                + Add
                              </button>
                            </div>
                            <div className="space-y-2">
                              {(phase.deliverables || []).map((deliverable, delIndex) => (
                                <input
                                  key={delIndex}
                                  type="text"
                                  value={deliverable}
                                  onChange={(e) => handleUpdateDeliverableInPhase(phase.id, delIndex, e.target.value)}
                                  placeholder="e.g., 3 Target Personas"
                                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                                />
                              ))}
                            </div>
                          </div>

                          <div>
                            <div className="mb-2 flex items-center justify-between">
                              <label className="block text-xs font-semibold text-gray-700">Core Work</label>
                              <button
                                onClick={() => handleAddCoreWorkToPhase(phase.id)}
                                className="text-xs text-red-600 hover:text-red-700"
                              >
                                + Add
                              </button>
                            </div>
                            <div className="space-y-2">
                              {(phase.coreWork || []).map((work, workIndex) => (
                                <input
                                  key={workIndex}
                                  type="text"
                                  value={work}
                                  onChange={(e) => handleUpdateCoreWorkInPhase(phase.id, workIndex, e.target.value)}
                                  placeholder="e.g., Configure IgniteBD CRM + domain layer"
                                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                                />
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-semibold text-gray-700">Outcome</label>
                            <textarea
                              value={phase.outcome}
                              onChange={(e) => handleUpdatePhase(phase.id, { outcome: e.target.value })}
                              placeholder="Expected outcome..."
                              rows={2}
                              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
          </section>

          {/* Compensation Section */}
          <section className="rounded-2xl bg-white p-8 shadow">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-red-600" />
              Compensation & Payment Schedule
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Total Price *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                  <input
                    type="number"
                    value={manualTotalPrice !== null ? manualTotalPrice : totalPrice || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        setManualTotalPrice(null);
                      } else {
                        setManualTotalPrice(parseFloat(value) || 0);
                      }
                    }}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2 rounded-lg border border-gray-300 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    step="0.01"
                    min="0"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Auto-calculated from services: ${totalPrice.toLocaleString()}
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Payment Structure
                </label>
                <input
                  type="text"
                  value={paymentStructure}
                  onChange={(e) => setPaymentStructure(e.target.value)}
                  placeholder="e.g., 3 payments of $500 at beginning, middle, and on delivery"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Describe how payments will be structured
                </p>
              </div>
            </div>
          </section>

          {/* Submit Button */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Proposal Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${totalPrice.toLocaleString()}
                </p>
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting || !proposalName.trim() || !selectedContact || !selectedCompany}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {submitting ? 'Creating...' : 'Create Proposal'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

