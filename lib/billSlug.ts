/**
 * Bill slug generator for dynamic URLs: bill/{companySlug}/{billPart}.
 * Slug stored on bills_to_companies = companySlug/billPart (unique per row).
 * URL changes per company; junction table = per (bill, company) send.
 */

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate slug and path parts for a bill send.
 * Format: {companySlug}/{billSlug}-{shortId}
 * e.g. acme-corp/advisory-onboarding-abc12345 → URL bill/acme-corp/advisory-onboarding-abc12345
 */
export function generateBillSlug(
  companyName: string,
  billName: string,
  serialCode: string
): { slug: string; companySlug: string; part: string } {
  const companySlug = slugify(companyName || 'company') || 'company';
  const billSlug = slugify(billName || 'bill') || 'bill';
  const shortId = serialCode.replace(/[^a-z0-9]/gi, '').slice(-8) || 'inv';
  const part = `${billSlug}-${shortId}`;
  const slug = `${companySlug}/${part}`;
  return { slug, companySlug, part };
}
