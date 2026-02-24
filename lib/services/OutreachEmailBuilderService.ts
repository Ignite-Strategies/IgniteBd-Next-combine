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
      
      // Get previous email history for followups (use unified emails table)
      let previousEmails: any[] = [];
      let lastEmailResponse: string | null = null;
      if (emailTypeContext.emailType === 'FOLLOWUP') {
        // Get emails from unified emails table (includes responses)
        const emails = await prisma.emails.findMany({
          where: { contactId },
          orderBy: { sendDate: 'desc' },
          take: 3,
          select: {
            id: true,
            sendDate: true,
            subject: true,
            body: true,
            source: true,
            platform: true,
            hasResponded: true,
            contactResponse: true,
            responseSubject: true,
          },
        });
        
        previousEmails = emails.map(email => ({
          id: email.id,
          type: email.source === 'PLATFORM' ? 'platform' : 'off-platform',
          date: email.sendDate.toISOString(),
          subject: email.subject,
          body: email.body,
          platform: email.platform,
          hasResponded: email.hasResponded,
          contactResponse: email.contactResponse,
          responseSubject: email.responseSubject,
        }));
        
        // Get last email's response text if available
        if (emails.length > 0 && emails[0].hasResponded && emails[0].contactResponse) {
          lastEmailResponse = emails[0].contactResponse;
        }
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
      
      // Build prompt based on email type and conversation state
      if (emailTypeContext.emailType === 'FIRST_TIME') {
        userPrompt = `Write a FIRST-OUTBOUND outreach email for:

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
        const hasResponse = emailTypeContext.lastEmailHadResponse === true;
        const responseText = emailTypeContext.lastEmailResponseText;
        
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
${lastEmail ? `- Last email sent ${daysSince} days ago\n- Subject: ${lastEmail.subject || 'No subject'}\n- Type: ${lastEmail.type || 'unknown'}\n` : 'No previous emails found'}
${hasResponse && responseText ? `- Contact responded: "${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}"\n` : hasResponse ? '- Contact responded (response text available)\n' : '- No response to last email yet\n'}

Email Type Context:
${emailTypeContext.reasoning}

Generate a subject line and email body that:
${hasResponse && responseText
  ? '- Acknowledges their response and continues the conversation naturally'
  : daysSince >= 90 
  ? '- Is a quarterly check-in ("Checking in - I know when we last spoke, you were still using your previous service - wanted to just continue the conversation")'
  : daysSince >= 7
  ? '- Is a follow-up checking back ("Hey just checking back did you see my email")'
  : '- Is a recent follow-up with appropriate tone'
}
${hasResponse && responseText ? '- References their response appropriately' : '- References the previous email naturally if relevant'}
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
