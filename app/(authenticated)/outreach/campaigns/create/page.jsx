'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';
import { Users, Mail, FileText, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';

const STEPS = {
  CAMPAIGN_DETAILS: 1,
  CONTACT_LIST: 2,
  EMAIL_CONTENT: 3,
};

export default function CampaignCreatePage() {
  const router = useRouter();
  const { companyHQId } = useCompanyHQ();
  const [step, setStep] = useState(STEPS.CAMPAIGN_DETAILS);
  const [campaignId, setCampaignId] = useState(null);
  
  // Step 1: Campaign Details
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  // Step 2: Contact List
  const [contactLists, setContactLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState(null);
  const [loadingLists, setLoadingLists] = useState(false);
  
  // Step 3: Email Content
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [emailMode, setEmailMode] = useState('manual'); // 'manual' or 'template'
  const [subject, setSubject] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [body, setBody] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load contact lists when on step 2
  useEffect(() => {
    if (step === STEPS.CONTACT_LIST && companyHQId && !loadingLists) {
      loadContactLists();
    }
  }, [step, companyHQId]);

  // Load templates when on step 3
  useEffect(() => {
    if (step === STEPS.EMAIL_CONTENT && companyHQId && !loadingTemplates) {
      loadTemplates();
    }
  }, [step, companyHQId]);

  // Load template content when template is selected
  useEffect(() => {
    if (selectedTemplateId && templates.length > 0) {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template) {
        setSubject(template.template_bases?.title || '');
        setBody(template.content || '');
      }
    }
  }, [selectedTemplateId, templates]);

  const loadContactLists = async () => {
    if (!companyHQId) return;
    setLoadingLists(true);
    try {
      const response = await api.get(`/api/contact-lists?companyHQId=${companyHQId}`);
      if (response.data?.success) {
        setContactLists(response.data.lists || []);
      }
    } catch (error) {
      console.error('Error loading contact lists:', error);
      setError('Failed to load contact lists');
    } finally {
      setLoadingLists(false);
    }
  };

  const loadTemplates = async () => {
    if (!companyHQId) return;
    setLoadingTemplates(true);
    try {
      const response = await api.get(`/api/template/saved?companyHQId=${companyHQId}`);
      if (response.data?.success) {
        setTemplates(response.data.templates || []);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      setError('Failed to load templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Step 1: Create campaign
  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Campaign name is required');
      return;
    }
    if (!companyHQId) {
      setError('Company HQ ID is required');
      return;
    }

    setError('');
    setSaving(true);

    try {
      const response = await api.post('/api/campaigns', {
        name: name.trim(),
        description: description.trim() || null,
        company_hq_id: companyHQId,
        status: 'DRAFT',
      });

      if (response.data?.success) {
        setCampaignId(response.data.campaign.id);
        setStep(STEPS.CONTACT_LIST);
      } else {
        setError(response.data?.error || 'Failed to create campaign');
      }
    } catch (error) {
      console.error('Error creating campaign:', error);
      setError(error.response?.data?.error || 'Failed to create campaign');
    } finally {
      setSaving(false);
    }
  };

  // Step 2: Attach contact list
  const handleAttachContactList = async () => {
    if (!campaignId) {
      setError('Campaign ID is missing');
      return;
    }

    setError('');
    setSaving(true);

    try {
      const response = await api.patch(`/api/campaigns/${campaignId}`, {
        contact_list_id: selectedListId || null,
      });

      if (response.data?.success) {
        setStep(STEPS.EMAIL_CONTENT);
      } else {
        setError(response.data?.error || 'Failed to attach contact list');
      }
    } catch (error) {
      console.error('Error attaching contact list:', error);
      setError(error.response?.data?.error || 'Failed to attach contact list');
    } finally {
      setSaving(false);
    }
  };

  // Step 3: Save email content
  const handleSaveEmailContent = async () => {
    if (!campaignId) {
      setError('Campaign ID is missing');
      return;
    }

    if (!subject.trim() && emailMode === 'manual') {
      setError('Email subject is required');
      return;
    }

    setError('');
    setSaving(true);

    try {
      const updateData = {
        subject: subject.trim() || null,
        preview_text: previewText.trim() || null,
        body: body.trim() || null,
      };

      if (emailMode === 'template' && selectedTemplateId) {
        updateData.template_id = selectedTemplateId;
      }

      const response = await api.patch(`/api/campaigns/${campaignId}`, updateData);

      if (response.data?.success) {
        router.push(`/outreach/campaigns/${campaignId}`);
      } else {
        setError(response.data?.error || 'Failed to save email content');
      }
    } catch (error) {
      console.error('Error saving email content:', error);
      setError(error.response?.data?.error || 'Failed to save email content');
    } finally {
      setSaving(false);
    }
  };

  const selectedList = contactLists.find(l => l.id === selectedListId);
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Campaign Builder"
          subtitle="Build a high-performing email campaign."
          backTo="/outreach/campaigns"
          backLabel="Back to Campaigns"
        />

        {/* Progress Steps */}
        <div className="mb-8 flex items-center justify-center">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center ${step >= STEPS.CAMPAIGN_DETAILS ? 'text-red-600' : 'text-gray-400'}`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                step >= STEPS.CAMPAIGN_DETAILS ? 'border-red-600 bg-red-50' : 'border-gray-300'
              }`}>
                {step > STEPS.CAMPAIGN_DETAILS ? (
                  <CheckCircle className="h-6 w-6" />
                ) : (
                  <span className="text-sm font-semibold">1</span>
                )}
              </div>
              <span className="ml-2 text-sm font-semibold">Campaign</span>
            </div>
            <div className={`h-1 w-16 ${step >= STEPS.CONTACT_LIST ? 'bg-red-600' : 'bg-gray-300'}`} />
            <div className={`flex items-center ${step >= STEPS.CONTACT_LIST ? 'text-red-600' : 'text-gray-400'}`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                step >= STEPS.CONTACT_LIST ? 'border-red-600 bg-red-50' : 'border-gray-300'
              }`}>
                {step > STEPS.CONTACT_LIST ? (
                  <CheckCircle className="h-6 w-6" />
                ) : (
                  <span className="text-sm font-semibold">2</span>
                )}
              </div>
              <span className="ml-2 text-sm font-semibold">Audience</span>
            </div>
            <div className={`h-1 w-16 ${step >= STEPS.EMAIL_CONTENT ? 'bg-red-600' : 'bg-gray-300'}`} />
            <div className={`flex items-center ${step >= STEPS.EMAIL_CONTENT ? 'text-red-600' : 'text-gray-400'}`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                step >= STEPS.EMAIL_CONTENT ? 'border-red-600 bg-red-50' : 'border-gray-300'
              }`}>
                <span className="text-sm font-semibold">3</span>
              </div>
              <span className="ml-2 text-sm font-semibold">Email</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Step 1: Campaign Details */}
          {step === STEPS.CAMPAIGN_DETAILS && (
            <form onSubmit={handleCreateCampaign} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Q1 Customer Reactivation"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  disabled={saving}
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Describe the purpose and goals of this campaign..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  disabled={saving}
                />
              </div>
              <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">
                <button
                  type="button"
                  onClick={() => router.push('/outreach/campaigns')}
                  className="rounded-lg bg-gray-100 px-5 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-200 disabled:opacity-60"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                  disabled={saving}
                >
                  {saving ? 'Creating...' : 'Create Campaign'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}

          {/* Step 2: Contact List */}
          {step === STEPS.CONTACT_LIST && (
            <div className="space-y-5">
              <div>
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <Users className="h-5 w-5 text-gray-500" />
                  Select Contact List
                </h3>
                <p className="mb-4 text-sm text-gray-600">
                  Choose an existing contact list or create a new one to target your campaign.
                </p>
              </div>

              {loadingLists ? (
                <div className="py-8 text-center text-gray-500">Loading contact lists...</div>
              ) : contactLists.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
                  <Users className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-4 text-sm text-gray-600">No contact lists found.</p>
                  <button
                    type="button"
                    onClick={() => router.push('/contacts/lists')}
                    className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                  >
                    Create Contact List
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {contactLists.map((list) => (
                    <button
                      key={list.id}
                      type="button"
                      onClick={() => setSelectedListId(list.id === selectedListId ? null : list.id)}
                      className={`rounded-lg border-2 p-4 text-left transition ${
                        selectedListId === list.id
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{list.name}</h4>
                          {list.description && (
                            <p className="mt-1 text-sm text-gray-600">{list.description}</p>
                          )}
                          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                            <span>{list.totalContacts || 0} contacts</span>
                            <span>{list.type || 'Custom'}</span>
                          </div>
                        </div>
                        {selectedListId === list.id && (
                          <CheckCircle className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex justify-between border-t border-gray-100 pt-5">
                <button
                  type="button"
                  onClick={() => setStep(STEPS.CAMPAIGN_DETAILS)}
                  className="flex items-center gap-2 rounded-lg bg-gray-100 px-5 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-200 disabled:opacity-60"
                  disabled={saving}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => router.push('/contacts/lists')}
                    className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                    disabled={saving}
                  >
                    Create New List
                  </button>
                  <button
                    type="button"
                    onClick={handleAttachContactList}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Continue'}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Email Content */}
          {step === STEPS.EMAIL_CONTENT && (
            <div className="space-y-5">
              <div>
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <Mail className="h-5 w-5 text-gray-500" />
                  Build Your Email
                </h3>
                <p className="mb-4 text-sm text-gray-600">
                  Create your email content manually or choose from a saved template.
                </p>
              </div>

              {/* Mode Toggle */}
              <div className="flex gap-4 border-b border-gray-200 pb-4">
                <button
                  type="button"
                  onClick={() => {
                    setEmailMode('manual');
                    setSelectedTemplateId(null);
                    setSubject('');
                    setBody('');
                  }}
                  className={`px-4 py-2 text-sm font-semibold transition ${
                    emailMode === 'manual'
                      ? 'border-b-2 border-red-600 text-red-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Manual
                </button>
                <button
                  type="button"
                  onClick={() => setEmailMode('template')}
                  className={`px-4 py-2 text-sm font-semibold transition ${
                    emailMode === 'template'
                      ? 'border-b-2 border-red-600 text-red-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Choose Template
                </button>
              </div>

              {/* Template Selection */}
              {emailMode === 'template' && (
                <div className="space-y-4">
                  {loadingTemplates ? (
                    <div className="py-8 text-center text-gray-500">Loading templates...</div>
                  ) : templates.length === 0 ? (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
                      <FileText className="mx-auto h-12 w-12 text-gray-400" />
                      <p className="mt-4 text-sm text-gray-600">No templates found.</p>
                      <button
                        type="button"
                        onClick={() => router.push('/template/create')}
                        className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                      >
                        Create Template
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {templates.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => setSelectedTemplateId(template.id === selectedTemplateId ? null : template.id)}
                          className={`rounded-lg border-2 p-4 text-left transition ${
                            selectedTemplateId === template.id
                              ? 'border-red-500 bg-red-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900">
                                {template.template_bases?.title || 'Untitled Template'}
                              </h4>
                              {template.template_bases?.whyReachingOut && (
                                <p className="mt-1 text-sm text-gray-600">
                                  {template.template_bases.whyReachingOut}
                                </p>
                              )}
                              <div className="mt-2 text-xs text-gray-500">
                                {template.template_bases?.relationship} • {template.template_bases?.typeOfPerson}
                              </div>
                            </div>
                            {selectedTemplateId === template.id && (
                              <CheckCircle className="h-5 w-5 text-red-600" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Email Fields */}
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Email Subject *
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Ready to accelerate your 2025 pipeline?"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    disabled={saving || (emailMode === 'template' && selectedTemplateId)}
                    required={emailMode === 'manual'}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Preview Text
                  </label>
                  <textarea
                    value={previewText}
                    onChange={(e) => setPreviewText(e.target.value)}
                    rows={2}
                    placeholder="Short snippet that shows in inbox previews."
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Email Body {emailMode === 'manual' && '*'}
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={10}
                    placeholder="Write your email content here..."
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    disabled={saving || (emailMode === 'template' && selectedTemplateId)}
                    required={emailMode === 'manual'}
                  />
                </div>
              </div>

              <div className="flex justify-between border-t border-gray-100 pt-5">
                <button
                  type="button"
                  onClick={() => setStep(STEPS.CONTACT_LIST)}
                  className="flex items-center gap-2 rounded-lg bg-gray-100 px-5 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-200 disabled:opacity-60"
                  disabled={saving}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSaveEmailContent}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Campaign'}
                  <CheckCircle className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
