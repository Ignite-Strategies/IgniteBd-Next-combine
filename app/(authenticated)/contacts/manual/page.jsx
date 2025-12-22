'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Building2,
  Mail,
  Phone,
  Briefcase,
  FileText,
  Filter,
  CheckCircle,
  Upload,
  Users,
  X,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
} from 'lucide-react';
import api from '@/lib/api';

const STEPS = {
  CONTACT: 1,
  COMPANY: 2,
  PIPELINE: 3,
};

export default function ContactManualPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(STEPS.CONTACT);
  const [companyHQId, setCompanyHQId] = useState('');
  const [contactId, setContactId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdContact, setCreatedContact] = useState(null);

  // Step 1: Contact Info
  const [contactData, setContactData] = useState({
    firstName: '',
    lastName: '',
    goesBy: '',
    email: '',
    phone: '',
    title: '',
    notes: '',
    howMet: '',
  });

  // Step 2: Company
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [companySearchResults, setCompanySearchResults] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');

  // Step 3: Pipeline
  const [pipelineConfig, setPipelineConfig] = useState(null);
  const [pipelineStages, setPipelineStages] = useState([]);
  const [pipelineData, setPipelineData] = useState({
    pipeline: '',
    stage: '',
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedCompanyHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedCompanyHQId);
  }, []);

  useEffect(() => {
    const fetchPipelineConfig = async () => {
      try {
        const response = await api.get('/api/pipelines/config');
        if (response.data?.success) {
          setPipelineConfig(response.data.pipelines ?? null);
        }
      } catch (error) {
        console.warn('Failed to load pipeline config, using defaults.', error);
        setPipelineConfig({
          prospect: ['interest', 'meeting', 'proposal', 'contract', 'contract-signed'],
          client: ['kickoff', 'work-started', 'work-delivered', 'sustainment', 'renewal', 'terminated-contract'],
          collaborator: ['interest', 'meeting', 'moa', 'agreement'],
          institution: ['interest', 'meeting', 'moa', 'agreement'],
        });
      }
    };
    fetchPipelineConfig();
  }, []);

  useEffect(() => {
    if (pipelineData.pipeline && pipelineConfig) {
      const stages = pipelineConfig[pipelineData.pipeline] || [];
      setPipelineStages(stages);
      if (pipelineData.stage && !stages.includes(pipelineData.stage)) {
        setPipelineData((prev) => ({ ...prev, stage: '' }));
      }
    } else {
      setPipelineStages([]);
    }
  }, [pipelineData.pipeline, pipelineConfig]);

  // Step 1: Create Contact
  const handleCreateContact = async () => {
    setErrors([]);

    if (!contactData.firstName || !contactData.lastName) {
      setErrors(['First Name and Last Name are required']);
      return;
    }

    if (!companyHQId) {
      alert('Company not found. Please set up your company first.');
      router.push('/company/create-or-choose');
      return;
    }

    setSaving(true);

    try {
      const response = await api.post('/api/contacts/create', {
        crmId: companyHQId,
        firstName: contactData.firstName,
        lastName: contactData.lastName,
        goesBy: contactData.goesBy || null,
        email: contactData.email || null,
        phone: contactData.phone || null,
        title: contactData.title || null,
        notes: contactData.notes || null,
        howMet: contactData.howMet || null,
      });

      if (response.data?.success && response.data.contact) {
        setContactId(response.data.contact.id);
        setCurrentStep(STEPS.COMPANY);
      } else {
        throw new Error('Failed to create contact');
      }
    } catch (error) {
      const message =
        error.response?.data?.error ||
        error.response?.data?.details ||
        error.message ||
        'Failed to create contact. Please try again.';
      setErrors([message]);
    } finally {
      setSaving(false);
    }
  };

  // Step 2: Search Companies
  const [searchingCompanies, setSearchingCompanies] = useState(false);
  const [showCreatePrompt, setShowCreatePrompt] = useState(false);

  const handleSearchCompanies = async () => {
    if (!companySearchQuery.trim() || !companyHQId) {
      setCompanySearchResults([]);
      setShowCreatePrompt(false);
      return;
    }

    setSearchingCompanies(true);
    try {
      const response = await api.get(
        `/api/companies?companyHQId=${companyHQId}&query=${encodeURIComponent(companySearchQuery)}`
      );
      if (response.data?.success) {
        const results = response.data.companies || [];
        setCompanySearchResults(results);
        // Show create prompt if no results and user has typed something
        setShowCreatePrompt(results.length === 0 && companySearchQuery.trim().length > 0);
      }
    } catch (error) {
      console.error('Failed to search companies:', error);
      setCompanySearchResults([]);
      setShowCreatePrompt(false);
    } finally {
      setSearchingCompanies(false);
    }
  };

  useEffect(() => {
    if (companySearchQuery.trim()) {
      const timeoutId = setTimeout(() => {
        handleSearchCompanies();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setCompanySearchResults([]);
      setShowCreatePrompt(false);
    }
  }, [companySearchQuery]);

  // Step 2: Create New Company (from search query or manual input)
  const handleCreateCompany = async (companyNameToCreate = null) => {
    const nameToCreate = companyNameToCreate || newCompanyName.trim();
    if (!nameToCreate || !companyHQId) return;

    setCreatingCompany(true);
    try {
      const response = await api.post('/api/companies', {
        companyHQId,
        companyName: nameToCreate,
      });

      if (response.data?.success && response.data.company) {
        setSelectedCompanyId(response.data.company.id);
        setSelectedCompany(response.data.company);
        setNewCompanyName('');
        setCompanySearchQuery('');
        setShowCreatePrompt(false);
        setCompanySearchResults([]);
      }
    } catch (error) {
      console.error('Failed to create company:', error);
      alert('Failed to create company. Please try again.');
    } finally {
      setCreatingCompany(false);
    }
  };

  // Step 2: Select Company and Associate
  const handleSelectCompany = (company) => {
    setSelectedCompanyId(company.id);
    setSelectedCompany(company);
    setCompanySearchQuery('');
    setCompanySearchResults([]);
  };

  const handleAssociateCompany = async () => {
    if (!selectedCompanyId || !contactId) return;

    setSaving(true);
    try {
      await api.put(`/api/contacts/${contactId}`, {
        companyId: selectedCompanyId,
      });
      setCurrentStep(STEPS.PIPELINE);
    } catch (error) {
      console.error('Failed to associate company:', error);
      alert('Failed to associate company. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Step 3: Set Pipeline
  const handleSetPipeline = async () => {
    if (!contactId) return;

    setSaving(true);
    try {
      const response = await api.put(`/api/contacts/${contactId}`, {
        pipeline: pipelineData.pipeline || 'prospect',
        stage: pipelineData.stage || 'interest',
      });

      if (response.data?.success) {
        // Refresh contacts cache
        try {
          const refreshResponse = await api.get(
            `/api/contacts/retrieve?companyHQId=${companyHQId}`
          );
          if (refreshResponse.data?.success && refreshResponse.data.contacts) {
            window.localStorage.setItem(
              'contacts',
              JSON.stringify(refreshResponse.data.contacts)
            );
          }
        } catch (refreshError) {
          console.warn('Unable to refresh contacts cache', refreshError);
        }

        setCreatedContact({
          firstName: contactData.firstName,
          lastName: contactData.lastName,
          email: contactData.email,
          contactId,
        });
        setShowSuccess(true);
      }
    } catch (error) {
      const message =
        error.response?.data?.error ||
        error.response?.data?.details ||
        error.message ||
        'Failed to set pipeline. Please try again.';
      setErrors([message]);
    } finally {
      setSaving(false);
    }
  };

  const formatLabel = (value) =>
    value
      ? value
          .split(/[-_]/)
          .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
          .join(' ')
      : '';

  const handleSkipCompany = () => {
    setCurrentStep(STEPS.PIPELINE);
  };

  const handleSkipPipeline = async () => {
    // Set default pipeline
    if (!contactId) return;

    setSaving(true);
    try {
      await api.put(`/api/contacts/${contactId}`, {
        pipeline: 'prospect',
        stage: 'interest',
      });

      // Refresh contacts cache
      try {
        const refreshResponse = await api.get(
          `/api/contacts/retrieve?companyHQId=${companyHQId}`
        );
        if (refreshResponse.data?.success && refreshResponse.data.contacts) {
          window.localStorage.setItem(
            'contacts',
            JSON.stringify(refreshResponse.data.contacts)
          );
        }
      } catch (refreshError) {
        console.warn('Unable to refresh contacts cache', refreshError);
      }

      setCreatedContact({
        firstName: contactData.firstName,
        lastName: contactData.lastName,
        email: contactData.email,
        contactId,
      });
      setShowSuccess(true);
    } catch (error) {
      console.error('Failed to set default pipeline:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleStartOver = () => {
    setCurrentStep(STEPS.CONTACT);
    setContactId(null);
    setContactData({
      firstName: '',
      lastName: '',
      goesBy: '',
      email: '',
      phone: '',
      title: '',
      notes: '',
      howMet: '',
    });
    setSelectedCompanyId(null);
    setSelectedCompany(null);
    setCompanySearchQuery('');
    setPipelineData({ pipeline: '', stage: '' });
    setErrors([]);
    setShowSuccess(false);
    setCreatedContact(null);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/growth-dashboard')}
            className="flex items-center gap-2 text-gray-600 transition hover:text-gray-900"
          >
            <TrendingUp className="h-5 w-5" />
            Growth Dashboard
          </button>
          <span className="text-gray-400">|</span>
          <button
            type="button"
            onClick={() => router.push('/people')}
            className="flex items-center gap-2 text-gray-600 transition hover:text-gray-900"
          >
            <Users className="h-5 w-5" />
            People Hub
          </button>
          <span className="text-gray-400">|</span>
          <button
            type="button"
            onClick={() => router.push('/contacts/upload')}
            className="flex items-center gap-2 text-gray-600 transition hover:text-gray-900"
          >
            <Upload className="h-5 w-5" />
            Upload Options
          </button>
        </div>

        <h1 className="mb-2 text-3xl font-bold text-gray-900">
          ➕ Add Contact
        </h1>
        <p className="text-gray-600">
          Step {currentStep} of 3: {currentStep === STEPS.CONTACT && 'Contact Information'}
          {currentStep === STEPS.COMPANY && 'Company Association'}
          {currentStep === STEPS.PIPELINE && 'Pipeline Setup'}
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex flex-1 items-center">
          <div className={`flex items-center ${currentStep >= STEPS.CONTACT ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${currentStep >= STEPS.CONTACT ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
              {currentStep > STEPS.CONTACT ? <CheckCircle className="h-6 w-6" /> : <span>1</span>}
            </div>
            <span className="ml-2 font-medium">Contact</span>
          </div>
          <ChevronRight className="mx-4 h-5 w-5 text-gray-400" />
          <div className={`flex items-center ${currentStep >= STEPS.COMPANY ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${currentStep >= STEPS.COMPANY ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
              {currentStep > STEPS.COMPANY ? <CheckCircle className="h-6 w-6" /> : <span>2</span>}
            </div>
            <span className="ml-2 font-medium">Company</span>
          </div>
          <ChevronRight className="mx-4 h-5 w-5 text-gray-400" />
          <div className={`flex items-center ${currentStep >= STEPS.PIPELINE ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${currentStep >= STEPS.PIPELINE ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
              <span>3</span>
            </div>
            <span className="ml-2 font-medium">Pipeline</span>
          </div>
        </div>
      </div>

      {showSuccess && createdContact && (
        <div className="mb-6 rounded-xl border-2 border-green-200 bg-green-50 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-green-600/10 text-green-700">
              <CheckCircle className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-900">
                Contact Created Successfully!
              </h3>
              <p className="mt-2 text-sm text-green-800">
                <strong>{createdContact.firstName} {createdContact.lastName}</strong>
                {createdContact.email && ` (${createdContact.email})`}
              </p>
              <div className="mt-4 flex gap-3">
                {createdContact.contactId && (
                  <button
                    type="button"
                    onClick={() => router.push(`/contacts/${createdContact.contactId}`)}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
                  >
                    View Contact
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleStartOver}
                  className="rounded-lg border border-green-200 bg-white px-4 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100"
                >
                  Add Another
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="mb-6 rounded-lg border-2 border-red-200 bg-red-50 p-4">
          <h3 className="mb-2 font-semibold text-red-900">Please fix the following errors:</h3>
          <ul className="list-inside list-disc text-sm text-red-800">
            {errors.map((error, idx) => (
              <li key={idx}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl bg-white p-8 shadow-lg">
        {/* Step 1: Contact Information */}
        {currentStep === STEPS.CONTACT && (
          <div className="space-y-6">
            <h2 className="mb-4 border-b pb-2 text-xl font-semibold text-gray-900">
              Contact Information
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  <User className="mr-1 inline h-4 w-4" />
                  First Name *
                </label>
                <input
                  value={contactData.firstName}
                  onChange={(e) => setContactData({ ...contactData, firstName: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Last Name *
                </label>
                <input
                  value={contactData.lastName}
                  onChange={(e) => setContactData({ ...contactData, lastName: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Goes By / Preferred Name
                </label>
                <input
                  value={contactData.goesBy}
                  onChange={(e) => setContactData({ ...contactData, goesBy: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="Nickname or preferred name"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  <Mail className="mr-1 inline h-4 w-4" />
                  Email
                </label>
                <input
                  type="email"
                  value={contactData.email}
                  onChange={(e) => setContactData({ ...contactData, email: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  <Phone className="mr-1 inline h-4 w-4" />
                  Phone
                </label>
                <input
                  value={contactData.phone}
                  onChange={(e) => setContactData({ ...contactData, phone: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  <Briefcase className="mr-1 inline h-4 w-4" />
                  Job Title
                </label>
                <input
                  value={contactData.title}
                  onChange={(e) => setContactData({ ...contactData, title: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="Job title or role"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                <FileText className="mr-1 inline h-4 w-4" />
                Notes
              </label>
              <textarea
                value={contactData.notes}
                onChange={(e) => setContactData({ ...contactData, notes: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                placeholder="Any additional notes..."
              />
            </div>
            <div className="flex gap-3 border-t pt-6">
              <button
                type="button"
                onClick={() => router.push('/people')}
                className="flex-1 rounded-lg bg-gray-100 px-6 py-3 font-medium text-gray-700 transition hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateContact}
                disabled={saving || !contactData.firstName || !contactData.lastName}
                className="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Contact & Continue'}
                <ArrowRight className="ml-2 inline h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Company Association */}
        {currentStep === STEPS.COMPANY && (
          <div className="space-y-6">
            <h2 className="mb-4 border-b pb-2 text-xl font-semibold text-gray-900">
              Associate Company
            </h2>
            <p className="text-sm text-gray-600">
              Search for an existing company or create a new one to associate with this contact.
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  <Building2 className="mr-1 inline h-4 w-4" />
                  Search Companies
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={companySearchQuery}
                    onChange={(e) => setCompanySearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    placeholder="Type company name to search..."
                  />
                  {searchingCompanies && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                    </div>
                  )}
                </div>
                
                {/* Search Results */}
                {!searchingCompanies && companySearchResults.length > 0 && (
                  <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {companySearchResults.map((company) => (
                      <button
                        key={company.id}
                        type="button"
                        onClick={() => handleSelectCompany(company)}
                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 ${selectedCompanyId === company.id ? 'bg-blue-50' : ''}`}
                      >
                        <div className="font-medium">{company.companyName}</div>
                        {company.industry && (
                          <div className="text-sm text-gray-500">{company.industry}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Create Prompt - Show when no results and user has typed something */}
                {!searchingCompanies && showCreatePrompt && companySearchQuery.trim() && (
                  <div className="mt-2 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-900">
                          No company found matching "{companySearchQuery}"
                        </p>
                        <p className="mt-1 text-xs text-blue-700">
                          Create a new company with this name?
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCreateCompany(companySearchQuery.trim())}
                        disabled={creatingCompany}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {creatingCompany ? 'Creating...' : `Create "${companySearchQuery.trim()}"`}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {selectedCompany && (
                <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-blue-900">{selectedCompany.companyName}</div>
                      {selectedCompany.industry && (
                        <div className="text-sm text-blue-700">{selectedCompany.industry}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCompany(null);
                        setSelectedCompanyId(null);
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}

              {!showCreatePrompt && (
                <div className="border-t pt-4">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Or Create New Company Manually
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter company name..."
                    />
                    <button
                      type="button"
                      onClick={() => handleCreateCompany()}
                      disabled={!newCompanyName.trim() || creatingCompany}
                      className="rounded-lg bg-gray-600 px-4 py-2 font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {creatingCompany ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t pt-6">
              <button
                type="button"
                onClick={() => setCurrentStep(STEPS.CONTACT)}
                className="flex items-center gap-2 rounded-lg bg-gray-100 px-6 py-3 font-medium text-gray-700 transition hover:bg-gray-200"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                onClick={handleSkipCompany}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Skip for Now
              </button>
              <button
                type="button"
                onClick={handleAssociateCompany}
                disabled={!selectedCompanyId || saving}
                className="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Associating...' : 'Continue to Pipeline'}
                <ArrowRight className="ml-2 inline h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Pipeline Setup */}
        {currentStep === STEPS.PIPELINE && (
          <div className="space-y-6">
            <h2 className="mb-4 border-b pb-2 text-xl font-semibold text-gray-900">
              Set Pipeline
            </h2>
            <p className="text-sm text-gray-600">
              Choose the pipeline type and stage for this contact. You can change this later.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  <Filter className="mr-1 inline h-4 w-4" />
                  Pipeline Type
                </label>
                <select
                  value={pipelineData.pipeline}
                  onChange={(e) => setPipelineData({ ...pipelineData, pipeline: e.target.value, stage: '' })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select pipeline...</option>
                  {pipelineConfig && Object.keys(pipelineConfig).map((pipeline) => (
                    <option key={pipeline} value={pipeline}>
                      {formatLabel(pipeline)}
                    </option>
                  ))}
                </select>
              </div>
              {pipelineData.pipeline && pipelineStages.length > 0 && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Pipeline Stage
                  </label>
                  <select
                    value={pipelineData.stage}
                    onChange={(e) => setPipelineData({ ...pipelineData, stage: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select stage...</option>
                    {pipelineStages.map((stage) => (
                      <option key={stage} value={stage}>
                        {formatLabel(stage)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t pt-6">
              <button
                type="button"
                onClick={() => setCurrentStep(STEPS.COMPANY)}
                className="flex items-center gap-2 rounded-lg bg-gray-100 px-6 py-3 font-medium text-gray-700 transition hover:bg-gray-200"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                onClick={handleSkipPipeline}
                disabled={saving}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Skip (Use Defaults)
              </button>
              <button
                type="button"
                onClick={handleSetPipeline}
                disabled={saving}
                className="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Complete'}
                <CheckCircle className="ml-2 inline h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
