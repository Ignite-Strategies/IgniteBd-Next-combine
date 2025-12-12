/**
 * Company Service
 * 
 * Handles universal company record management
 * Companies are matched by domain - all contacts with same domain point to same Company
 */

import { prisma } from '@/lib/prisma';

/**
 * Find or create Company by domain
 * 
 * Universal company records - all contacts with same domain point to same Company
 * 
 * @param domain - Company domain (e.g., "example.com")
 * @param companyHQId - Tenant identifier
 * @param companyName - Optional company name (used if creating new)
 * @returns Company record
 */
export async function findOrCreateCompanyByDomain(
  domain: string,
  companyHQId: string,
  companyName?: string
): Promise<any> {
  if (!domain) {
    return null;
  }

  // Normalize domain
  const normalizedDomain = domain.toLowerCase().trim().replace(/^www\./, '');

  // Try to find existing company by domain
  const existingCompany = await prisma.company.findFirst({
    where: {
      domain: normalizedDomain,
      companyHQId, // Same tenant
    },
  });

  if (existingCompany) {
    return existingCompany;
  }

  // Create new company
  const newCompany = await prisma.company.create({
    data: {
      companyHQId,
      companyName: companyName || 'Unknown Company',
      domain: normalizedDomain,
    },
  });

  console.log(`✅ Created universal company record: ${newCompany.companyName} (${normalizedDomain})`);
  return newCompany;
}

/**
 * Find Company by domain (does not create)
 */
export async function findCompanyByDomain(
  domain: string,
  companyHQId: string
): Promise<any | null> {
  if (!domain) {
    return null;
  }

  const normalizedDomain = domain.toLowerCase().trim().replace(/^www\./, '');

  return await prisma.company.findFirst({
    where: {
      domain: normalizedDomain,
      companyHQId,
    },
  });
}

