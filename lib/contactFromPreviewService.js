/**
 * Contact From Preview Service
 * 
 * Maps preview items to Contact model and checks for existing contacts
 */

import { prisma } from './prisma';

/**
 * Map preview item to Contact data structure
 * @param {Object} previewItem - Preview item from Microsoft API
 * @returns {Object} Contact data ready for Prisma create
 */
export function mapPreviewItemToContact(previewItem) {
  const email = previewItem.email.toLowerCase().trim();
  
  // Parse displayName into firstName/lastName (best effort)
  let firstName = null;
  let lastName = null;
  
  if (previewItem.displayName) {
    const nameParts = previewItem.displayName.trim().split(/\s+/);
    if (nameParts.length === 1) {
      firstName = nameParts[0];
    } else if (nameParts.length >= 2) {
      firstName = nameParts[0];
      lastName = nameParts.slice(1).join(' ');
    }
  }

  return {
    email,
    firstName,
    lastName,
    // Note: companyName and jobTitle available from contacts source but not stored in Contact model
  };
}

/**
 * Check which emails already exist in database for given companyHQs
 * @param {string[]} emails - Array of email addresses to check
 * @param {string[]} companyHQIds - Array of companyHQ IDs to check within
 * @returns {Promise<Set<string>>} Set of emails that already exist
 */
export async function checkExistingContacts(emails, companyHQIds) {
  if (!emails || emails.length === 0 || !companyHQIds || companyHQIds.length === 0) {
    return new Set();
  }

  const emailLower = emails.map(e => e.toLowerCase().trim());
  
  const existingContacts = await prisma.contact.findMany({
    where: {
      crmId: { in: companyHQIds },
      email: { in: emailLower },
    },
    select: {
      email: true,
    },
  });

  return new Set(
    existingContacts.map(c => c.email?.toLowerCase().trim()).filter(Boolean)
  );
}

/**
 * Prepare contacts for review - map preview items and check existing
 * @param {Object[]} previewItems - Array of preview items
 * @param {string[]} companyHQIds - Array of companyHQ IDs
 * @returns {Promise<Object[]>} Array of mapped contacts with existing status
 */
export async function prepareContactsForReview(previewItems, companyHQIds) {
  const emails = previewItems.map(item => item.email);
  const existingEmails = await checkExistingContacts(emails, companyHQIds);

  return previewItems.map(item => {
    const contactData = mapPreviewItemToContact(item);
    const alreadyExists = existingEmails.has(contactData.email);

    return {
      previewId: item.previewId,
      ...contactData,
      displayName: item.displayName,
      companyName: item.companyName || null,
      jobTitle: item.jobTitle || null,
      alreadyExists,
      // Keep original preview data for reference
      originalPreview: item,
    };
  });
}
