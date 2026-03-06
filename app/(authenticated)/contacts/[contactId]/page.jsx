'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, Phone, Building2, ArrowLeft, Sparkles, X, Edit2, Check, X as XIcon, Loader2, UserCircle, Users, Eye, List, Wand2, Plus, Zap, Linkedin, MessageSquare, UserPlus, Pencil, FileText, BookmarkPlus, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import api from '@/lib/api';
import PageHeader from '@/components/PageHeader.jsx';
import { formatDeliveryMethodLabel, DELIVERY_METHODS, normalizeDeliveryMethod } from '@/lib/utils/deliveryMethod';
import { formatDateEST } from '@/lib/dateEst';
// Display pipeline/stage from relation or snap; format for read-only view
function formatPipelineLabel(pipeline) {
  if (!pipeline || pipeline === 'unassigned') return 'Unassigned';
  if (pipeline === 'no-role') return 'No Role';
  return pipeline.charAt(0).toUpperCase() + pipeline.slice(1).toLowerCase();
}
function formatStageLabel(stage) {
  if (!stage) return 'No Stage';
  return stage.replace(/-/g, ' ').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
import { useContactsContext } from '@/hooks/useContacts';
import ContactOutlook from '@/components/enrichment/ContactOutlook';
import CompanySelector from '@/components/CompanySelector';

export default function ContactDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const contactId = params?.contactId || null;
  const companyHQId = searchParams?.get('companyHQId') || (typeof window !== 'undefined' ? localStorage.getItem('companyHQId') : '') || '';
  const { contacts, refreshContacts } = useContactsContext();
  const [lists, setLists] = useState([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contact, setContact] = useState(null);

  useEffect(() => {
    if (!contactId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const loadContact = async () => {
      try {
        setLoading(true);
        setError('');
        
        // Try to find in cached contacts first (fast initial render)
        const cachedContact = contacts.find((item) => item.id === contactId);
        if (cachedContact && isMounted) {
          setContact(cachedContact);
          setNotesText(cachedContact.notes || '');
          setLoading(false); // Show cached data immediately
        }

        // Fetch fresh data from API
        try {
          const response = await api.get(`/api/contacts/${contactId}`);
          if (!isMounted) return;
          
          if (response.data?.success && response.data.contact) {
            setContact(response.data.contact);
            setNotesText(response.data.contact.notes || '');
            // Load saved relationship context if it exists (from relationship_contexts relation)
            if (response.data.contact.relationship_contexts) {
              const rc = response.data.contact.relationship_contexts;
              setRelationshipContext({
                contextOfRelationship: rc.contextOfRelationship,
                relationshipRecency: rc.relationshipRecency,
                companyAwareness: rc.companyAwareness,
                formerCompany: rc.formerCompany,
              });
            }
            setLoading(false);
            // Don't call refreshContacts here - it causes infinite loops
            // The contact detail is already fresh, no need to refresh the list
          } else {
            if (!cachedContact && isMounted) {
              const errorMsg = response.data?.error || response.data?.details || 'Contact not found.';
              console.error('API returned error:', response.data);
              setError(errorMsg);
              setLoading(false);
            }
          }
        } catch (apiErr) {
          console.error('Error fetching contact from API:', apiErr);
          console.error('Error details:', {
            message: apiErr?.message,
            status: apiErr?.status,
            type: apiErr?.type,
            response: apiErr?.response?.data,
            stack: apiErr?.stack,
          });
          
          // If we have cached contact, keep showing it even if API fails
          if (!cachedContact && isMounted) {
            // Extract error message from various possible error formats
            const errorMsg = 
              apiErr?.response?.data?.error ||
              apiErr?.response?.data?.details ||
              apiErr?.message ||
              apiErr?.type ||
              'Unable to load contact details.';
            
            // Include status code if available for debugging
            const statusCode = apiErr?.status || apiErr?.response?.status;
            const fullErrorMsg = statusCode 
              ? `${errorMsg} (Status: ${statusCode})`
              : errorMsg;
            
            setError(fullErrorMsg);
            setLoading(false);
          } else if (isMounted) {
            setLoading(false); // We have cached data, just stop loading
          }
        }
      } catch (err) {
        console.error('Error loading contact:', err);
        if (!isMounted) return;
        const cachedContact = contacts.find((item) => item.id === contactId);
        if (!cachedContact) {
          setError('Unable to load contact details.');
          setLoading(false);
        }
      }
    };

    loadContact();
    return () => {
      isMounted = false;
    };
    // Only depend on contactId - remove contacts and refreshContacts to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState('');
  const [enrichingCareer, setEnrichingCareer] = useState(false);
  const [careerEnrichError, setCareerEnrichError] = useState('');
  const [showRawJSON, setShowRawJSON] = useState(false);
  const [rawJSON, setRawJSON] = useState(null);
  const [editingCompany, setEditingCompany] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [savingCompany, setSavingCompany] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailText, setEmailText] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [editingStage, setEditingStage] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [savingStage, setSavingStage] = useState(false);
  const [editingLastEngagement, setEditingLastEngagement] = useState(false);
  const [lastEngagementDateEdit, setLastEngagementDateEdit] = useState('');
  const [lastEngagementTypeEdit, setLastEngagementTypeEdit] = useState('');
  const [savingLastEngagement, setSavingLastEngagement] = useState(false);
  const [editingNextEngagement, setEditingNextEngagement] = useState(false);
  const [nextEngagementDateEdit, setNextEngagementDateEdit] = useState('');
  const [nextEngagementPurposeEdit, setNextEngagementPurposeEdit] = useState('');
  const [savingNextEngagement, setSavingNextEngagement] = useState(false);
  const [computingEngagement, setComputingEngagement] = useState(false);
  const [computeResult, setComputeResult] = useState(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [showAddToListModal, setShowAddToListModal] = useState(false);
  const [showEnrichmentDetails, setShowEnrichmentDetails] = useState(false);
  const [editingPersona, setEditingPersona] = useState(false);
  const [selectedPersonaSlug, setSelectedPersonaSlug] = useState(null);
  const [savingPersona, setSavingPersona] = useState(false);
  const [suggestingPersona, setSuggestingPersona] = useState(false);
  const [personaSuggestion, setPersonaSuggestion] = useState(null);
  const [showPersonaSuggestionModal, setShowPersonaSuggestionModal] = useState(false);
  const [availablePersonas, setAvailablePersonas] = useState([]);
  const [loadingPersonas, setLoadingPersonas] = useState(false);
  const [lastEmail, setLastEmail] = useState(null);
  const [synthesizingSummary, setSynthesizingSummary] = useState(false);
  const [synthesizingContactSummary, setSynthesizingContactSummary] = useState(false);
  const [editingContactSummary, setEditingContactSummary] = useState(false);
  const [contactSummaryText, setContactSummaryText] = useState('');
  const [savingContactSummary, setSavingContactSummary] = useState(false);
  const [loadingLastEmail, setLoadingLastEmail] = useState(false);
  const [emailHistory, setEmailHistory] = useState([]);
  const [showAddResponseModal, setShowAddResponseModal] = useState(false);
  const [addResponseEmail, setAddResponseEmail] = useState(null);
  const [addResponseContactResponse, setAddResponseContactResponse] = useState('');
  const [addResponseDisposition, setAddResponseDisposition] = useState('positive');
  const [addResponseRespondedAt, setAddResponseRespondedAt] = useState('');
  const [savingAddResponse, setSavingAddResponse] = useState(false);
  const [addResponseError, setAddResponseError] = useState('');
  const [showEditEmailModal, setShowEditEmailModal] = useState(false);
  const [editEmail, setEditEmail] = useState(null);
  const [editEmailSubject, setEditEmailSubject] = useState('');
  const [editEmailBody, setEditEmailBody] = useState('');
  const [editEmailSentAt, setEditEmailSentAt] = useState('');
  const [editEmailPlatform, setEditEmailPlatform] = useState('email');
  const [savingEditEmail, setSavingEditEmail] = useState(false);
  const [editEmailError, setEditEmailError] = useState('');
  const [relationshipContext, setRelationshipContext] = useState(null);
  const [generatingRelationshipContext, setGeneratingRelationshipContext] = useState(false);
  const [savingRelationshipContext, setSavingRelationshipContext] = useState(false);
  const [editingIntroducedBy, setEditingIntroducedBy] = useState(false);
  const [introducedByEmail, setIntroducedByEmail] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [savingIntroducedBy, setSavingIntroducedBy] = useState(false);

  // Make-template from email history
  const [makeTemplateEmail, setMakeTemplateEmail] = useState(null); // the email being converted

  // Persona templates
  const [personaTemplates, setPersonaTemplates] = useState([]);
  const [loadingPersonaTemplates, setLoadingPersonaTemplates] = useState(false);
  const [expandedTemplateId, setExpandedTemplateId] = useState(null);
  const [showSaveTemplateForm, setShowSaveTemplateForm] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateSubject, setNewTemplateSubject] = useState('');
  const [newTemplateBody, setNewTemplateBody] = useState('');
  const [savingNewTemplate, setSavingNewTemplate] = useState(false);
  const [saveTemplateError, setSaveTemplateError] = useState('');
  const [saveTemplateSuccess, setSaveTemplateSuccess] = useState(false);

  // Load email history (used by effect and after adding response)
  const loadEmailHistory = () => {
    if (!contactId) return;
    setLoadingLastEmail(true);
    api.get(`/api/contacts/${contactId}/email-history`)
      .then((response) => {
        if (response.data?.success && response.data.activities?.length > 0) {
          const mostRecent = response.data.activities[0];
          setLastEmail(mostRecent);
          setEmailHistory(response.data.activities);
        } else {
          setLastEmail(null);
          setEmailHistory([]);
        }
      })
      .catch((error) => {
        console.error('Error loading email history:', error);
        setLastEmail(null);
        setEmailHistory([]);
      })
      .finally(() => {
        setLoadingLastEmail(false);
      });
  };

  useEffect(() => {
    if (!contactId) return;
    loadEmailHistory();
  }, [contactId]);

  const handleOpenAddResponse = (email) => {
    setAddResponseEmail(email);
    setAddResponseContactResponse('');
    setAddResponseDisposition('positive');
    setAddResponseRespondedAt(new Date().toISOString().split('T')[0]);
    setAddResponseError('');
    setShowAddResponseModal(true);
  };

  const handleOpenEditEmail = (email) => {
    setEditEmail(email);
    setEditEmailSubject(email.subject || '');
    setEditEmailBody(email.notes || '');
    const dateStr = email.date ? new Date(email.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    setEditEmailSentAt(dateStr);
    setEditEmailPlatform(DELIVERY_METHODS.includes(email.platform) ? email.platform : 'email');
    setEditEmailError('');
    setShowEditEmailModal(true);
  };

  const handleSaveEditEmail = async () => {
    if (!editEmail?.id) return;
    setSavingEditEmail(true);
    setEditEmailError('');
    try {
      const payload = { subject: editEmailSubject || null, body: editEmailBody || null };
      if (editEmail.type === 'off-platform') {
        payload.sentAt = editEmailSentAt ? new Date(editEmailSentAt).toISOString() : null;
        payload.platform = normalizeDeliveryMethod(editEmailPlatform);
      }
      const response = await api.put(`/api/emails/${editEmail.id}`, payload);
      if (response.data?.success) {
        setShowEditEmailModal(false);
        setEditEmail(null);
        loadEmailHistory();
      } else {
        setEditEmailError(response.data?.error || 'Failed to save');
      }
    } catch (error) {
      setEditEmailError(error.response?.data?.error || error.message || 'Failed to save');
    } finally {
      setSavingEditEmail(false);
    }
  };

  const handleSaveAddResponse = async () => {
    if (!addResponseEmail?.id || !addResponseContactResponse.trim()) {
      setAddResponseError('Response text is required');
      return;
    }
    setSavingAddResponse(true);
    setAddResponseError('');
    try {
      const payload = {
        contactResponse: addResponseContactResponse.trim(),
        responseDisposition: addResponseDisposition,
      };
      if (addResponseRespondedAt) {
        payload.respondedAt = new Date(addResponseRespondedAt).toISOString();
      }
      const response = await api.put(`/api/emails/${addResponseEmail.id}/response`, payload);
      if (response.data?.success) {
        setShowAddResponseModal(false);
        setAddResponseEmail(null);
        loadEmailHistory();
        if (refreshContacts) refreshContacts();
        // Refresh contact (pipeline/notes may have changed)
        const contactRes = await api.get(`/api/contacts/${contactId}`);
        if (contactRes.data?.success && contactRes.data.contact) {
          setContact(contactRes.data.contact);
          setNotesText(contactRes.data.contact.notes || '');
        }
      } else {
        setAddResponseError(response.data?.error || 'Failed to save response');
      }
    } catch (error) {
      setAddResponseError(error.response?.data?.error || error.message || 'Failed to save response');
    } finally {
      setSavingAddResponse(false);
    }
  };
  
  // Load contact lists when modal opens
  useEffect(() => {
    if (showAddToListModal && lists.length === 0 && !loadingLists) {
      setLoadingLists(true);
      api.get('/api/contact-lists')
        .then((response) => {
          if (response.data?.success && Array.isArray(response.data.lists)) {
            setLists(response.data.lists);
          }
        })
        .catch((error) => {
          console.error('Error loading contact lists:', error);
        })
        .finally(() => {
          setLoadingLists(false);
        });
    }
  }, [showAddToListModal, lists.length, loadingLists]);

  // Load available personas when editing persona
  useEffect(() => {
    if (editingPersona && availablePersonas.length === 0 && !loadingPersonas) {
      setLoadingPersonas(true);
      api.get('/api/outreach-personas')
        .then((response) => {
          if (response.data?.success && Array.isArray(response.data.personas)) {
            setAvailablePersonas(response.data.personas);
          }
        })
        .catch((error) => {
          console.error('Error loading personas:', error);
        })
        .finally(() => {
          setLoadingPersonas(false);
        });
    }
  }, [editingPersona, availablePersonas.length, loadingPersonas]);

  // Set selected persona when contact loads
  useEffect(() => {
    if (contact?.outreachPersonaSlug) {
      setSelectedPersonaSlug(contact.outreachPersonaSlug);
    }
  }, [contact?.outreachPersonaSlug]);

  // Load templates for this persona
  useEffect(() => {
    if (!contact?.outreachPersonaSlug || !companyHQId) return;
    setLoadingPersonaTemplates(true);
    api.get(`/api/templates?companyHQId=${companyHQId}&personaSlug=${encodeURIComponent(contact.outreachPersonaSlug)}`)
      .then((res) => {
        if (res.data?.success) {
          setPersonaTemplates(res.data.templates || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPersonaTemplates(false));
  }, [contact?.outreachPersonaSlug, companyHQId]);

  const handleSuggestPersona = async () => {
    if (!contactId) return;
    
    setSuggestingPersona(true);
    try {
      const response = await api.post(`/api/contacts/${contactId}/suggest-persona`, {
        note: editingNotes ? notesText : undefined, // Use current notes text if editing
      });
      
      if (response.data?.success) {
        setPersonaSuggestion(response.data);
        // Also update relationship context if it was generated
        if (response.data.relationshipContext) {
          setRelationshipContext(response.data.relationshipContext);
        }
        setShowPersonaSuggestionModal(true);
      } else {
        alert(response.data?.error || 'Failed to suggest persona');
      }
    } catch (error) {
      console.error('Error suggesting persona:', error);
      alert(error.response?.data?.error || 'Failed to suggest persona');
    } finally {
      setSuggestingPersona(false);
    }
  };

  const handleGenerateRelationshipContext = async () => {
    if (!contactId) return;
    
    setGeneratingRelationshipContext(true);
    try {
      const response = await api.post(`/api/contacts/${contactId}/suggest-persona`, {
        note: editingNotes ? notesText : undefined, // Use current notes text if editing
      });
      
      if (response.data?.success && response.data.relationshipContext) {
        setRelationshipContext(response.data.relationshipContext);
      } else {
        alert(response.data?.error || 'Failed to generate relationship context');
      }
    } catch (error) {
      console.error('Error generating relationship context:', error);
      alert(error.response?.data?.error || 'Failed to generate relationship context');
    } finally {
      setGeneratingRelationshipContext(false);
    }
  };

  const handleApplySuggestedPersona = async () => {
    if (!personaSuggestion?.suggestedPersonaSlug || !contactId) return;
    
    setSavingPersona(true);
    try {
      const response = await api.put(`/api/contacts/${contactId}`, {
        outreachPersonaSlug: personaSuggestion.suggestedPersonaSlug,
      });
      
      if (response.data?.success) {
        setContact(response.data.contact);
        setSelectedPersonaSlug(personaSuggestion.suggestedPersonaSlug);
        setShowPersonaSuggestionModal(false);
        setPersonaSuggestion(null);
        if (refreshContacts) {
          refreshContacts();
        }
      } else {
        alert(response.data?.error || 'Failed to apply persona');
      }
    } catch (error) {
      console.error('Error applying persona:', error);
      alert(error.response?.data?.error || 'Failed to apply persona');
    } finally {
      setSavingPersona(false);
    }
  };

  const handleSavePersonaTemplate = async () => {
    if (!newTemplateTitle.trim() || !newTemplateSubject.trim() || !newTemplateBody.trim()) {
      setSaveTemplateError('Title, subject, and body are all required.');
      return;
    }
    setSavingNewTemplate(true);
    setSaveTemplateError('');
    setSaveTemplateSuccess(false);
    try {
      const res = await api.post('/api/templates', {
        companyHQId,
        title: newTemplateTitle.trim(),
        subject: newTemplateSubject.trim(),
        body: newTemplateBody.trim(),
        personaSlug: contact.outreachPersonaSlug,
      });
      if (res.data?.success) {
        setPersonaTemplates((prev) => [res.data.template, ...prev]);
        setNewTemplateTitle('');
        setNewTemplateSubject('');
        setNewTemplateBody('');
        setShowSaveTemplateForm(false);
        setSaveTemplateSuccess(true);
        setTimeout(() => setSaveTemplateSuccess(false), 3000);
      } else {
        setSaveTemplateError(res.data?.error || 'Failed to save template.');
      }
    } catch (err) {
      setSaveTemplateError(err.response?.data?.error || 'Failed to save template.');
    } finally {
      setSavingNewTemplate(false);
    }
  };

  const displayName = useMemo(() => {
    if (!contact) return 'Contact';
    return (
      contact.goesBy ||
      [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
      'Contact'
    );
  }, [contact]);

  // Check if contact has FULL intelligence enrichment (not just basic LinkedIn data)
  // Uses useMemo (not useEffect) - automatically recalculates when contact changes
  // Only returns true if we have actual intelligence data (scores, summaries), not just basic enrichment metadata
  const isEnriched = useMemo(() => {
    if (!contact) return false;
    
    // Only consider "enriched" if we have actual intelligence data:
    // 1. profileSummary - GPT-generated summary (indicates full intelligence sweep)
    // 2. Intelligence scores - computed from enrichment data
    // 3. enrichmentRedisKey - legacy Redis reference (indicates full enrichment flow)
    
    // NOTE: enrichmentSource and enrichmentPayload alone are NOT enough
    // These are set by simple LinkedIn save, but don't indicate full intelligence
    
    return !!(
      contact.profileSummary || // GPT summary from enrichment (most reliable indicator)
      (contact.seniorityScore !== null && contact.seniorityScore !== undefined) || // Intelligence score
      (contact.buyingPowerScore !== null && contact.buyingPowerScore !== undefined) || // Intelligence score
      contact.enrichmentRedisKey // Legacy Redis key (fallback - indicates full enrichment flow)
    );
  }, [contact]);

  const [showEnrichSuccessModal, setShowEnrichSuccessModal] = useState(false);

  const handleEnrichCareer = async () => {
    if (!contactId || (!contact?.linkedinUrl && !contact?.email)) {
      setCareerEnrichError('Contact must have a LinkedIn URL or email address');
      return;
    }
    
    setEnrichingCareer(true);
    setCareerEnrichError('');
    
    try {
      const response = await api.post(`/api/contacts/${contactId}/enrich-career`, {
        companyHQId,
        linkedinUrl: contact.linkedinUrl,
        email: contact.email,
      });
      
      if (response.data?.success) {
        // Refresh contact data
        const refreshResponse = await api.get(`/api/contacts/${contactId}`);
        if (refreshResponse.data?.success && refreshResponse.data.contact) {
          setContact(refreshResponse.data.contact);
          setNotesText(refreshResponse.data.contact.notes || '');
          if (refreshContacts) {
            refreshContacts();
          }
        }
        alert('Career history enriched successfully!');
      } else {
        throw new Error(response.data?.error || 'Career enrichment failed');
      }
    } catch (err) {
      console.error('Career enrichment error:', err);
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to enrich career history';
      setCareerEnrichError(errorMessage);
    } finally {
      setEnrichingCareer(false);
    }
  };

  const handleEnrichContact = async () => {
    if (!contactId || !contact?.email) {
      setEnrichError('Contact must have an email address to enrich');
      return;
    }

    setEnriching(true);
    setEnrichError('');

    try {
      // Step 1: Enrich by email
      const enrichResponse = await api.post('/api/contacts/enrich/by-email', {
        contactId,
      });

      if (!enrichResponse.data?.success) {
        throw new Error(enrichResponse.data?.error || 'Enrichment failed');
      }

      // Step 2: Save the enrichment (use Redis key if present, otherwise pass raw payload when Redis failed)
      const redisKey = enrichResponse.data?.redisKey || null;
      const rawApolloResponse = enrichResponse.data?.rawApolloResponse || null;
      if (!redisKey && !rawApolloResponse) {
        throw new Error('No enrichment data returned. Please try again.');
      }

      const savePayload = {
        contactId,
        ...(redisKey ? { redisKey } : { rawEnrichmentPayload: rawApolloResponse }),
      };
      const saveResponse = await api.post('/api/contacts/enrich/save', savePayload);

      if (!saveResponse.data?.success) {
        throw new Error(saveResponse.data?.error || 'Failed to save enrichment');
      }

      // Check if intelligence was actually saved
      const hasIntelligence = saveResponse.data?.contact?.seniorityScore !== undefined ||
        saveResponse.data?.contact?.profileSummary !== undefined;

      // Step 3: Refresh contact data
      const updatedContactResponse = await api.get(`/api/contacts/${contactId}`);
      if (updatedContactResponse.data?.success && updatedContactResponse.data?.contact) {
        setContact(updatedContactResponse.data.contact);
        setNotesText(updatedContactResponse.data.contact.notes || '');
        if (refreshContacts) {
          refreshContacts();
        }
      }

      // Step 4: Show success modal if intelligence was saved
      if (hasIntelligence) {
        setShowEnrichSuccessModal(true);
      }
    } catch (err) {
      console.error('Enrichment error:', err);
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to enrich contact';
      setEnrichError(errorMessage);
    } finally {
      setEnriching(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-lg font-semibold text-gray-800">Loading contact…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-lg font-semibold text-red-600">
              {error || 'Contact not found.'}
            </p>
            <button
              type="button"
              onClick={() => router.push('/people')}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Back to People Hub
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title={displayName}
          subtitle="Full profile, pipeline status, and relationship notes."
          backTo="/contacts/view"
          backLabel="Back to People Hub"
        />

        <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-gray-600 shadow hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          {!editingStage ? (
            <>
              {(() => {
                const pl = contact.pipelines?.pipeline || contact.pipelineSnap || contact.pipeline?.pipeline;
                const isNoRole = pl === 'no-role';
                const isUnassigned = !pl || pl === 'unassigned';
                return (
                  <span className={`rounded-full px-3 py-1 font-semibold ${isNoRole ? 'bg-gray-100 text-gray-500 italic' : isUnassigned ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                    {formatPipelineLabel(pl)}
                  </span>
                );
              })()}
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-600">
                  {formatStageLabel(contact.pipelines?.stage || contact.pipelineStageSnap || contact.pipeline?.stage)}
                </span>
                <button
                  onClick={() => {
                    const currentPipeline = contact.pipelines?.pipeline || contact.pipelineSnap || contact.pipeline?.pipeline || 'unassigned';
                    const currentStage = contact.pipelines?.stage || contact.pipelineStageSnap || contact.pipeline?.stage || null;
                    setEditingStage(true);
                    setSelectedPipeline(currentPipeline);
                    setSelectedStage(currentStage || '');
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
                value={selectedPipeline}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedPipeline(val);
                  // Stage-less pipelines: clear stage
                  if (val === 'unassigned' || val === 'no-role') {
                    setSelectedStage('');
                  } else if (val === 'connector') {
                    setSelectedStage('forwarded');
                  } else if (val === 'prospect') {
                    setSelectedStage('need-to-engage');
                  } else if (val === 'friend') {
                    setSelectedStage('awaiting_next_job');
                  } else {
                    setSelectedStage('interest');
                  }
                }}
                className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-600 border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="unassigned">Unassigned</option>
                <option value="no-role">No Role</option>
                <option value="connector">Connector</option>
                <option value="prospect">Prospect</option>
                <option value="client">Client</option>
                <option value="collaborator">Collaborator</option>
                <option value="institution">Institution</option>
                <option value="friend">Friend</option>
              </select>
              {selectedPipeline !== 'unassigned' && selectedPipeline !== 'no-role' && (
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value)}
                  className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-600 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  {selectedPipeline === 'connector' && (
                    <>
                      <option value="forwarded">Forwarded</option>
                      <option value="introduction-made">Introduction Made</option>
                    </>
                  )}
                  {selectedPipeline === 'prospect' && (
                    <>
                      <option value="need-to-engage">Need to Engage</option>
                      <option value="engaged-awaiting-response">Engaged Awaiting Response</option>
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
                  {selectedPipeline === 'friend' && (
                    <>
                      <option value="awaiting_next_job">Awaiting next job</option>
                      <option value="navigating">Navigating</option>
                    </>
                  )}
                </select>
              )}
              {(selectedPipeline === 'unassigned' || selectedPipeline === 'no-role') && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-500 italic">
                  No Stage
                </span>
              )}
              <button
                onClick={async () => {
                  if (!selectedPipeline) {
                    alert('Please select a pipeline');
                    return;
                  }
                  // Stage is required for all pipelines except unassigned and no-role
                  const noStagePipelines = ['unassigned', 'no-role'];
                  if (!noStagePipelines.includes(selectedPipeline) && !selectedStage) {
                    alert('Please select both pipeline and stage');
                    return;
                  }
                  setSavingStage(true);
                  try {
                    // Use dedicated pipeline route
                    // For unassigned, don't send stage (or send null)
                    const noStagePipelines = ['unassigned', 'no-role'];
                    const payload = {
                      pipeline: selectedPipeline,
                    };
                    if (!noStagePipelines.includes(selectedPipeline) && selectedStage) {
                      payload.stage = selectedStage;
                    }
                    const response = await api.put(`/api/contacts/${contactId}/pipeline`, payload);
                    if (response.data?.success) {
                      setContact(response.data.contact);
                      setEditingStage(false);
                      if (refreshContacts) {
                        refreshContacts();
                      }
                    } else {
                      alert(response.data?.error || 'Failed to update pipeline');
                    }
                  } catch (error) {
                    console.error('Error updating pipeline:', error);
                    alert(error.response?.data?.error || 'Failed to update pipeline');
                  } finally {
                    setSavingStage(false);
                  }
                }}
                disabled={savingStage}
                className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="h-3 w-3" />
                {savingStage ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setEditingStage(false);
                  setSelectedPipeline(null);
                  setSelectedStage(null);
                }}
                disabled={savingStage}
                className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Last engagement */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-gray-600">Last engagement:</span>
            {!editingLastEngagement ? (
              <>
                {contact.lastEngagementDate ? (
                  <>
                    <span className="text-gray-800">
                      {formatDateEST(new Date(contact.lastEngagementDate).toISOString().slice(0, 10), { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    {contact.lastEngagementType && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {contact.lastEngagementType === 'OUTBOUND_EMAIL' && 'Outbound email'}
                        {contact.lastEngagementType === 'CONTACT_RESPONSE' && 'Contact response'}
                        {contact.lastEngagementType === 'MEETING' && 'Meeting'}
                        {contact.lastEngagementType === 'MANUAL' && 'Manual'}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-gray-400">Not set</span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditingLastEngagement(true);
                    setLastEngagementDateEdit(contact.lastEngagementDate ? new Date(contact.lastEngagementDate).toISOString().slice(0, 10) : '');
                    setLastEngagementTypeEdit(contact.lastEngagementType || '');
                  }}
                  className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                  title="Edit last engagement"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={lastEngagementDateEdit}
                  onChange={(e) => setLastEngagementDateEdit(e.target.value)}
                  className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                />
                <select
                  value={lastEngagementTypeEdit}
                  onChange={(e) => setLastEngagementTypeEdit(e.target.value)}
                  className="rounded-lg border border-gray-300 px-2 py-1 text-sm min-w-[160px]"
                >
                  <option value="">—</option>
                  <option value="OUTBOUND_EMAIL">Outbound email</option>
                  <option value="CONTACT_RESPONSE">Contact response</option>
                  <option value="MEETING">Meeting</option>
                  <option value="MANUAL">Manual</option>
                </select>
                <button
                  type="button"
                  disabled={savingLastEngagement}
                  onClick={async () => {
                    setSavingLastEngagement(true);
                    try {
                      const res = await api.patch(`/api/contacts/${contactId}/last-engagement`, {
                        lastEngagementDate: lastEngagementDateEdit || null,
                        lastEngagementType: lastEngagementTypeEdit || null,
                      });
                      if (res.data?.success) {
                        setContact((prev) => ({ ...prev, ...res.data.contact }));
                        setEditingLastEngagement(false);
                        if (refreshContacts) refreshContacts();
                      } else {
                        alert(res.data?.error || 'Failed to update');
                      }
                    } catch (err) {
                      alert(err.response?.data?.error || err.message || 'Failed to update');
                    } finally {
                      setSavingLastEngagement(false);
                    }
                  }}
                  className="flex items-center gap-1 rounded-lg bg-green-600 px-2 py-1 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <Check className="h-3 w-3" />
                  {savingLastEngagement ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingLastEngagement(false);
                    setLastEngagementDateEdit('');
                    setLastEngagementTypeEdit('');
                  }}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Next engagement */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-gray-600">Next engagement:</span>
            {!editingNextEngagement ? (
              <>
                {contact.nextEngagementDate ? (
                  <>
                    <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-800">
                      {formatDateEST(contact.nextEngagementDate, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    {contact.nextEngagementPurpose && (
                      <span className="text-gray-500">
                        {contact.nextEngagementPurpose === 'GENERAL_CHECK_IN' && 'General check-in'}
                        {contact.nextEngagementPurpose === 'UNRESPONSIVE' && 'Unresponsive'}
                        {contact.nextEngagementPurpose === 'PERIODIC_CHECK_IN' && 'Periodic check-in'}
                        {contact.nextEngagementPurpose === 'REFERRAL_NO_CONTACT' && 'Referral (no contact)'}
                        {!['GENERAL_CHECK_IN', 'UNRESPONSIVE', 'PERIODIC_CHECK_IN', 'REFERRAL_NO_CONTACT'].includes(contact.nextEngagementPurpose) && contact.nextEngagementPurpose}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-gray-400">Not set</span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditingNextEngagement(true);
                    setNextEngagementDateEdit(contact.nextEngagementDate || '');
                    setNextEngagementPurposeEdit(contact.nextEngagementPurpose || '');
                  }}
                  className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                  title="Edit next engagement"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={computingEngagement}
                  onClick={async () => {
                    setComputingEngagement(true);
                    setComputeResult(null);
                    try {
                      const res = await api.post(`/api/contacts/${contactId}/compute-engagement`);
                      if (res.data?.success) {
                        setComputeResult(res.data);
                        // Reload contact to surface updated disposition, pipeline, and date
                        const contactRes = await api.get(`/api/contacts/${contactId}`);
                        if (contactRes.data?.contact) {
                          setContact(contactRes.data.contact);
                          if (refreshContacts) refreshContacts();
                        }
                      } else {
                        alert(res.data?.error || 'Failed to compute');
                      }
                    } catch (err) {
                      alert(err.response?.data?.error || err.message || 'Failed to compute');
                    } finally {
                      setComputingEngagement(false);
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
                  title="AI inference: set disposition, pipeline stage, and next engagement date from email history"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {computingEngagement ? 'Calculating...' : 'Calculate'}
                </button>
                {computeResult && (
                  <span className="text-xs text-green-600 font-medium">
                    ✓ {computeResult.source === 'ai_full_inference' ? `AI inferred · ${computeResult.reasoning || ''}` : computeResult.source?.replace(/_/g, ' ')}
                  </span>
                )}
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={nextEngagementDateEdit}
                  onChange={(e) => setNextEngagementDateEdit(e.target.value)}
                  className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                />
                <select
                  value={nextEngagementPurposeEdit}
                  onChange={(e) => setNextEngagementPurposeEdit(e.target.value)}
                  className="rounded-lg border border-gray-300 px-2 py-1 text-sm min-w-[160px]"
                >
                  <option value="">—</option>
                  <option value="GENERAL_CHECK_IN">General check-in</option>
                  <option value="UNRESPONSIVE">Unresponsive</option>
                  <option value="PERIODIC_CHECK_IN">Periodic check-in</option>
                  <option value="REFERRAL_NO_CONTACT">Referral (no contact)</option>
                </select>
                <button
                  type="button"
                  disabled={savingNextEngagement}
                  onClick={async () => {
                    setSavingNextEngagement(true);
                    try {
                      const res = await api.patch(`/api/contacts/${contactId}/next-engagement`, {
                        nextEngagementDate: nextEngagementDateEdit || null,
                        nextEngagementPurpose: nextEngagementPurposeEdit || null,
                      });
                      if (res.data?.success) {
                        setContact((prev) => ({ ...prev, ...res.data.contact }));
                        setEditingNextEngagement(false);
                        if (refreshContacts) refreshContacts();
                      } else {
                        alert(res.data?.error || 'Failed to update');
                      }
                    } catch (err) {
                      alert(err.response?.data?.error || err.message || 'Failed to update');
                    } finally {
                      setSavingNextEngagement(false);
                    }
                  }}
                  className="flex items-center gap-1 rounded-lg bg-green-600 px-2 py-1 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <Check className="h-3 w-3" />
                  {savingNextEngagement ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingNextEngagement(false);
                    setNextEngagementDateEdit('');
                    setNextEngagementPurposeEdit('');
                  }}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Contact Summary — rich person narrative */}
        <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-600" />
              Contact Summary
            </h3>
            <div className="flex items-center gap-2">
              {!editingContactSummary && contact.contactSummary && (
                <button
                  type="button"
                  onClick={() => {
                    setContactSummaryText(contact.contactSummary || '');
                    setEditingContactSummary(true);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-indigo-300 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 transition"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  setSynthesizingContactSummary(true);
                  try {
                    const res = await api.post(`/api/contacts/${contactId}/synthesize-contact-summary`);
                    if (res.data?.success) {
                      setContact((prev) => ({ ...prev, contactSummary: res.data.summary }));
                      setEditingContactSummary(false);
                      if (refreshContacts) refreshContacts();
                    } else {
                      alert(res.data?.error || 'Failed to generate summary');
                    }
                  } catch (err) {
                    alert(err.response?.data?.error || err.message || 'Failed to generate summary');
                  } finally {
                    setSynthesizingContactSummary(false);
                  }
                }}
                disabled={synthesizingContactSummary}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {synthesizingContactSummary ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {contact.contactSummary ? 'Regenerate' : 'Generate'}
                  </>
                )}
              </button>
            </div>
          </div>
          {editingContactSummary ? (
            <div className="space-y-2">
              <textarea
                value={contactSummaryText}
                onChange={(e) => setContactSummaryText(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-indigo-300 px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 resize-y"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setSavingContactSummary(true);
                    try {
                      const res = await api.put(`/api/contacts/${contactId}`, {
                        contactSummary: contactSummaryText.trim() || null,
                      });
                      if (res.data?.success) {
                        setContact((prev) => ({ ...prev, contactSummary: contactSummaryText.trim() || null }));
                        setEditingContactSummary(false);
                        if (refreshContacts) refreshContacts();
                      } else {
                        alert(res.data?.error || 'Failed to save');
                      }
                    } catch (err) {
                      alert(err.response?.data?.error || err.message || 'Failed to save');
                    } finally {
                      setSavingContactSummary(false);
                    }
                  }}
                  disabled={savingContactSummary}
                  className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition"
                >
                  <Check className="h-3.5 w-3.5" />
                  {savingContactSummary ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingContactSummary(false);
                    setContactSummaryText('');
                  }}
                  disabled={savingContactSummary}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  <XIcon className="h-3.5 w-3.5" />
                  Cancel
                </button>
              </div>
            </div>
          ) : contact.contactSummary ? (
            <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
              {contact.contactSummary}
            </p>
          ) : (
            <p className="text-sm text-gray-500 italic">
              No contact summary yet. Click "Generate" to create a narrative from relationship context and email history.
            </p>
          )}

          {/* Engagement status — 1-sentence, action-oriented */}
          <div className="mt-4 pt-4 border-t border-indigo-100">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400 mb-1">Engagement status</p>
                {contact.engagementSummary ? (
                  <p className="text-sm font-medium text-gray-800">{contact.engagementSummary}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">Not generated yet</p>
                )}
              </div>
              <button
                type="button"
                onClick={async () => {
                  setSynthesizingSummary(true);
                  try {
                    const res = await api.post(`/api/contacts/${contactId}/synthesize-engagement-summary`);
                    if (res.data?.success) {
                      setContact((prev) => ({ ...prev, engagementSummary: res.data.summary }));
                      if (refreshContacts) refreshContacts();
                    } else {
                      alert(res.data?.error || 'Failed to generate');
                    }
                  } catch (err) {
                    alert(err.response?.data?.error || err.message || 'Failed to generate');
                  } finally {
                    setSynthesizingSummary(false);
                  }
                }}
                disabled={synthesizingSummary}
                title={contact.engagementSummary ? 'Regenerate engagement status' : 'Generate engagement status'}
                className="shrink-0 flex items-center gap-1 rounded-lg border border-indigo-200 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {synthesizingSummary ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Zap className="h-3 w-3" />
                )}
                {contact.engagementSummary ? 'Refresh' : 'Generate'}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Career Enrichment Error */}
          {careerEnrichError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-800 mb-1">
                    Career Enrichment failed
                  </h3>
                  <p className="text-sm text-red-700">{careerEnrichError}</p>
                </div>
                <button
                  onClick={() => setCareerEnrichError('')}
                  className="text-red-400 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          
          {/* Enrichment Error */}
          {enrichError && (
            <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <X className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-sm font-semibold text-red-900">
                      Enrichment failed
                    </p>
                    <p className="text-xs text-red-700">
                      {enrichError}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEnrichError('')}
                  className="rounded-lg p-1 text-red-600 transition hover:bg-red-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <section className="rounded-2xl bg-white p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Contact Information
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Enrich - by email; after success, Build Persona is offered in modal only */}
                <button
                  onClick={handleEnrichContact}
                  disabled={enriching || !contact?.email}
                  className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Enrich contact by email; then optionally build persona"
                >
                  {enriching ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enriching...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Enrich
                    </>
                  )}
                </button>
                {/* Build Persona - only offered after Enrich (in success modal), not standalone here */}
                {/* Build Email - not enrich-dependent; uses snippets + context + persona when available */}
                <button
                  onClick={() => {
                    router.push(`/contacts/${contactId}/outreach-message?companyHQId=${companyHQId}`);
                  }}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                  title="Build outreach email from contact context and snippets"
                >
                  <Sparkles className="h-4 w-4" />
                  Build Email
                </button>
                {/* Email */}
                {contact?.email && (
                  <button
                    onClick={() => {
                      const url = companyHQId 
                        ? `/outreach/compose?contactId=${contactId}&companyHQId=${companyHQId}`
                        : `/outreach/compose?contactId=${contactId}`;
                      router.push(url);
                    }}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    title="Send Email"
                  >
                    <Mail className="h-4 w-4" />
                    Email
                  </button>
                )}
                {/* Add to List */}
                <button
                  onClick={() => setShowAddToListModal(true)}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  title="Add to List"
                >
                  <List className="h-4 w-4" />
                  Add to List
                </button>
              </div>
            </div>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-semibold text-gray-500">Preferred Name</dt>
                <dd className="mt-1 text-base text-gray-900">
                  {contact.goesBy || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-gray-500">Full Name</dt>
                <dd className="mt-1 text-base text-gray-900">
                  {[contact.firstName, contact.lastName].filter(Boolean).join(' ') || '—'}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-gray-400" />
                <div className="flex-1">
                  <dt className="text-sm font-semibold text-gray-500 mb-1">Email</dt>
                  {!editingEmail ? (
                    <div className="flex items-center gap-2">
                      <dd className="text-base text-gray-900">
                        {contact.email || '—'}
                      </dd>
                      <button
                        onClick={() => {
                          setEditingEmail(true);
                          setEmailText(contact.email || '');
                        }}
                        className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                        title="Edit email"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="email"
                        value={emailText}
                        onChange={(e) => setEmailText(e.target.value)}
                        placeholder="email@example.com"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            setSavingEmail(true);
                            try {
                              const response = await api.put(`/api/contacts/${contactId}`, {
                                email: emailText.trim() || null,
                              });
                              if (response.data?.success) {
                                setContact(response.data.contact);
                                setEditingEmail(false);
                                if (refreshContacts) {
                                  refreshContacts();
                                }
                              } else {
                                alert(response.data?.error || 'Failed to save email');
                              }
                            } catch (error) {
                              console.error('Error saving email:', error);
                              alert(error.response?.data?.error || 'Failed to save email');
                            } finally {
                              setSavingEmail(false);
                            }
                          }}
                          disabled={savingEmail}
                          className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Check className="h-4 w-4" />
                          {savingEmail ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingEmail(false);
                            setEmailText(contact.email || '');
                          }}
                          disabled={savingEmail}
                          className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                        >
                          <XIcon className="h-4 w-4" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-gray-400" />
                <div>
                  <dt className="text-sm font-semibold text-gray-500">Phone</dt>
                  <dd className="mt-1 text-base text-gray-900">
                    {contact.phone || '—'}
                  </dd>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Linkedin className="h-5 w-5 text-gray-400" />
                <div>
                  <dt className="text-sm font-semibold text-gray-500">LinkedIn</dt>
                  <dd className="mt-1 text-base text-gray-900">
                    {contact.linkedinUrl ? (
                      <a
                        href={contact.linkedinUrl.startsWith('http') ? contact.linkedinUrl : `https://${contact.linkedinUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {contact.linkedinUrl}
                      </a>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-gray-400" />
                <div className="flex-1">
                  <dt className="text-sm font-semibold text-gray-500 mb-1">Company</dt>
                  {!editingCompany ? (
                    <div className="flex items-center gap-2">
                      <dd className="text-base text-gray-900">
                        {contact.companies?.companyName || contact.company?.companyName || contact.contactCompany?.companyName || contact.companyName || 'No company assigned'}
                      </dd>
                      <button
                        onClick={() => {
                          const existingCompany = contact.companies || contact.company || contact.contactCompany || null;
                          setEditingCompany(true);
                          setSelectedCompany(existingCompany);
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
                        companyId={contact.companies?.id || contact.company?.id || contact.contactCompany?.id || null}
                        selectedCompany={selectedCompany || contact.companies || contact.company || contact.contactCompany || null}
                        onCompanySelect={(company) => {
                          setSelectedCompany(company);
                        }}
                        showLabel={false}
                        placeholder="Search or create company..."
                        companyHQId={companyHQId || undefined}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            if (!selectedCompany) {
                              alert('Please select or create a company');
                              return;
                            }
                            setSavingCompany(true);
                            try {
                              const response = await api.put(`/api/contacts/${contactId}`, {
                                contactCompanyId: selectedCompany.id,
                                companyId: selectedCompany.id,
                              });
                              if (response.data?.success) {
                                const updatedContact = response.data.contact;
                                setContact(updatedContact);
                                setEditingCompany(false);
                                
                                // NO localStorage - API only
                                
                                // Refresh contacts list via context
                                if (refreshContacts) {
                                  refreshContacts();
                                }
                              } else {
                                alert(response.data?.error || 'Failed to assign company');
                              }
                            } catch (error) {
                              console.error('Error assigning company:', error);
                              alert(error.response?.data?.error || 'Failed to assign company');
                            } finally {
                              setSavingCompany(false);
                            }
                          }}
                          disabled={savingCompany || !selectedCompany}
                          className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Check className="h-4 w-4" />
                          {savingCompany ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingCompany(false);
                            setSelectedCompany(null);
                          }}
                          disabled={savingCompany}
                          className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                        >
                          <XIcon className="h-4 w-4" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <dt className="text-sm font-semibold text-gray-500">Title</dt>
                <dd className="mt-1 text-base text-gray-900">
                  {contact.title || '—'}
                </dd>
              </div>
            </dl>
          </section>

          {/* Outreach Persona Section */}
          <section className="rounded-2xl bg-white p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Outreach Persona</h3>
              {!editingPersona && (
                <button
                  onClick={() => {
                    setEditingPersona(true);
                    setSelectedPersonaSlug(contact.outreachPersonaSlug || null);
                  }}
                  className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                  title="Edit persona"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              )}
            </div>
            {!editingPersona ? (
              <div>
                {contact.outreachPersonaSlug ? (
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-700">
                      {contact.outreachPersonaSlug}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No outreach persona assigned. Generate one from notes or select manually.</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <select
                  value={selectedPersonaSlug || ''}
                  onChange={(e) => setSelectedPersonaSlug(e.target.value || null)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  disabled={loadingPersonas}
                >
                  <option value="">No persona (unassigned)</option>
                  {loadingPersonas ? (
                    <option>Loading personas...</option>
                  ) : (
                    availablePersonas.map((persona) => (
                      <option key={persona.slug} value={persona.slug}>
                        {persona.name} ({persona.slug})
                      </option>
                    ))
                  )}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setSavingPersona(true);
                      try {
                        const response = await api.put(`/api/contacts/${contactId}`, {
                          outreachPersonaSlug: selectedPersonaSlug || null,
                        });
                        if (response.data?.success) {
                          setContact(response.data.contact);
                          setEditingPersona(false);
                          if (refreshContacts) {
                            refreshContacts();
                          }
                        } else {
                          alert(response.data?.error || 'Failed to save persona');
                        }
                      } catch (error) {
                        console.error('Error saving persona:', error);
                        alert(error.response?.data?.error || 'Failed to save persona');
                      } finally {
                        setSavingPersona(false);
                      }
                    }}
                    disabled={savingPersona}
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Check className="h-4 w-4" />
                    {savingPersona ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingPersona(false);
                      setSelectedPersonaSlug(contact.outreachPersonaSlug || null);
                    }}
                    disabled={savingPersona}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    <XIcon className="h-4 w-4" />
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Persona Templates Section */}
          {contact?.outreachPersonaSlug && (
            <section className="rounded-2xl bg-white p-6 shadow">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-purple-500" />
                    Persona Templates
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">{contact.outreachPersonaSlug}</p>
                </div>
                <button
                  onClick={() => {
                    setShowSaveTemplateForm((v) => !v);
                    setSaveTemplateError('');
                    setSaveTemplateSuccess(false);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 transition hover:bg-purple-100"
                >
                  <BookmarkPlus className="h-3.5 w-3.5" />
                  Save email as template
                </button>
              </div>

              {/* Save template inline form */}
              {showSaveTemplateForm && (
                <div className="mb-5 space-y-3 rounded-xl border border-purple-200 bg-purple-50/40 p-4">
                  <p className="text-xs font-semibold text-purple-800 uppercase tracking-wide">
                    New template for <span className="font-bold">{contact.outreachPersonaSlug}</span>
                  </p>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Title</label>
                    <input
                      type="text"
                      value={newTemplateTitle}
                      onChange={(e) => setNewTemplateTitle(e.target.value)}
                      placeholder={`${contact.outreachPersonaSlug} – initial outreach`}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Subject</label>
                    <input
                      type="text"
                      value={newTemplateSubject}
                      onChange={(e) => setNewTemplateSubject(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Body
                      <span className="ml-2 font-normal text-gray-400">Use {'{{first_name}}'} and {'{{company_name}}'} for variable slots</span>
                    </label>
                    <textarea
                      value={newTemplateBody}
                      onChange={(e) => setNewTemplateBody(e.target.value)}
                      rows={6}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                    />
                  </div>
                  {saveTemplateError && (
                    <p className="text-xs text-red-600">{saveTemplateError}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSavePersonaTemplate}
                      disabled={savingNewTemplate}
                      className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
                    >
                      {savingNewTemplate ? 'Saving…' : 'Save template'}
                    </button>
                    <button
                      onClick={() => { setShowSaveTemplateForm(false); setNewTemplateTitle(''); setNewTemplateSubject(''); setNewTemplateBody(''); setSaveTemplateError(''); }}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {saveTemplateSuccess && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700">
                  <Check className="h-4 w-4" /> Template saved to persona library.
                </div>
              )}

              {/* Template list */}
              {loadingPersonaTemplates ? (
                <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading templates…
                </div>
              ) : personaTemplates.length === 0 ? (
                <p className="text-sm text-gray-400 italic">
                  No templates saved for this persona yet. Generate one from the outreach page or paste an email above.
                </p>
              ) : (
                <div className="space-y-3">
                  {personaTemplates.map((tpl) => (
                    <div key={tpl.id} className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
                      {/* Template header row */}
                      <div
                        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-100 transition"
                        onClick={() => setExpandedTemplateId(expandedTemplateId === tpl.id ? null : tpl.id)}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{tpl.title}</p>
                          <p className="text-xs text-gray-500 truncate mt-0.5">{tpl.subject}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          <Link
                            href={`/contacts/${contactId}/outreach-message${companyHQId ? `?companyHQId=${companyHQId}` : ''}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-purple-700"
                          >
                            Use this
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                          {expandedTemplateId === tpl.id
                            ? <ChevronUp className="h-4 w-4 text-gray-400" />
                            : <ChevronDown className="h-4 w-4 text-gray-400" />
                          }
                        </div>
                      </div>
                      {/* Expanded body */}
                      {expandedTemplateId === tpl.id && (
                        <div className="border-t border-gray-200 bg-white px-4 py-4">
                          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">{tpl.body}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Introduced By Section */}
          <section className="rounded-2xl bg-white p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-gray-500" />
                Introduced By
              </h3>
              {!editingIntroducedBy && (
                <button
                  onClick={() => {
                    setEditingIntroducedBy(true);
                    setIntroducedByEmail('');
                    setLookupResult(null);
                    setLookupError('');
                  }}
                  className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                  title="Set who introduced this contact"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              )}
            </div>
            {!editingIntroducedBy ? (
              <div>
                {contact.introducedByContact ? (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">Introduced by</span>
                    <Link
                      href={`/contacts/${contact.introducedByContactId}${companyHQId ? `?companyHQId=${companyHQId}` : ''}`}
                      className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {contact.introducedByContact.displayName}
                    </Link>
                    {contact.introducedByContact.email && (
                      <span className="text-sm text-gray-500">({contact.introducedByContact.email})</span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No introducer set. Click edit to add who introduced this contact.</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={introducedByEmail}
                    onChange={(e) => {
                      setIntroducedByEmail(e.target.value);
                      setLookupError('');
                      setLookupResult(null);
                    }}
                    placeholder="Enter introducer's email to look up"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={async () => {
                      if (!introducedByEmail.trim() || !contact.crmId) return;
                      setLookingUp(true);
                      setLookupError('');
                      setLookupResult(null);
                      try {
                        const response = await api.get(
                          `/api/contacts/lookup-by-email?email=${encodeURIComponent(introducedByEmail.trim())}&crmId=${encodeURIComponent(contact.crmId)}`
                        );
                        if (response.data?.success && response.data.contact) {
                          setLookupResult(response.data.contact);
                        } else {
                          setLookupError(response.data?.error || 'Contact not found');
                        }
                      } catch (err) {
                        setLookupError(err.response?.data?.error || err.message || 'Lookup failed');
                      } finally {
                        setLookingUp(false);
                      }
                    }}
                    disabled={lookingUp || !introducedByEmail.trim() || !contact.crmId}
                    className="flex items-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {lookingUp ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Looking up...
                      </>
                    ) : (
                      'Look up'
                    )}
                  </button>
                </div>
                {lookupError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-sm text-red-700">
                    {lookupError}
                  </div>
                )}
                {lookupResult && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-gray-900">{lookupResult.displayName}</span>
                      {lookupResult.email && (
                        <span className="ml-2 text-sm text-gray-500">({lookupResult.email})</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          setSavingIntroducedBy(true);
                          try {
                            const response = await api.put(`/api/contacts/${contactId}`, {
                              introducedByContactId: lookupResult.id,
                            });
                            if (response.data?.success) {
                              const contactRes = await api.get(`/api/contacts/${contactId}`);
                              if (contactRes.data?.success && contactRes.data.contact) {
                                setContact(contactRes.data.contact);
                              }
                              setEditingIntroducedBy(false);
                              setLookupResult(null);
                              setIntroducedByEmail('');
                              if (refreshContacts) refreshContacts();
                            } else {
                              setLookupError(response.data?.error || 'Failed to save');
                            }
                          } catch (err) {
                            setLookupError(err.response?.data?.error || err.message || 'Failed to save');
                          } finally {
                            setSavingIntroducedBy(false);
                          }
                        }}
                        disabled={savingIntroducedBy}
                        className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Check className="h-4 w-4" />
                        {savingIntroducedBy ? 'Saving...' : 'Set'}
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (!contact.introducedByContactId) {
                        setEditingIntroducedBy(false);
                        setLookupResult(null);
                        setIntroducedByEmail('');
                        return;
                      }
                      setSavingIntroducedBy(true);
                      try {
                        const response = await api.put(`/api/contacts/${contactId}`, {
                          introducedByContactId: null,
                        });
                        if (response.data?.success) {
                          const contactRes = await api.get(`/api/contacts/${contactId}`);
                          if (contactRes.data?.success && contactRes.data.contact) {
                            setContact(contactRes.data.contact);
                          }
                          setEditingIntroducedBy(false);
                          setLookupResult(null);
                          setIntroducedByEmail('');
                          if (refreshContacts) refreshContacts();
                        } else {
                          setLookupError(response.data?.error || 'Failed to clear');
                        }
                      } catch (err) {
                        setLookupError(err.response?.data?.error || err.message || 'Failed to clear');
                      } finally {
                        setSavingIntroducedBy(false);
                      }
                    }}
                    disabled={savingIntroducedBy}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => {
                      setEditingIntroducedBy(false);
                      setLookupResult(null);
                      setIntroducedByEmail('');
                      setLookupError('');
                    }}
                    disabled={savingIntroducedBy}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Notes Section (source for both persona and relationship context) */}
          <section className="rounded-2xl bg-white p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Notes</h3>
              <div className="flex items-center gap-2">
                {!editingNotes && (contact?.notes || notesText.trim()) && (
                  <>
                    <button
                      onClick={handleSuggestPersona}
                      disabled={suggestingPersona}
                      className="flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Generate persona from notes"
                    >
                      {suggestingPersona ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-4 w-4" />
                          Generate Persona
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleGenerateRelationshipContext}
                      disabled={generatingRelationshipContext}
                      className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Generate relationship context from notes"
                    >
                      {generatingRelationshipContext ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Generate Context
                        </>
                      )}
                    </button>
                  </>
                )}
                {!editingNotes && (
                  <button
                    onClick={() => {
                      setEditingNotes(true);
                      setNotesText(contact.notes || '');
                    }}
                    className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                    title="Edit notes"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            {!editingNotes ? (
              <div>
                {contact.notes ? (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{contact.notes}</p>
                ) : (
                  <button
                    onClick={() => {
                      setEditingNotes(true);
                      setNotesText('');
                    }}
                    className="w-full rounded-lg border-2 border-dashed border-gray-200 p-4 text-left text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition"
                  >
                    + Add notes — relationship context, how you met, former company, key signals. Used to generate persona and contact summary.
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="Add notes from meetings, emails, and relationship updates..."
                  className="w-full min-h-[120px] rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 resize-y"
                  autoFocus
                />
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={async () => {
                      setSavingNotes(true);
                      try {
                        const response = await api.put(`/api/contacts/${contactId}`, {
                          notes: notesText.trim() || null,
                        });
                        if (response.data?.success) {
                          setContact(response.data.contact);
                          setEditingNotes(false);
                          if (refreshContacts) {
                            refreshContacts();
                          }
                        } else {
                          alert(response.data?.error || 'Failed to save notes');
                        }
                      } catch (error) {
                        console.error('Error saving notes:', error);
                        alert(error.response?.data?.error || 'Failed to save notes');
                      } finally {
                        setSavingNotes(false);
                      }
                    }}
                    disabled={savingNotes}
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Check className="h-4 w-4" />
                    {savingNotes ? 'Saving...' : 'Save'}
                  </button>
                  {notesText.trim() && (
                    <>
                      <button
                        onClick={handleSuggestPersona}
                        disabled={suggestingPersona || savingNotes}
                        className="flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Suggest persona slug from these notes"
                      >
                        {suggestingPersona ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Wand2 className="h-4 w-4" />
                            Build Persona Slug
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleGenerateRelationshipContext}
                        disabled={generatingRelationshipContext || savingNotes}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Generate relationship context from these notes"
                      >
                        {generatingRelationshipContext ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            Generate Context
                          </>
                        )}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setEditingNotes(false);
                      setNotesText(contact.notes || '');
                    }}
                    disabled={savingNotes}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    <XIcon className="h-4 w-4" />
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Relationship Context Section (hydrated from Notes buttons above) */}
          <section className="rounded-2xl bg-white p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Relationship Context</h3>
            </div>
            {relationshipContext ? (
              <div className="space-y-3">
                <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 space-y-2.5 text-sm">
                  {/* Three core signals — clean and readable */}
                  {relationshipContext.contextOfRelationship && (
                    <div className="flex items-start gap-2">
                      <span className="w-36 flex-shrink-0 text-xs font-semibold text-gray-500 uppercase tracking-wide pt-0.5">How you know them</span>
                      <span className="text-gray-800 font-medium">{relationshipContext.contextOfRelationship.replace(/_/g, ' ')}</span>
                    </div>
                  )}
                  {relationshipContext.relationshipRecency && (
                    <div className="flex items-start gap-2">
                      <span className="w-36 flex-shrink-0 text-xs font-semibold text-gray-500 uppercase tracking-wide pt-0.5">How recent</span>
                      <span className="text-gray-800 font-medium">{relationshipContext.relationshipRecency.replace(/_/g, ' ')}</span>
                    </div>
                  )}
                  {relationshipContext.companyAwareness && (
                    <div className="flex items-start gap-2">
                      <span className="w-36 flex-shrink-0 text-xs font-semibold text-gray-500 uppercase tracking-wide pt-0.5">Business awareness</span>
                      <span className="text-gray-800 font-medium">{relationshipContext.companyAwareness.replace(/_/g, ' ')}</span>
                    </div>
                  )}
                  {/* Former company — only shown when present, as supporting context */}
                  {relationshipContext.formerCompany && (
                    <div className="flex items-start gap-2 pt-1 border-t border-blue-100 mt-1">
                      <span className="w-36 flex-shrink-0 text-xs font-semibold text-gray-500 uppercase tracking-wide pt-0.5">Former company</span>
                      <span className="text-gray-600">{relationshipContext.formerCompany}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setSavingRelationshipContext(true);
                      try {
                        const response = await api.put(`/api/contacts/${contactId}`, {
                          relationshipContext: relationshipContext, // Send as object, API will handle JSON
                        });
                        if (response.data?.success) {
                          setContact(response.data.contact);
                          if (refreshContacts) {
                            refreshContacts();
                          }
                          // Show success feedback
                          alert('Relationship context saved successfully');
                        } else {
                          alert(response.data?.error || 'Failed to save relationship context');
                        }
                      } catch (error) {
                        console.error('Error saving relationship context:', error);
                        alert(error.response?.data?.error || 'Failed to save relationship context');
                      } finally {
                        setSavingRelationshipContext(false);
                      }
                    }}
                    disabled={savingRelationshipContext}
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Save relationship context"
                  >
                    {savingRelationshipContext ? (
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
                    onClick={handleGenerateRelationshipContext}
                    disabled={generatingRelationshipContext}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Regenerate relationship context"
                  >
                    {generatingRelationshipContext ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Regenerate
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setRelationshipContext(null)}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    title="Clear relationship context"
                  >
                    <XIcon className="h-4 w-4" />
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-400 italic mb-3">
                  {contact?.notes
                    ? 'Use "Generate Context" on the Notes section above to extract relationship details here.'
                    : 'Add notes above, then use Generate Persona and Generate Context to fill this section.'}
                </p>
              </div>
            )}
          </section>

          {/* Email History Section */}
          <section className="rounded-2xl bg-white p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Email History</h3>
              <div className="flex items-center gap-2">
                {emailHistory.some(e => !e.summary) && (
                  <button
                    onClick={async () => {
                      try {
                        const res = await api.post(`/api/contacts/${contactId}/generate-email-summaries`);
                        if (res.data?.success) {
                          loadEmailHistory();
                          if (res.data.generated > 0) {
                            setContact(c => ({ ...c, contactSummary: null, engagementSummary: null }));
                          }
                        }
                      } catch (err) {
                        console.error('Failed to generate summaries:', err);
                      }
                    }}
                    className="flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
                    title="Generate AI summaries for emails missing them — needed for Contact Summary generation"
                  >
                    <Sparkles className="h-4 w-4" />
                    Summarize Emails
                  </button>
                )}
                <button
                  onClick={() => {
                    const url = companyHQId 
                      ? `/outreach/record-off-platform?contactId=${contactId}&companyHQId=${companyHQId}`
                      : `/outreach/record-off-platform?contactId=${contactId}`;
                    router.push(url);
                  }}
                  className="flex items-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Email Manually
                </button>
              </div>
            </div>
            {loadingLastEmail ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading email history...
              </div>
            ) : emailHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Summary</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {emailHistory.map((email, idx) => {
                      const isDraft = email.isDraft || email.type === 'draft';
                      const canAddResponse = !isDraft && !email.hasResponded;
                      return (
                        <tr key={email.id || idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {isDraft ? (
                              <span className="rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                Draft
                              </span>
                            ) : (
                              formatDateEST(email.date.slice(0, 10), { month: 'short', day: 'numeric', year: 'numeric' })
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <div className="font-medium">{email.subject || 'No subject'}</div>
                            {email.notes && (
                              <div className="mt-0.5 text-xs text-gray-500 line-clamp-1">{email.notes}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex flex-col gap-0.5">
                              <span className="capitalize">
                                {isDraft ? (email.platform === 'ai-draft' ? 'AI Generated' : 'Draft') : email.type === 'platform' ? 'Platform' : 'Off-Platform'}
                              </span>
                              {!isDraft && email.platform && email.platform !== 'ai-draft' && (
                                <span className="text-xs text-gray-400">{formatDeliveryMethodLabel(email.platform)}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-md">
                            {email.summary ? (
                              <div className="text-xs italic">{email.summary}</div>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {email.hasResponded ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Replied
                              </span>
                            ) : !isDraft ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                No response
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <div className="flex items-center gap-1">
                              {isDraft ? (
                                <button
                                  onClick={() => router.push(`/contacts/${contactId}/outreach-message?companyHQId=${companyHQId}`)}
                                  className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline"
                                >
                                  Edit &amp; Send
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleOpenEditEmail(email)}
                                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                    title="Edit this email record"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  {canAddResponse && (
                                    <button
                                      onClick={() => handleOpenAddResponse(email)}
                                      className="rounded p-1 text-green-600 hover:bg-green-50"
                                      title="Record contact response"
                                    >
                                      <MessageSquare className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  {(email.notes || email.subject) && (
                                    <button
                                      onClick={() => {
                                        setMakeTemplateEmail(email);
                                        setNewTemplateTitle(`${contact?.outreachPersonaSlug || 'Untitled'} – ${email.subject || 'template'}`);
                                        setNewTemplateSubject(email.subject || '');
                                        setNewTemplateBody(email.notes || '');
                                        setShowSaveTemplateForm(false);
                                        setSaveTemplateError('');
                                        setSaveTemplateSuccess(false);
                                      }}
                                      className="rounded p-1 text-purple-600 hover:bg-purple-50"
                                      title="Save as template"
                                    >
                                      <BookmarkPlus className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                <p className="mb-2 text-sm text-gray-600">No emails sent yet.</p>
                <p className="text-sm text-gray-500">
                  Click &quot;Build Outreach Email&quot; to send your first email, or &quot;Add Email Manually&quot; to record an off-platform email.
                </p>
              </div>
            )}
          </section>

          {/* Contact Outlook Section - Only show if contact has FULL intelligence enrichment */}
          {/* Only show if we have actual intelligence data (scores, summaries), not just basic enrichment */}
          {isEnriched && (
            <ContactOutlook 
              contact={contact} 
              onViewRawJSON={(json) => {
                setRawJSON(json);
                setShowRawJSON(true);
              }}
            />
          )}

          {/* Client Portal Access - Removed from contact detail page */}
          {/* This is a special UX that should be handled in a dedicated client portal management area */}
        </div>


        {/* Raw JSON Modal */}
        {showRawJSON && rawJSON && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <h2 className="text-xl font-bold text-gray-900">Raw Enrichment JSON</h2>
                <button
                  onClick={() => {
                    setShowRawJSON(false);
                    setRawJSON(null);
                  }}
                  className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6">
                <pre className="text-xs bg-gray-50 p-4 rounded-lg overflow-x-auto">
                  {JSON.stringify(rawJSON, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Enrichment Success Modal */}
        {showEnrichSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-xl">
              <div className="p-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="rounded-full p-3 bg-green-100">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
                  Contact Enriched Successfully!
                </h2>
                <p className="text-gray-600 text-center mb-6">
                  All intelligence scores and profile data have been saved. What would you like to do next?
                </p>
                
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setShowEnrichSuccessModal(false);
                      const companyHQId = typeof window !== 'undefined' ? localStorage.getItem('companyHQId') || localStorage.getItem('companyId') : '';
                      router.push(`/personas/build-from-contact?companyHQId=${companyHQId}&contactId=${contactId}`);
                    }}
                    className="w-full flex items-center justify-between rounded-lg border-2 border-purple-600 bg-purple-50 px-6 py-4 text-left transition hover:bg-purple-100"
                  >
                    <div className="flex items-center gap-3">
                      <UserCircle className="h-5 w-5 text-purple-600" />
                      <div>
                        <div className="font-semibold text-gray-900">Build Persona</div>
                        <div className="text-sm text-gray-600">Create a persona from this enriched contact (persona builder)</div>
                      </div>
                    </div>
                    <ArrowLeft className="h-5 w-5 text-purple-600 rotate-180" />
                  </button>

                  <button
                    onClick={() => {
                      setShowEnrichSuccessModal(false);
                      // Refresh to show updated contact
                      window.location.reload();
                    }}
                    className="w-full flex items-center justify-between rounded-lg border-2 border-blue-600 bg-blue-50 px-6 py-4 text-left transition hover:bg-blue-100"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-blue-600" />
                      <div>
                        <div className="font-semibold text-gray-900">View Contact</div>
                        <div className="text-sm text-gray-600">See full contact details and intelligence</div>
                      </div>
                    </div>
                    <ArrowLeft className="h-5 w-5 text-blue-600 rotate-180" />
                  </button>

                  <button
                    onClick={() => {
                      setShowEnrichSuccessModal(false);
                      router.push(`/outreach/compose?contactId=${contactId}`);
                    }}
                    className="w-full flex items-center justify-between rounded-lg border-2 border-red-600 bg-red-50 px-6 py-4 text-left transition hover:bg-red-100"
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-red-600" />
                      <div>
                        <div className="font-semibold text-gray-900">Send an Email</div>
                        <div className="text-sm text-gray-600">Compose and send a personalized email</div>
                      </div>
                    </div>
                    <ArrowLeft className="h-5 w-5 text-red-600 rotate-180" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add to List Modal */}
        {showAddToListModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Add to List</h2>
                <button
                  onClick={() => setShowAddToListModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {loadingLists ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500">Loading lists...</span>
                  </div>
                ) : lists && lists.length > 0 ? (
                  lists.map((list) => (
                    <button
                      key={list.id}
                      onClick={async () => {
                        try {
                          await api.post(`/api/contact-lists/${list.id}/contacts`, {
                            contactId: contactId,
                          });
                          setShowAddToListModal(false);
                          alert(`Contact added to ${list.name}`);
                        } catch (error) {
                          console.error('Error adding contact to list:', error);
                          alert(error.response?.data?.error || 'Failed to add contact to list');
                        }
                      }}
                      className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
                    >
                      <div className="font-medium text-gray-900">{list.name}</div>
                      {list.description && (
                        <div className="text-sm text-gray-500">{list.description}</div>
                      )}
                    </button>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No lists available. Create a list first.</p>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => router.push('/contacts/list-builder')}
                  className="flex-1 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
                >
                  Create New List
                </button>
                <button
                  onClick={() => setShowAddToListModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Enrichment Details Modal */}
        {showEnrichmentDetails && contact?.enrichmentPayload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 p-6 max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Enrichment Details</h2>
                <button
                  onClick={() => setShowEnrichmentDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                  {JSON.stringify(contact.enrichmentPayload, null, 2)}
                </pre>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowEnrichmentDetails(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Response Modal */}
        {showAddResponseModal && addResponseEmail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Add Response</h2>
                <button
                  onClick={() => {
                    setShowAddResponseModal(false);
                    setAddResponseEmail(null);
                    setAddResponseError('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Record a response from the contact for: <strong>{addResponseEmail.subject || 'No subject'}</strong>
              </p>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">
                    Response text <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={addResponseContactResponse}
                    onChange={(e) => setAddResponseContactResponse(e.target.value)}
                    placeholder="Paste or type the contact's reply..."
                    className="w-full min-h-[120px] rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 resize-y"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">
                    Disposition
                  </label>
                  <select
                    value={addResponseDisposition}
                    onChange={(e) => setAddResponseDisposition(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="positive">Positive</option>
                    <option value="not_decision_maker">Not decision maker</option>
                    <option value="forwarding">Forwarding to someone</option>
                    <option value="not_interested">Not interested</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Affects pipeline: positive → interest; not interested → do not contact again
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">
                    Response date
                  </label>
                  <input
                    type="date"
                    value={addResponseRespondedAt}
                    onChange={(e) => setAddResponseRespondedAt(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {addResponseError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    {addResponseError}
                  </div>
                )}
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleSaveAddResponse}
                  disabled={savingAddResponse || !addResponseContactResponse.trim()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingAddResponse ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Save Response
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowAddResponseModal(false);
                    setAddResponseEmail(null);
                    setAddResponseError('');
                  }}
                  disabled={savingAddResponse}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Make Template Modal */}
        {makeTemplateEmail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Save as Persona Template</h2>
                  {contact?.outreachPersonaSlug ? (
                    <p className="text-xs text-purple-600 mt-0.5 font-semibold">{contact.outreachPersonaSlug}</p>
                  ) : (
                    <p className="text-xs text-amber-600 mt-0.5">No persona assigned — template will save without a persona tag</p>
                  )}
                </div>
                <button onClick={() => setMakeTemplateEmail(null)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
                  <XIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-700">
                Replace contact-specific names with <code className="font-mono bg-indigo-100 px-1 rounded">{'{{first_name}}'}</code> and <code className="font-mono bg-indigo-100 px-1 rounded">{'{{company_name}}'}</code> before saving so this template works for any future contact with this persona.
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Title</label>
                  <input
                    type="text"
                    value={newTemplateTitle}
                    onChange={(e) => setNewTemplateTitle(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Subject</label>
                  <input
                    type="text"
                    value={newTemplateSubject}
                    onChange={(e) => setNewTemplateSubject(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Body</label>
                  <textarea
                    value={newTemplateBody}
                    onChange={(e) => setNewTemplateBody(e.target.value)}
                    rows={10}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none font-sans focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                  />
                </div>
              </div>

              {saveTemplateError && <p className="text-xs text-red-600">{saveTemplateError}</p>}
              {saveTemplateSuccess && (
                <p className="flex items-center gap-1.5 text-sm text-green-700 font-medium">
                  <Check className="h-4 w-4" /> Saved to persona template library.
                </p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={async () => {
                    await handleSavePersonaTemplate();
                    if (!saveTemplateError) setMakeTemplateEmail(null);
                  }}
                  disabled={savingNewTemplate}
                  className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {savingNewTemplate ? 'Saving…' : 'Save template'}
                </button>
                <button
                  onClick={() => { setMakeTemplateEmail(null); setSaveTemplateError(''); }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Email Modal */}
        {showEditEmailModal && editEmail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Edit Email Record</h2>
                <button
                  onClick={() => {
                    setShowEditEmailModal(false);
                    setEditEmail(null);
                    setEditEmailError('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">Subject</label>
                  <input
                    type="text"
                    value={editEmailSubject}
                    onChange={(e) => setEditEmailSubject(e.target.value)}
                    placeholder="No subject"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">Message</label>
                  <textarea
                    value={editEmailBody}
                    onChange={(e) => setEditEmailBody(e.target.value)}
                    placeholder="Email or message body..."
                    rows={6}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 resize-y"
                  />
                </div>
                {editEmail.type === 'off-platform' && (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-gray-700">Date Sent</label>
                      <input
                        type="date"
                        value={editEmailSentAt}
                        onChange={(e) => setEditEmailSentAt(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-gray-700">Delivery Method</label>
                      <select
                        value={DELIVERY_METHODS.includes(editEmailPlatform) ? editEmailPlatform : 'email'}
                        onChange={(e) => setEditEmailPlatform(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="email">Email</option>
                        <option value="linkedin">LinkedIn</option>
                        <option value="in-person">In Person</option>
                      </select>
                    </div>
                  </>
                )}
                {editEmailError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    {editEmailError}
                  </div>
                )}
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleSaveEditEmail}
                  disabled={savingEditEmail}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingEditEmail ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowEditEmailModal(false);
                    setEditEmail(null);
                    setEditEmailError('');
                  }}
                  disabled={savingEditEmail}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Persona Suggestion Modal */}
        {showPersonaSuggestionModal && personaSuggestion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Persona Suggestion</h2>
                <button
                  onClick={() => {
                    setShowPersonaSuggestionModal(false);
                    setPersonaSuggestion(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {personaSuggestion.suggestedPersonaSlug ? (
                <div className="space-y-4">
                  {/* Relationship Context - Source of Truth */}
                  {personaSuggestion.relationshipContext && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">
                        Relationship Context <span className="text-xs font-normal text-gray-500">(Source of Truth)</span>
                      </h3>
                      <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 space-y-2 text-sm">
                        {/* Factual extracted data */}
                        {personaSuggestion.relationshipContext.contextOfRelationship && (
                          <div className="flex items-start gap-2">
                            <span className="w-32 flex-shrink-0 text-xs font-semibold text-gray-500 uppercase tracking-wide pt-0.5">How you know them</span>
                            <span className="text-gray-800 font-medium text-sm">{personaSuggestion.relationshipContext.contextOfRelationship.replace(/_/g, ' ')}</span>
                          </div>
                        )}
                        {personaSuggestion.relationshipContext.relationshipRecency && (
                          <div className="flex items-start gap-2">
                            <span className="w-32 flex-shrink-0 text-xs font-semibold text-gray-500 uppercase tracking-wide pt-0.5">How recent</span>
                            <span className="text-gray-800 font-medium text-sm">{personaSuggestion.relationshipContext.relationshipRecency.replace(/_/g, ' ')}</span>
                          </div>
                        )}
                        {personaSuggestion.relationshipContext.companyAwareness && (
                          <div className="flex items-start gap-2">
                            <span className="w-32 flex-shrink-0 text-xs font-semibold text-gray-500 uppercase tracking-wide pt-0.5">Business awareness</span>
                            <span className="text-gray-800 font-medium text-sm">{personaSuggestion.relationshipContext.companyAwareness.replace(/_/g, ' ')}</span>
                          </div>
                        )}
                        {personaSuggestion.relationshipContext.formerCompany && (
                          <div className="flex items-start gap-2 pt-1 border-t border-gray-200 mt-1">
                            <span className="w-32 flex-shrink-0 text-xs font-semibold text-gray-500 uppercase tracking-wide pt-0.5">Former company</span>
                            <span className="text-gray-600 text-sm">{personaSuggestion.relationshipContext.formerCompany}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Persona - Fills Gaps */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Suggested Persona <span className="text-xs font-normal text-gray-500">(Fills Gaps, Drives Templates)</span>
                    </h3>
                    <div className="rounded-lg bg-purple-50 border border-purple-200 p-3">
                      <div className="font-semibold text-purple-900">{personaSuggestion.suggestedPersonaSlug}</div>
                      {personaSuggestion.confidence !== undefined && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span>Confidence</span>
                            <span>{personaSuggestion.confidence}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-purple-600 h-2 rounded-full transition-all"
                              style={{ width: `${personaSuggestion.confidence}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {personaSuggestion.reasoning && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Reasoning</h3>
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                        {personaSuggestion.reasoning}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4 border-t">
                    <button
                      onClick={handleApplySuggestedPersona}
                      disabled={savingPersona}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingPersona ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Applying...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          Apply Persona
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowPersonaSuggestionModal(false);
                        setPersonaSuggestion(null);
                      }}
                      disabled={savingPersona}
                      className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600">Unable to suggest a persona from the notes.</p>
                  <button
                    onClick={() => {
                      setShowPersonaSuggestionModal(false);
                      setPersonaSuggestion(null);
                    }}
                    className="mt-4 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
