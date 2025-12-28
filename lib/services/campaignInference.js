/**
 * Campaign Inference Service
 * 
 * Smart routing and state inference for campaigns using the master container pattern.
 * Campaigns are lightweight containers with bolt-ons (template_id, contact_list_id).
 * 
 * Key Principles:
 * - No redundant booleans (saved, published) - infer from status + field presence
 * - template_id is the source of truth when present
 * - Status transitions are inferred from field presence and timestamps
 */

import { prisma } from '@/lib/prisma';

/**
 * Infer campaign state properties
 * @param {Object} campaign - Campaign object from database
 * @returns {Object} Inferred state properties
 */
export function inferCampaignState(campaign) {
  const hasTemplate = !!campaign.template_id;
  const hasContactList = !!campaign.contact_list_id;
  const hasManualContent = !!(campaign.subject && campaign.body);
  const hasScheduledTime = !!campaign.scheduled_for;
  const hasStarted = !!campaign.started_at;
  const hasCompleted = !!campaign.completed_at;

  // Content source: template_id takes precedence
  const hasContent = hasTemplate || hasManualContent;

  // Saved = has minimum required fields
  const isSaved = !!(campaign.name && hasContent);

  // Published = actively running or scheduled
  const isPublished = campaign.status === 'ACTIVE' || campaign.status === 'SCHEDULED';

  // Ready to send = has audience + content
  const isReadyToSend = hasContactList && hasContent;

  // Can be sent now (not scheduled)
  const canSendNow = isReadyToSend && !hasScheduledTime;

  // Content mode: template-driven or manual
  const contentMode = hasTemplate ? 'template' : 'manual';

  return {
    isSaved,
    isPublished,
    isReadyToSend,
    canSendNow,
    hasContent,
    hasTemplate,
    hasContactList,
    hasManualContent,
    hasScheduledTime,
    hasStarted,
    hasCompleted,
    contentMode,
  };
}

/**
 * Infer appropriate status based on campaign state
 * @param {Object} campaign - Campaign object
 * @returns {string} Suggested status
 */
export function inferStatus(campaign) {
  const state = inferCampaignState(campaign);

  // If completed, stay completed
  if (campaign.completed_at) {
    return 'COMPLETED';
  }

  // If cancelled, stay cancelled (unless explicitly changed)
  if (campaign.status === 'CANCELLED') {
    return 'CANCELLED';
  }

  // If has scheduled time in future → SCHEDULED
  if (campaign.scheduled_for && new Date(campaign.scheduled_for) > new Date()) {
    return 'SCHEDULED';
  }

  // If has started_at → ACTIVE
  if (campaign.started_at && !campaign.completed_at) {
    return 'ACTIVE';
  }

  // If paused, stay paused (unless explicitly changed)
  if (campaign.status === 'PAUSED') {
    return 'PAUSED';
  }

  // Default: DRAFT
  return 'DRAFT';
}

/**
 * Get campaign with inferred state
 * @param {string} campaignId - Campaign ID
 * @returns {Object} Campaign with inferred state
 */
export async function getCampaignWithInference(campaignId) {
  const campaign = await prisma.campaigns.findUnique({
    where: { id: campaignId },
    include: {
      template: {
        select: {
          id: true,
          title: true,
          subject: true,
          body: true,
        },
      },
      contact_lists: {
        select: {
          id: true,
          name: true,
          totalContacts: true,
        },
      },
    },
  });

  if (!campaign) {
    return null;
  }

  const state = inferCampaignState(campaign);
  const suggestedStatus = inferStatus(campaign);

  // If template_id exists, use template content as source of truth
  let effectiveSubject = campaign.subject;
  let effectiveBody = campaign.body;
  let effectivePreviewText = campaign.preview_text;

  if (campaign.template_id && campaign.template) {
    // Template is source of truth - use template content
    effectiveSubject = campaign.template.subject || campaign.subject || '';
    effectiveBody = campaign.template.body || campaign.body || '';
    // Preview text stays from campaign (not in template schema)
    effectivePreviewText = campaign.preview_text || '';
  }

  return {
    ...campaign,
    state,
    suggestedStatus,
    // Effective content (template takes precedence)
    effectiveSubject,
    effectiveBody,
    effectivePreviewText,
  };
}

/**
 * Validate campaign readiness for sending
 * @param {string} campaignId - Campaign ID
 * @returns {Object} Validation result
 */
export async function validateCampaignReadiness(campaignId) {
  const campaign = await getCampaignWithInference(campaignId);

  if (!campaign) {
    return {
      valid: false,
      errors: ['Campaign not found'],
    };
  }

  const errors = [];
  const warnings = [];

  // Must have name
  if (!campaign.name || campaign.name.trim() === '') {
    errors.push('Campaign name is required');
  }

  // Must have contact list
  if (!campaign.contact_list_id) {
    errors.push('Contact list is required');
  } else if (campaign.contact_lists) {
    const contactCount = campaign.contact_lists.totalContacts || 0;
    if (contactCount === 0) {
      errors.push('Contact list is empty');
    } else if (contactCount < 5) {
      warnings.push(`Only ${contactCount} contact(s) in list`);
    }
  }

  // Must have content (template OR manual)
  if (!campaign.template_id && !(campaign.subject && campaign.body)) {
    errors.push('Email content is required (select a template or enter manual content)');
  }

  // If template exists, verify it's valid
  if (campaign.template_id && !campaign.template) {
    errors.push('Selected template not found');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    campaign: campaign.state,
  };
}

/**
 * Get effective email content for a campaign
 * Uses template if present, otherwise manual content
 * @param {Object} campaign - Campaign object
 * @returns {Object} Effective email content
 */
export function getEffectiveEmailContent(campaign) {
  if (campaign.template_id && campaign.template) {
    return {
      subject: campaign.template.subject || campaign.subject || '',
      body: campaign.template.body || campaign.body || '',
      preview_text: campaign.preview_text || '',
      source: 'template',
      template_id: campaign.template_id,
    };
  }

  return {
    subject: campaign.subject || '',
    body: campaign.body || '',
    preview_text: campaign.preview_text || '',
    source: 'manual',
    template_id: null,
  };
}

