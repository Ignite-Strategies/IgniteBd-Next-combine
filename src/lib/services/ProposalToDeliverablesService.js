/**
 * PROPOSAL TO DELIVERABLES SERVICE
 * Converts approved proposals into ConsultantDeliverable records
 * 
 * Trigger: When proposal status changes to "approved"
 * Action: Extract deliverables from proposal phases/milestones and create ConsultantDeliverable records
 */

import { prisma } from '../prisma.js';

/**
 * Convert approved proposal to deliverables
 * @param {string} proposalId - Proposal ID
 * @returns {Promise<Object>} - Result with created deliverables
 */
export async function convertProposalToDeliverables(proposalId) {
  try {
    // Fetch proposal with related data
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        company: {
          include: {
            contacts: {
              take: 1, // Primary contact (client)
            },
          },
        },
      },
    });

    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== 'approved') {
      throw new Error(
        `Proposal ${proposalId} is not approved (status: ${proposal.status}). Only approved proposals can be converted to deliverables.`,
      );
    }

    // Get primary contact (client)
    const primaryContact = proposal.company?.contacts?.[0];
    if (!primaryContact) {
      throw new Error(
        `No contact found for proposal ${proposalId}. Proposal must be linked to a Company with at least one Contact.`,
      );
    }

    const contactId = primaryContact.id;

    // Check if deliverables already exist for this proposal
    const existingDeliverables = await prisma.consultantDeliverable.findMany({
      where: { proposalId },
    });

    if (existingDeliverables.length > 0) {
      console.log(
        `⚠️ Deliverables already exist for proposal ${proposalId}. Skipping conversion.`,
      );
      return {
        converted: false,
        reason: 'deliverables_already_exist',
        existingCount: existingDeliverables.length,
        deliverables: existingDeliverables,
      };
    }

    // Extract deliverables from proposal structure
    const deliverables = extractDeliverablesFromProposal(proposal);

    if (deliverables.length === 0) {
      console.log(
        `⚠️ No deliverables found in proposal ${proposalId}. Proposal may not have phases or milestones defined.`,
      );
      return {
        converted: false,
        reason: 'no_deliverables_found',
        deliverables: [],
      };
    }

    // Create deliverables
    const createdDeliverables = await Promise.all(
      deliverables.map((deliverable) =>
        prisma.consultantDeliverable.create({
          data: {
            contactId,
            proposalId,
            title: deliverable.title,
            description: deliverable.description,
            category: deliverable.category,
            milestoneId: deliverable.milestoneId,
            dueDate: deliverable.dueDate,
            status: 'pending',
          },
        }),
      ),
    );

    console.log(
      `✅ Converted proposal ${proposalId} to ${createdDeliverables.length} deliverables for contact ${contactId}`,
    );

    return {
      converted: true,
      proposalId,
      contactId,
      deliverablesCreated: createdDeliverables.length,
      deliverables: createdDeliverables,
    };
  } catch (error) {
    console.error('❌ ProposalToDeliverables conversion error:', error);
    throw error;
  }
}

/**
 * Extract deliverables from proposal structure
 * Looks at phases.deliverables and milestones to create deliverable records
 * @param {Object} proposal - Proposal object with phases and milestones
 * @returns {Array} - Array of deliverable objects ready to create
 */
function extractDeliverablesFromProposal(proposal) {
  const deliverables = [];

  // Extract from phases (if phases have deliverables array)
  if (proposal.phases && Array.isArray(proposal.phases)) {
    proposal.phases.forEach((phase, phaseIndex) => {
      const phaseId = phase.id || phaseIndex + 1;
      const category = phase.category || phase.name?.toLowerCase() || 'general';

      // If phase has deliverables array
      if (phase.deliverables && Array.isArray(phase.deliverables)) {
        phase.deliverables.forEach((deliverable, delIndex) => {
          deliverables.push({
            title:
              typeof deliverable === 'string'
                ? deliverable
                : deliverable.title || `Deliverable ${delIndex + 1}`,
            description:
              typeof deliverable === 'string'
                ? null
                : deliverable.description || null,
            category,
            milestoneId: `phase-${phaseId}-deliverable-${delIndex + 1}`,
            dueDate: calculateDueDateFromPhase(phase, proposal.milestones),
          });
        });
      }
    });
  }

  // Extract from milestones (if milestones have deliverables)
  if (proposal.milestones && Array.isArray(proposal.milestones)) {
    proposal.milestones.forEach((milestone, index) => {
      const milestoneId = milestone.id || `milestone-${index + 1}`;
      const week = milestone.week || index + 1;

      // If milestone has deliverable field
      if (milestone.deliverable) {
        deliverables.push({
          title:
            typeof milestone.deliverable === 'string'
              ? milestone.deliverable
              : milestone.milestone || `Milestone ${week}`,
          description:
            typeof milestone.deliverable === 'string'
              ? null
              : milestone.description || null,
          category: milestone.phaseColor || milestone.phase?.toLowerCase() || 'general',
          milestoneId: `week-${week}`,
          dueDate: calculateDueDateFromMilestone(milestone, proposal.dateIssued),
        });
      } else if (milestone.milestone) {
        // Use milestone title as deliverable
        deliverables.push({
          title: milestone.milestone,
          description: milestone.deliverable || null,
          category: milestone.phaseColor || milestone.phase?.toLowerCase() || 'general',
          milestoneId: `week-${week}`,
          dueDate: calculateDueDateFromMilestone(milestone, proposal.dateIssued),
        });
      }
    });
  }

  // If no deliverables found in phases or milestones, create from serviceInstances
  if (deliverables.length === 0 && proposal.serviceInstances) {
    if (Array.isArray(proposal.serviceInstances)) {
      proposal.serviceInstances.forEach((service, index) => {
        deliverables.push({
          title: service.name || service.title || `Service ${index + 1}`,
          description: service.description || null,
          category: service.category || 'general',
          milestoneId: `service-${index + 1}`,
          dueDate: null, // No due date if not in milestones
        });
      });
    }
  }

  return deliverables;
}

/**
 * Calculate due date from phase information
 * @param {Object} phase - Phase object
 * @param {Array} milestones - Milestones array
 * @returns {Date|null} - Due date or null
 */
function calculateDueDateFromPhase(phase, milestones) {
  if (!milestones || !Array.isArray(milestones)) {
    return null;
  }

  // Try to find milestone in this phase
  const phaseMilestone = milestones.find(
    (m) => m.phaseId === phase.id || m.phase === phase.name,
  );

  if (phaseMilestone && phaseMilestone.week) {
    return calculateDueDateFromWeek(phaseMilestone.week);
  }

  return null;
}

/**
 * Calculate due date from milestone
 * @param {Object} milestone - Milestone object
 * @param {Date|string} dateIssued - Proposal issue date
 * @returns {Date|null} - Due date or null
 */
function calculateDueDateFromMilestone(milestone, dateIssued) {
  if (milestone.week) {
    return calculateDueDateFromWeek(milestone.week, dateIssued);
  }

  if (milestone.targetDate) {
    return new Date(milestone.targetDate);
  }

  return null;
}

/**
 * Calculate due date from week number
 * @param {number} week - Week number (1-based)
 * @param {Date|string} startDate - Start date (defaults to now)
 * @returns {Date} - Due date
 */
function calculateDueDateFromWeek(week, startDate = null) {
  const start = startDate ? new Date(startDate) : new Date();
  const dueDate = new Date(start);
  dueDate.setDate(start.getDate() + week * 7); // Add weeks
  return dueDate;
}

