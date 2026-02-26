/**
 * REMINDER SERVICE
 * Finds contacts that are due for follow-up based on:
 * 1. Last send date and cadence rules (automatic)
 * 2. Manual "remind me when" dates (manual reminders)
 */

import { prisma } from '../prisma.js';
import { calculateNextSendDate, getLastSendDate } from './followUpCalculator.js';

/**
 * Get contacts that are due for follow-up
 * Includes both automatic (cadence-based) and manual (remindMeOn) reminders
 * @param {string} companyHQId - Company HQ ID to filter contacts
 * @param {Object} options - Query options
 * @param {number} options.daysOverdue - Only return contacts X days overdue (default: 0, meaning due today or overdue)
 * @param {number} options.limit - Maximum number of contacts to return (default: 100)
 * @param {boolean} options.includeManualReminders - Include manual reminders (default: true)
 * @returns {Promise<Array>} - Array of contacts with follow-up info
 */
export async function getContactsDueForFollowUp(companyHQId, options = {}) {
  const { daysOverdue = 0, limit = 100, includeManualReminders = true } = options;

  // Get all contacts for the company
  const contacts = await prisma.contact.findMany({
    where: {
      crmId: companyHQId, // crmId is the FK to company_hqs
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      prior_relationship: true,
      persona_type: true,
      remindMeOn: true, // Include manual reminder date
    },
    take: limit * 3, // Get more than needed, we'll filter
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate follow-up status for each contact
  const contactsWithFollowUp = await Promise.all(
    contacts.map(async (contact) => {
      try {
        // Check manual reminder first (takes precedence)
        if (includeManualReminders && contact.remindMeOn) {
          const remindDate = new Date(contact.remindMeOn);
          remindDate.setHours(0, 0, 0, 0);
          const daysUntilReminder = Math.ceil((remindDate - today) / (1000 * 60 * 60 * 24));
          const daysOverdueManual = -daysUntilReminder; // Negative if overdue

          if (daysOverdueManual >= daysOverdue) {
            return {
              ...contact,
              reminderType: 'manual',
              remindMeOn: contact.remindMeOn.toISOString(),
              nextSendDate: contact.remindMeOn.toISOString(),
              daysOverdue: daysOverdueManual,
              lastSendDate: null,
              relationship: contact.prior_relationship,
              cadenceDays: null,
            };
          }
        }

        // Otherwise, check automatic cadence-based follow-up
        const followUpInfo = await calculateNextSendDate(contact.id);
        const lastSendDate = await getLastSendDate(contact.id);

        // Only include if has been contacted before and is due
        if (followUpInfo.nextSendDate && followUpInfo.daysUntilDue !== null) {
          const daysOverdueAuto = -followUpInfo.daysUntilDue;
          
          if (daysOverdueAuto >= daysOverdue) {
            return {
              ...contact,
              reminderType: 'automatic',
              lastSendDate: lastSendDate ? lastSendDate.toISOString() : null,
              nextSendDate: followUpInfo.nextSendDate.toISOString(),
              daysOverdue: daysOverdueAuto,
              relationship: followUpInfo.relationship,
              cadenceDays: followUpInfo.cadenceDays,
              remindMeOn: contact.remindMeOn ? contact.remindMeOn.toISOString() : null,
            };
          }
        }

        return null; // Not due
      } catch (error) {
        console.error(`Error calculating follow-up for contact ${contact.id}:`, error);
        return null;
      }
    })
  );

  // Filter out nulls
  const dueContacts = contactsWithFollowUp
    .filter(contact => contact !== null)
    .sort((a, b) => {
      // Sort by most overdue first
      if (a.daysOverdue === null) return 1;
      if (b.daysOverdue === null) return -1;
      return b.daysOverdue - a.daysOverdue;
    })
    .slice(0, limit); // Limit results

  return dueContacts;
}

/**
 * Get count of contacts due for follow-up
 * @param {string} companyHQId - Company HQ ID
 * @param {number} daysOverdue - Only count contacts X days overdue
 * @returns {Promise<number>} - Count of contacts due
 */
export async function getContactsDueCount(companyHQId, daysOverdue = 0) {
  const contacts = await getContactsDueForFollowUp(companyHQId, {
    daysOverdue,
    limit: 1000 // Get a large batch to count
  });
  return contacts.length;
}

/**
 * Get reminders for a date range (for dashboard and alert email).
 * Returns contacts whose next send date or remindMeOn falls in [dateFrom, dateTo], sorted by due date then name.
 * @param {string} companyHQId - Company HQ ID
 * @param {Object} options - { dateFrom: Date, dateTo: Date, limit?: number }
 * @returns {Promise<Array<{ dueDate: string, contactId: string, firstName: string, lastName: string, email: string, lastSendDate: string|null, reminderType: 'manual'|'automatic', nextContactNote: string|null, cadenceDays: number|null }>>}
 */
export async function getRemindersForDateRange(companyHQId, options = {}) {
  const { dateFrom, dateTo, limit = 200 } = options;
  if (!dateFrom || !dateTo) return [];

  const start = new Date(dateFrom);
  const end = new Date(dateTo);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  // Contacts that have at least one send or have remindMeOn set
  const contacts = await prisma.contact.findMany({
    where: {
      crmId: companyHQId,
      doNotContactAgain: false,
      OR: [
        { email_activities: { some: { OR: [{ event: 'sent' }, { source: 'OFF_PLATFORM', sentAt: { not: null } }] } } },
        { remindMeOn: { not: null } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      remindMeOn: true,
      nextContactNote: true,
    },
    take: limit * 2,
  });

  const results = [];
  for (const contact of contacts) {
    try {
      let dueDate = null;
      let reminderType = null;
      let lastSendDate = null;
      let cadenceDays = null;

      if (contact.remindMeOn) {
        const d = new Date(contact.remindMeOn);
        d.setHours(0, 0, 0, 0);
        if (d >= start && d <= end) {
          dueDate = d;
          reminderType = 'manual';
        }
      }

      const followUpInfo = await calculateNextSendDate(contact.id);
      const lastSend = await getLastSendDate(contact.id);
      if (lastSend) lastSendDate = lastSend.toISOString();
      if (followUpInfo.cadenceDays != null) cadenceDays = followUpInfo.cadenceDays;

      const nextSend = followUpInfo.nextSendDate ? new Date(followUpInfo.nextSendDate) : null;
      if (nextSend) {
        nextSend.setHours(0, 0, 0, 0);
        if (nextSend >= start && nextSend <= end) {
          if (!dueDate || nextSend < dueDate) {
            dueDate = nextSend;
            reminderType = 'automatic';
          }
        }
      }

      if (dueDate && reminderType) {
        results.push({
          dueDate: dueDate.toISOString().slice(0, 10),
          contactId: contact.id,
          firstName: contact.firstName || '',
          lastName: contact.lastName || '',
          email: contact.email || '',
          lastSendDate,
          reminderType,
          nextContactNote: contact.nextContactNote || null,
          cadenceDays,
        });
      }
    } catch (err) {
      console.error(`Error getting reminder for contact ${contact.id}:`, err);
    }
  }

  results.sort((a, b) => {
    const d = a.dueDate.localeCompare(b.dueDate);
    if (d !== 0) return d;
    const na = `${a.firstName} ${a.lastName}`.trim() || a.email;
    const nb = `${b.firstName} ${b.lastName}`.trim() || b.email;
    return na.localeCompare(nb);
  });

  return results.slice(0, limit);
}
