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
import { getLastSendDate } from './emailCadenceService';

/**
 * Get seasonal and date context for email personalization
 */
function getSeasonalContext(month: number, day: number, year: number): string {
  const contexts: string[] = [];
  
  // Seasons (Northern Hemisphere)
  if (month >= 2 && month <= 4) {
    contexts.push('Spring season');
  } else if (month >= 5 && month <= 7) {
    contexts.push('Summer season');
  } else if (month >= 8 && month <= 10) {
    contexts.push('Fall/Autumn season');
  } else {
    contexts.push('Winter season');
  }
  
  // Major holidays and occasions
  if (month === 0 && day === 1) {
    contexts.push('New Year\'s Day');
  } else if (month === 0 && (day >= 1 && day <= 7)) {
    contexts.push('Early January (post-New Year period)');
  } else if (month === 1 && day === 14) {
    contexts.push('Valentine\'s Day');
  } else if (month === 2 && day >= 15 && day <= 21) {
    // Easter varies, but this covers common range
    contexts.push('Spring season');
  } else if (month === 6 && day === 4) {
    contexts.push('Independence Day (US)');
  } else if (month === 9 && day === 31) {
    contexts.push('Halloween');
  } else if (month === 10 && day >= 20 && day <= 30) {
    contexts.push('Thanksgiving season');
  } else if (month === 11 && (day >= 20 && day <= 31)) {
    contexts.push('Holiday season (December)');
  } else if (month === 11 && day === 25) {
    contexts.push('Christmas Day');
  } else if (month === 11 && day === 31) {
    contexts.push('New Year\'s Eve');
  }
  
  // Month-specific context
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  contexts.push(`Current month: ${monthNames[month]}`);
  
  // Weather references by season
  let weatherNote = '';
  if (month >= 2 && month <= 4) {
    weatherNote = 'Spring weather (warming up, flowers blooming)';
  } else if (month >= 5 && month <= 7) {
    weatherNote = 'Summer weather (warm, sunny)';
  } else if (month >= 8 && month <= 10) {
    weatherNote = 'Fall weather (cooling down, leaves changing)';
  } else {
    weatherNote = 'Winter weather (cold, holiday season)';
  }
  
  return `Date: ${monthNames[month]} ${day}, ${year}
Seasonal Context: ${contexts.join(', ')}
Weather Context: ${weatherNote}
Note: Naturally incorporate appropriate seasonal greetings or weather references when it feels authentic and relevant to the relationship.`;
}

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
      
      // Get previous email history for followups (single email_activities table)
      let previousEmails: any[] = [];
      let lastEmailResponse: string | null = null;
      if (emailTypeContext.emailType === 'FOLLOWUP') {
        const activities = await prisma.email_activities.findMany({
          where: {
            contact_id: contactId,
            OR: [{ event: 'sent' }, { source: 'OFF_PLATFORM', sentAt: { not: null } }],
          },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: {
            id: true,
            sentAt: true,
            createdAt: true,
            subject: true,
            body: true,
            source: true,
            platform: true,
            hasResponded: true,
            contactResponse: true,
            responseSubject: true,
          },
        });

        previousEmails = activities.map(a => ({
          id: a.id,
          type: a.source === 'PLATFORM' ? 'platform' : 'off-platform',
          date: (a.sentAt ?? a.createdAt).toISOString(),
          subject: a.subject,
          body: a.body,
          platform: a.platform,
          hasResponded: a.hasResponded,
          contactResponse: a.contactResponse,
          responseSubject: a.responseSubject,
        }));
        
        if (activities.length > 0 && activities[0].hasResponded && activities[0].contactResponse) {
          lastEmailResponse = activities[0].contactResponse;
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
      
      // Get seasonal/date context
      const now = new Date();
      const month = now.getMonth(); // 0-11
      const day = now.getDate();
      const year = now.getFullYear();
      
      const seasonalContext = getSeasonalContext(month, day, year);
      
      // Build prompt based on email type
      const openai = getOpenAIClient();
      const systemPrompt = `You are an expert at writing personalized business outreach emails. Your task is to generate a professional, authentic email that feels natural and builds relationships.

Guidelines:
- Be concise but warm
- Personalize based on relationship context
- For followups, reference previous emails naturally
- Avoid being pushy or salesy
- Match the tone to the relationship type
- Naturally incorporate seasonal greetings and context when appropriate (e.g., "Happy New Year", "hope you're enjoying the nice weather", holiday wishes)`;

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

Current Date Context:
${seasonalContext}

Generate a subject line and email body that:
- Introduces yourself/your company naturally
- References any relationship context (former colleague, prior conversation, etc.)
- Provides value or opens a conversation
- Has a clear but soft call-to-action
- Naturally incorporates seasonal greetings or weather references when appropriate (e.g., "Happy New Year", "hope you're enjoying the spring weather")`;
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

Current Date Context:
${seasonalContext}

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
- Has a soft call-to-action
- Naturally incorporates seasonal greetings or weather references when appropriate (e.g., "Happy New Year", "hope you're enjoying the nice weather")`;
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
