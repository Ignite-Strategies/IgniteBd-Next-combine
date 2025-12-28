'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';
import { Users, Mail, FileText, CheckCircle, Save, Plus } from 'lucide-react';
import api from '@/lib/api';

function CampaignEditContent({ params }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { companyHQId } = useCompanyHQ();
  const campaignId = params.campaignId;

  // Campaign Details
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  // Contact List
  const [contactLists, setContactLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState(null);
  const [loadingLists, setLoadingLists] = useState(false);
  
  // Email Content
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [emailMode, setEmailMode] = useState('manual'); // 'manual' or 'template'
  const [subject, setSubject] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [body, setBody] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Check if returning from contact list creation
  useEffect(() => {
    const returnTo = searchParams.get('returnTo');
    if (returnTo && returnTo.includes('listCreated')) {
      // Reload contact lists after returning
      if (companyHQId) {
        loadContactLists();
      }
    }
  }, [searchParams, companyHQId]);

  // Load campaign data on mount
  useEffect(() => {
    if (campaignId && companyHQId) {
      loadCampaign();
      loadContactLists();
      loadTemplates();
    }
  }, [campaignId, companyHQId]);

  // Load template content when template is selected (template is source of truth)
  useEffect(() => {
    if (selectedTemplateId && templates.length > 0 && emailMode === 'template') {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template) {
        // Template is the source of truth - populate for preview but don't allow editing
        setSubject(template.subject || template.template_bases?.title || '');
        setBody(template.body || template.content || '');
      }
    }
  }, [selectedTemplateId, templates, emailMode]);

  const loadCampaign = async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const response = await api.get(`/api/campaigns/${campaignId}`);
      if (response.data?.success && response.data.campaign) {
        const campaign = response.data.campaign;
        setName(campaign.name || '');
        setDescription(campaign.description || '');
        setSelectedListId(campaign.contact_list_id || null);
        setSelectedTemplateId(campaign.template_id || null);
        
        // Smart routing: If template_id exists, use template mode (template is source of truth)
        if (campaign.template_id) {
          setEmailMode('template');
          // Use effective content (template takes precedence)
          const effectiveContent = campaign.effectiveContent || {
            subject: campaign.subject || '',
            body: campaign.body || '',
            preview_text: campaign.preview_text || '',
          };
          setSubject(effectiveContent.subject || '');
          setBody(effectiveContent.body || '');
          setPreviewText(effectiveContent.preview_text || '');
        } else {
          // Manual mode - use direct fields
          setEmailMode('manual');
          setSubject(campaign.subject || '');
          setPreviewText(campaign.preview_text || '');
          setBody(campaign.body || '');
        }
      } else {
        setError('Campaign not found');
      }
    } catch (error) {
      console.error('Error loading campaign:', error);
      setError(error.response?.data?.error || 'Failed to load campaign');
    } finally {
      setLoading(false);
    }
  };

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
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Campaign name is required');
      return;
    }

    setError('');
    setSaving(true);

    try {
      const updateData = {
        name: name.trim(),
        description: description.trim() || null,
        contact_list_id: selectedListId || null,
        preview_text: previewText.trim() || null, // Always allow preview text
      };

      // Smart routing: template_id is the bolt-on that does the work
      if (emailMode === 'template' && selectedTemplateId) {
        // Template mode: template_id is source of truth, clear manual content
        updateData.template_id = selectedTemplateId;
        // Don't send subject/body - template provides them
        // But keep preview_text (not in template)
      } else {
        // Manual mode: clear template_id, use manual content
        updateData.template_id = null;
        updateData.subject = subject.trim() || null;
        updateData.body = body.trim() || null;
      }

      const response = await api.patch(`/api/campaigns/${campaignId}`, updateData);

      if (response.data?.success) {
        // Show success message or redirect
        router.push(`/outreach/campaigns/${campaignId}`);
      } else {
        setError(response.data?.error || 'Failed to save campaign');
      }
    } catch (error) {
      console.error('Error saving campaign:', error);
      setError(error.response?.data?.error || 'Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateList = () => {
    // Navigate to list builder with returnTo param
    const returnUrl = `/outreach/campaigns/${campaignId}/edit?returnTo=listCreated`;
    router.push(`/contacts/list-builder?returnTo=${encodeURIComponent(returnUrl)}`);
  };

  const selectedList = contactLists.find(l => l.id === selectedListId);
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <PageHeader
            title="Edit Campaign"
            subtitle="Loading campaign..."
            backTo="/outreach/campaigns"
            backLabel="Back to Campaigns"
          />
          <div className="rounded-2xl bg-white p-6 shadow">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-4 border-red-600" />
                <p className="text-gray-600">Loading campaign...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Edit Campaign"
          subtitle="Build your email campaign"
          backTo="/outreach/campaigns"
          backLabel="Back to Campaigns"
          actions={
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Campaign'}
            </button>
          }
        />

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Campaign Details Section */}
          <section className="rounded-2xl bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Campaign Details</h3>
            <div className="space-y-4">
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
                  rows={3}
                  placeholder="Describe the purpose and goals of this campaign..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>
            </div>
          </section>

          {/* Contact List Section */}
          <section className="rounded-2xl bg-white p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Users className="h-5 w-5 text-gray-500" />
                Contact List
              </h3>
              <button
                type="button"
                onClick={handleCreateList}
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" />
                Create New List
              </button>
            </div>

            {loadingLists ? (
              <div className="py-4 text-center text-sm text-gray-500">Loading contact lists...</div>
            ) : contactLists.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
                <Users className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-4 text-sm text-gray-600">No contact lists found.</p>
                <button
                  type="button"
                  onClick={handleCreateList}
                  className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Create Contact List
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {contactLists.map((list) => (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => setSelectedListId(list.id === selectedListId ? null : list.id)}
                    className={`w-full rounded-lg border-2 p-4 text-left transition ${
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
          </section>

          {/* Email Content Section */}
          <section className="rounded-2xl bg-white p-6 shadow">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Mail className="h-5 w-5 text-gray-500" />
              Email Content
            </h3>

            {/* Mode Toggle */}
            <div className="mb-4 flex gap-4 border-b border-gray-200 pb-4">
              <button
                type="button"
                onClick={() => {
                  setEmailMode('manual');
                  setSelectedTemplateId(null);
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
              <div className="mb-4 space-y-2">
                {loadingTemplates ? (
                  <div className="py-4 text-center text-sm text-gray-500">Loading templates...</div>
                ) : templates.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
                    <FileText className="mx-auto h-10 w-10 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-600">No templates found.</p>
                    <button
                      type="button"
                      onClick={() => router.push('/template/create')}
                      className="mt-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                    >
                      Create Template
                    </button>
                  </div>
                ) : (
                  <div className="max-h-60 space-y-2 overflow-y-auto">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(template.id === selectedTemplateId ? null : template.id)}
                        className={`w-full rounded-lg border-2 p-3 text-left transition ${
                          selectedTemplateId === template.id
                            ? 'border-red-500 bg-red-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-gray-900">
                              {template.template_bases?.title || 'Untitled Template'}
                            </h4>
                            {template.template_bases?.whyReachingOut && (
                              <p className="mt-1 text-xs text-gray-600">
                                {template.template_bases.whyReachingOut}
                              </p>
                            )}
                          </div>
                          {selectedTemplateId === template.id && (
                            <CheckCircle className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Email Fields - Smart routing based on template_id */}
            <div className="space-y-4">
              {emailMode === 'template' && selectedTemplateId ? (
                // Template mode: Show template content (read-only, template is source of truth)
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p className="mb-2 text-xs font-semibold text-blue-800">
                    Using Template Content (Template is source of truth)
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-700">
                        Subject (from template)
                      </label>
                      <div className="rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                        {subject || 'No subject in template'}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-700">
                        Body (from template)
                      </label>
                      <div className="max-h-40 overflow-y-auto rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">
                        {body || 'No body in template'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // Manual mode: Allow editing
                <>
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
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      Email Body *
                    </label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={10}
                      placeholder="Write your email content here..."
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                      required
                    />
                  </div>
                </>
              )}
              {/* Preview text is always editable (not in template) */}
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
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function CampaignEditPage({ params }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <PageHeader
            title="Edit Campaign"
            subtitle="Loading..."
            backTo="/outreach/campaigns"
            backLabel="Back to Campaigns"
          />
          <div className="rounded-2xl bg-white p-6 shadow">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-4 border-red-600" />
                <p className="text-gray-600">Loading...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    }>
      <CampaignEditContent params={params} />
    </Suspense>
  );
}

