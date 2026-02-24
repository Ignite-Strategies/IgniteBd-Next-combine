/**
 * OutreachEmailBuilderService
 * 
 * AI-powered email builder that generates outreach emails based on:
 * - Email type (FIRST_TIME vs FOLLOWUP)
 * - Persona
 * - Relationship context
 * - Previous email history (for followups)
 * - Contact information
 * 
 * For FIRST_TIME emails:
 * - Uses persona and relationship context to craft initial outreach
 * 
 * For FOLLOWUP emails:
 * - References previous email subject/content
 * - Uses appropriate followup tone:
 *   - Recent (no response): "Hey just checking back did you see my email"
 *   - Quarterly: "Checking in - I know when we last spoke, you were still using your previous service - wanted to just continue the conversation"
 */

import { OpenAI } from 'openai';
import { prisma } from '@/lib/prisma';
import { EmailTypeDeterminationService, EmailTypeContext } from './EmailTypeDeterminationService';
import { getLastSendDate } from './followUpCalculator';

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

export interface EmailBuildRequest {
  contactId: string;
  personaSlug?: string | null;
  relationshipContext?: {
    contextOfRelationship?: string;
    relationshipRecency?: string;
    companyAwareness?: string;
    formerCompany?: string;
    primaryWork?: string;
    relationshipQuality?: string;
    opportunityType?: string;
  };
  companyHQId?: string;
}

export interface EmailBuildResult {
  success: boolean;
  emailType?: 'FIRST_TIME' | 'FOLLOWUP';
  subject?: string;
  body?: string;
  reasoning?: string;
  error?: string;
}

export class OutreachEmailBuilderService {
  /**
   * Build an outreach email for a contact
   */
  static async buildEmail(request: EmailBuildRequest): Promise<EmailBuildResult> {
    try {
      const { contactId, personaSlug, relationshipContext, companyHQId } = request;
      
      // Fetch contact
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          goesBy: true,
          email: true,
          title: true,
          notes: true,
          companies: {
            select: {
              companyName: true,
            },
          },
        },
      });
      
      if (!contact) {
        return {
          success: false,
          error: 'Contact not found',
        };
      }
      
      // Determine email type
      const emailTypeContext = await EmailTypeDeterminationService.determineEmailType(
        contactId,
        personaSlug,
        relationshipContext
      );
      
      // Get previous email history for followups
      let previousEmails: any[] = [];
      if (emailTypeContext.emailType === 'FOLLOWUP') {
        // Get platform sends
        const platformSends = await prisma.email_activities.findMany({
          where: {
            contact_id: contactId,
            event: 'sent',
          },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: {
            id: true,
            createdAt: true,
            subject: true,
            email: true,
            event: true,
          },
        });
        
        // Get off-platform sends
        const offPlatformSends = await prisma.off_platform_email_sends.findMany({
          where: { contactId },
          orderBy: { emailSent: 'desc' },
          take: 3,
        });
        
        // Combine and sort
        previousEmails = [
          ...platformSends.map(send => ({
            id: send.id,
            type: 'platform',
            date: send.createdAt.toISOString(),
            subject: send.subject,
            email: send.email,
            event: send.event,
          })),
          ...offPlatformSends.map(send => ({
            id: send.id,
            type: 'off-platform',
            date: send.emailSent.toISOString(),
            subject: send.subject,
            platform: send.platform,
          })),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);
      }
      
      // Get company context if available
      let companyContext = '';
      if (companyHQId) {
        const company = await prisma.company_hqs.findUnique({
          where: { id: companyHQId },
          select: {
            companyName: true,
            whatYouDo: true,
          },
        });
        if (company) {
          companyContext = `Company: ${company.companyName}\nWhat We Do: ${company.whatYouDo || 'Not specified'}`;
        }
      }
      
      // Build prompt based on email type
      const openai = getOpenAIClient();
      const systemPrompt = `You are an expert at writing personalized business outreach emails. Your task is to generate a professional, authentic email that feels natural and builds relationships.

Guidelines:
- Be concise but warm
- Personalize based on relationship context
- For followups, reference previous emails naturally
- Avoid being pushy or salesy
- Match the tone to the relationship type`;

      let userPrompt = '';
      
      if (emailTypeContext.emailType === 'FIRST_TIME') {
        userPrompt = `Write a FIRST-TIME outreach email for:

Contact:
- Name: ${contact.goesBy || `${contact.firstName} ${contact.lastName}`.trim() || contact.email}
- Title: ${contact.title || 'Not specified'}
- Company: ${contact.companies?.companyName || 'Not specified'}
${contact.notes ? `- Notes: ${contact.notes}` : ''}

${companyContext ? `${companyContext}\n` : ''}
${personaSlug ? `Persona: ${personaSlug}\n` : ''}
${relationshipContext ? `Relationship Context:\n${JSON.stringify(relationshipContext, null, 2)}\n` : ''}

Generate a subject line and email body that:
- Introduces yourself/your company naturally
- References any relationship context (former colleague, prior conversation, etc.)
- Provides value or opens a conversation
- Has a clear but soft call-to-action`;
      } else {
        // FOLLOWUP email
        const lastEmail = previousEmails[0];
        const daysSince = emailTypeContext.daysSinceLastSend || 0;
        
        userPrompt = `Write a FOLLOWUP outreach email for:

Contact:
- Name: ${contact.goesBy || `${contact.firstName} ${contact.lastName}`.trim() || contact.email}
- Title: ${contact.title || 'Not specified'}
- Company: ${contact.companies?.companyName || 'Not specified'}
${contact.notes ? `- Notes: ${contact.notes}` : ''}

${companyContext ? `${companyContext}\n` : ''}
${personaSlug ? `Persona: ${personaSlug}\n` : ''}
${relationshipContext ? `Relationship Context:\n${JSON.stringify(relationshipContext, null, 2)}\n` : ''}

Previous Email History:
${lastEmail ? `- Last email sent ${daysSince} days ago\n- Subject: ${lastEmail.subject || 'No subject'}\n- Type: ${lastEmail.type}\n` : 'No previous emails found'}

Email Type Context:
${emailTypeContext.reasoning}

Generate a subject line and email body that:
${daysSince >= 90 
  ? '- Is a quarterly check-in ("Checking in - I know when we last spoke, you were still using your previous service - wanted to just continue the conversation")'
  : daysSince >= 7
  ? '- Is a follow-up checking back ("Hey just checking back did you see my email")'
  : '- Is a recent follow-up with appropriate tone'
}
- References the previous email naturally if relevant
- Continues the conversation without being pushy
- Has a soft call-to-action`;
      }
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      });
      
      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        return {
          success: false,
          error: 'No response from AI',
        };
      }
      
      // Parse JSON response
      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(responseContent);
      } catch (parseError) {
        const jsonMatch = responseContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[1]);
        } else {
          throw parseError;
        }
      }
      
      return {
        success: true,
        emailType: emailTypeContext.emailType,
        subject: parsedResponse.subject || '',
        body: parsedResponse.body || '',
        reasoning: emailTypeContext.reasoning,
      };
    } catch (error: any) {
      console.error('Error building email:', error);
      return {
        success: false,
        error: error.message || 'Failed to build email',
      };
    }
  }
}
