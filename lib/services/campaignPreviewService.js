import { prisma } from '@/lib/prisma';
// Note: This service uses its own personalizeContent() method for simple variable replacement
// For database-backed variable resolution, use variableMapperService instead

/**
 * Campaign Preview Service
 * Provides preview capabilities for email sequences before sending
 */
class CampaignPreviewService {
  /**
   * Preview personalized email content for a sample contact
   * @param {string} campaignId - Campaign ID
   * @param {string} sequenceId - Sequence ID (optional, if not provided, previews all sequences)
   * @param {string} contactId - Contact ID to use for preview (optional, uses first contact if not provided)
   * @returns {Object} Preview data with personalized content
   */
  static async previewEmailContent(campaignId, sequenceId = null, contactId = null) {
    // Get campaign with sequences
    const campaign = await prisma.campaigns.findUnique({
      where: { id: campaignId },
      include: {
        email_sequences: {
          include: {
            sequence_steps: {
              orderBy: { step_number: 'asc' }
            }
          },
          orderBy: { created_at: 'asc' }
        },
        contact_lists: {
          include: {
            contacts: {
              take: 1, // Just need one for preview
              orderBy: { createdAt: 'desc' }
            }
          }
        }
      }
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Get contact for preview
    let contact = null;
    if (contactId) {
      contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          fullName: true,
          goesBy: true,
          email: true,
          title: true,
          companyName: true,
          companyDomain: true,
          updatedAt: true,
          createdAt: true,
        }
      });
    } else if (campaign.contact_lists?.contacts?.length > 0) {
      // Use first contact from list
      const contactId = campaign.contact_lists.contacts[0].id;
      contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          fullName: true,
          goesBy: true,
          email: true,
          title: true,
          companyName: true,
          companyDomain: true,
          updatedAt: true,
          createdAt: true,
        }
      });
    }

    // If no contact available, create a sample contact for preview
    if (!contact) {
      contact = {
        id: 'preview',
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        goesBy: 'John',
        email: 'john.doe@example.com',
        title: 'VP of Sales',
        companyName: 'Example Corp',
        companyDomain: 'example.com',
        updatedAt: new Date(),
        createdAt: new Date(),
      };
    }

    // Filter sequences if sequenceId provided
    const sequencesToPreview = sequenceId
      ? campaign.email_sequences.filter(seq => seq.id === sequenceId)
      : campaign.email_sequences;

    // Preview each sequence
    const previews = sequencesToPreview.map(sequence => {
      const stepPreviews = sequence.sequence_steps.map(step => {
        // Personalize subject and body
        const personalizedSubject = this.personalizeContent(step.subject, contact);
        const personalizedBody = this.personalizeContent(step.body, contact);

        return {
          stepId: step.id,
          stepNumber: step.step_number,
          name: step.name,
          originalSubject: step.subject,
          personalizedSubject,
          originalBody: step.body,
          personalizedBody,
          delayDays: step.delay_days,
          delayHours: step.delay_hours,
        };
      });

      return {
        sequenceId: sequence.id,
        sequenceName: sequence.name,
        steps: stepPreviews,
      };
    });

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
      },
      contactList: campaign.contact_lists ? {
        id: campaign.contact_lists.id,
        name: campaign.contact_lists.name,
        totalContacts: campaign.contact_lists.totalContacts,
      } : null,
      previewContact: {
        id: contact.id,
        name: contact.fullName || `${contact.firstName} ${contact.lastName}`.trim(),
        email: contact.email,
        company: contact.companyName,
      },
      sequences: previews,
    };
  }

  /**
   * Preview sequence timeline - when each email will be sent
   * @param {string} campaignId - Campaign ID
   * @param {Date} startDate - When to start the sequence (defaults to now)
   * @returns {Object} Timeline with send dates for each step
   */
  static async previewTimeline(campaignId, startDate = new Date()) {
    const campaign = await prisma.campaigns.findUnique({
      where: { id: campaignId },
      include: {
        email_sequences: {
          include: {
            sequence_steps: {
              orderBy: { step_number: 'asc' }
            }
          },
          orderBy: { created_at: 'asc' }
        },
        contact_lists: true,
      }
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const timeline = [];
    let currentDate = new Date(startDate);

    // Process each sequence
    for (const sequence of campaign.email_sequences) {
      const sequenceTimeline = {
        sequenceId: sequence.id,
        sequenceName: sequence.name,
        steps: [],
      };

      // Process each step in the sequence
      for (const step of sequence.sequence_steps) {
        // Calculate send date
        const sendDate = new Date(currentDate);
        sendDate.setDate(sendDate.getDate() + step.delay_days);
        sendDate.setHours(sendDate.getHours() + step.delay_hours);

        sequenceTimeline.steps.push({
          stepId: step.id,
          stepNumber: step.step_number,
          name: step.name,
          subject: step.subject,
          delayDays: step.delay_days,
          delayHours: step.delay_hours,
          sendDate: sendDate.toISOString(),
          sendDateFormatted: sendDate.toLocaleString(),
        });

        // Update current date for next step
        currentDate = new Date(sendDate);
      }

      timeline.push(sequenceTimeline);
    }

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
      },
      contactList: campaign.contact_lists ? {
        id: campaign.contact_lists.id,
        name: campaign.contact_lists.name,
        totalContacts: campaign.contact_lists.totalContacts,
      } : null,
      startDate: startDate.toISOString(),
      startDateFormatted: startDate.toLocaleString(),
      timeline,
      totalSteps: timeline.reduce((sum, seq) => sum + seq.steps.length, 0),
      totalDurationDays: timeline.reduce((sum, seq) => {
        return sum + seq.steps.reduce((stepSum, step) => stepSum + step.delayDays, 0);
      }, 0),
    };
  }

  /**
   * Preview contact list - who will receive the emails
   * @param {string} campaignId - Campaign ID
   * @param {number} limit - Number of contacts to preview (default: 10)
   * @returns {Object} Contact list preview
   */
  static async previewContactList(campaignId, limit = 10) {
    const campaign = await prisma.campaigns.findUnique({
      where: { id: campaignId },
      include: {
        contact_lists: {
          include: {
            contacts: {
              take: limit,
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                firstName: true,
                lastName: true,
                fullName: true,
                goesBy: true,
                email: true,
                title: true,
                companyName: true,
                companyDomain: true,
              }
            }
          }
        }
      }
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (!campaign.contact_lists) {
      return {
        campaign: {
          id: campaign.id,
          name: campaign.name,
        },
        contactList: null,
        contacts: [],
        totalContacts: 0,
        message: 'No contact list assigned to this campaign',
      };
    }

    // Get total count
    const totalContacts = await prisma.contact.count({
      where: {
        contactListId: campaign.contact_lists.id,
      }
    });

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
      },
      contactList: {
        id: campaign.contact_lists.id,
        name: campaign.contact_lists.name,
        description: campaign.contact_lists.description,
        type: campaign.contact_lists.type,
        totalContacts,
      },
      contacts: campaign.contact_lists.contacts,
      previewCount: campaign.contact_lists.contacts.length,
      totalContacts,
      hasMore: totalContacts > limit,
    };
  }

  /**
   * Comprehensive preview - combines all preview types
   * @param {string} campaignId - Campaign ID
   * @param {Object} options - Preview options
   * @returns {Object} Complete preview data
   */
  static async previewCampaign(campaignId, options = {}) {
    const {
      contactId = null,
      startDate = new Date(),
      contactLimit = 5,
    } = options;

    const [emailPreview, timeline, contactListPreview] = await Promise.all([
      this.previewEmailContent(campaignId, null, contactId),
      this.previewTimeline(campaignId, startDate),
      this.previewContactList(campaignId, contactLimit),
    ]);

    return {
      campaign: emailPreview.campaign,
      contactList: emailPreview.contactList,
      previewContact: emailPreview.previewContact,
      emailContent: {
        sequences: emailPreview.sequences,
      },
      timeline,
      contactList: contactListPreview,
      summary: {
        totalSequences: emailPreview.sequences.length,
        totalSteps: timeline.totalSteps,
        totalContacts: contactListPreview.totalContacts,
        totalDurationDays: timeline.totalDurationDays,
      },
    };
  }

  /**
   * Personalize content with contact data
   * Simple variable replacement (can be enhanced with template hydration)
   * @param {string} content - Content with {{variable}} placeholders
   * @param {Object} contact - Contact data
   * @returns {string} Personalized content
   */
  static personalizeContent(content, contact) {
    if (!content || !contact) return content;

    const replacements = {
      '{{firstName}}': contact.firstName || contact.goesBy || 'there',
      '{{lastName}}': contact.lastName || '',
      '{{fullName}}': contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'there',
      '{{goesBy}}': contact.goesBy || contact.firstName || 'there',
      '{{email}}': contact.email || '',
      '{{title}}': contact.title || '',
      '{{companyName}}': contact.companyName || 'your company',
      '{{companyDomain}}': contact.companyDomain || '',
    };

    let personalized = content;
    Object.keys(replacements).forEach(key => {
      const regex = new RegExp(key.replace(/[{}]/g, '\\$&'), 'g');
      personalized = personalized.replace(regex, replacements[key]);
    });

    return personalized;
  }

  /**
   * Validate campaign before sending
   * @param {string} campaignId - Campaign ID
   * @returns {Object} Validation result
   */
  static async validateCampaign(campaignId) {
    const campaign = await prisma.campaigns.findUnique({
      where: { id: campaignId },
      include: {
        email_sequences: {
          include: {
            sequence_steps: {
              orderBy: { step_number: 'asc' }
            }
          }
        },
        contact_lists: {
          include: {
            contacts: {
              take: 1,
            }
          }
        }
      }
    });

    if (!campaign) {
      return {
        valid: false,
        errors: ['Campaign not found'],
      };
    }

    const errors = [];
    const warnings = [];

    // Check contact list
    if (!campaign.contact_lists) {
      errors.push('No contact list assigned to campaign');
    } else {
      const totalContacts = await prisma.contact.count({
        where: { contactListId: campaign.contact_lists.id },
      });

      if (totalContacts === 0) {
        errors.push('Contact list is empty');
      } else if (totalContacts < 5) {
        warnings.push(`Only ${totalContacts} contact(s) in list`);
      }
    }

    // Check sequences
    if (campaign.email_sequences.length === 0) {
      errors.push('No email sequences defined');
    } else {
      // Check each sequence has steps
      campaign.email_sequences.forEach((sequence, idx) => {
        if (sequence.sequence_steps.length === 0) {
          errors.push(`Sequence "${sequence.name}" has no steps`);
        }

        // Check step order
        const stepNumbers = sequence.sequence_steps.map(s => s.step_number);
        const expectedOrder = Array.from({ length: stepNumbers.length }, (_, i) => i + 1);
        if (JSON.stringify(stepNumbers.sort()) !== JSON.stringify(expectedOrder)) {
          warnings.push(`Sequence "${sequence.name}" has non-sequential step numbers`);
        }
      });
    }

    // Check email content
    campaign.email_sequences.forEach(sequence => {
      sequence.sequence_steps.forEach(step => {
        if (!step.subject || step.subject.trim() === '') {
          errors.push(`Step ${step.step_number} in sequence "${sequence.name}" has no subject`);
        }
        if (!step.body || step.body.trim() === '') {
          errors.push(`Step ${step.step_number} in sequence "${sequence.name}" has no body`);
        }
      });
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        hasContactList: !!campaign.contact_lists,
        totalSequences: campaign.email_sequences.length,
        totalSteps: campaign.email_sequences.reduce((sum, seq) => sum + seq.sequence_steps.length, 0),
      },
    };
  }
}

export default CampaignPreviewService;

