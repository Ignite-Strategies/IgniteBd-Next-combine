/**
 * PersonaPromptPrepService
 * 
 * Prepares data needed for persona generation:
 * - Fetches contact from DB
 * - Fetches companyHQ from DB
 * - Returns structured data for prompt building
 */

export interface PreparedData {
  contact: {
    firstName?: string;
    lastName?: string;
    title?: string;
    companyName?: string;
    companyIndustry?: string;
  } | null;
  companyHQ: {
    companyName: string;
    companyIndustry?: string;
    whatYouDo?: string;
  };
}

export class PersonaPromptPrepService {
  /**
   * Prepare data for persona generation
   */
  static async prepare(params: {
    contactId: string;
    companyHQId: string;
  }): Promise<{
    success: boolean;
    data?: PreparedData;
    error?: string;
  }> {
    try {
      const { contactId, companyHQId } = params;

      // Dynamic import to ensure Prisma is initialized
      const { prisma } = await import('@/lib/prisma');
      
      if (!prisma) {
        console.error('❌ Prisma is undefined after import');
        return { success: false, error: 'Database connection not available' };
      }

      console.log('📊 PersonaPromptPrepService: Fetching contact and companyHQ...');
      // Fetch contact and companyHQ in parallel
      const [contact, companyHQ] = await Promise.all([
        prisma.contact.findUnique({
          where: { id: contactId },
          select: {
            firstName: true,
            lastName: true,
            title: true,
            companyName: true,
            companyIndustry: true,
          },
        }),
        prisma.companyHQ.findUnique({
          where: { id: companyHQId },
          select: {
            companyName: true,
            companyIndustry: true,
            whatYouDo: true,
          },
        }),
      ]);

      if (!companyHQ) {
        console.error('❌ CompanyHQ not found:', companyHQId);
        return { success: false, error: 'Company not found' };
      }

      console.log('✅ PersonaPromptPrepService: Data prepared successfully');
      console.log('  - Contact:', contact ? `${contact.firstName} ${contact.lastName}` : 'null');
      console.log('  - CompanyHQ:', companyHQ.companyName);

      return {
        success: true,
        data: {
          contact,
          companyHQ,
        },
      };
    } catch (error: any) {
      console.error('❌ PersonaPromptPrepService error:', error);
      return {
        success: false,
        error: error.message || 'Failed to prepare persona data',
      };
    }
  }
}

