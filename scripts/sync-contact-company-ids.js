/**
 * Historical: copied contacts.companyId → contactCompanyId.
 *
 * contacts.companyId was dropped (tenant = crmId, employer FK = contactCompanyId).
 * This script is a no-op so it cannot SELECT the removed column.
 *
 * Run with: node scripts/sync-contact-company-ids.js
 */

console.log(
  '⏭️  contacts.companyId no longer exists. Employer FK is contactCompanyId; tenant is crmId. Nothing to sync.',
);
process.exit(0);
