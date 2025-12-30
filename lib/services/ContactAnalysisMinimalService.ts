/**
 * ContactAnalysisMinimalService
 * 
 * MVP1: Simple meeting prep for real contacts
 * No product dependency - just "how do you talk to this person?"
 * Based on their persona/profile - what they might want, how to pitch
 * 
 * MVP1 Fields:
 * - recommendedTalkTrack (how to speak with THIS person)
 * - whatTheyMightWant (what they might want - basic)
 * - meetingPrepSummary (prep summary)
 */

import { prisma } from '@/lib/prisma';
import { OpenAI } from 'openai';

interface MinimalContactAnalysisJSON {
  recommendedTalkTrack: string;  // How to speak with THIS person (key output)
  whatTheyMightWant: string;     // What they might want (basic)
  meetingPrepSummary: string;    // Prep summary for meeting (maps to finalSummary in DB)
}

interface GenerateParams {
  contactId: string;
  companyHQId?: string;
}

export class ContactAnalysisMinimalService {
  /**
   * Generate minimal contact analysis (MVP1)
   */
  static async generate(params: GenerateParams): Promise<{
    success: boolean;
    analysis?: MinimalContactAnalysisJSON;
    error?: string;
  }> {
    try {
      const { contactId, companyHQId } = params;

      // Fetch contact
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        include: {
          companies: true,
        },
      });

      if (!contact) {
        return { success: false, error: 'Contact not found' };
      }

      // Fetch company context if provided
      let companyHQ = null;
      if (companyHQId) {
        companyHQ = await prisma.companyHQ.findUnique({
          where: { id: companyHQId },
          select: {
            companyName: true,
            companyIndustry: true,
            whatYouDo: true,
          },
        });
      }

      // Build prompt
      const { systemPrompt, userPrompt } = this.buildPrompt({
        contact,
        companyHQ,
      });

      // Call OpenAI
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const model = process.env.OPENAI_MODEL || 'gpt-4o';

      console.log(`🤖 ContactAnalysisMinimalService: Generating meeting prep for ${contact.fullName || contact.email}...`);

      const completion = await openai.chat.completions.create({
        model,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      });

      const content = completion.choices?.[0]?.message?.content;
      if (!content) {
        return { success: false, error: 'No response from OpenAI' };
      }

      // Parse response
      const analysis = this.parseResponse(content);

      return { success: true, analysis };
    } catch (error: any) {
      console.error('❌ ContactAnalysisMinimalService error:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate minimal contact analysis',
      };
    }
  }

  /**
   * Build minimal prompt
   */
  private static buildPrompt(context: {
    contact: any;
    companyHQ: any;
  }): { systemPrompt: string; userPrompt: string } {
    const { contact, companyHQ } = context;

    const systemPrompt = `You are a senior BD strategist preparing for a meeting with a real contact.

Generate simple meeting prep - just the essentials:
1. How to talk to this person (recommendedTalkTrack)
2. What they might want (whatTheyMightWant)
3. Meeting prep summary (meetingPrepSummary)

Return EXACTLY this JSON structure:
{
  "recommendedTalkTrack": "",    // How to speak with THIS person (key output)
  "whatTheyMightWant": "",       // What they might want (basic - one sentence or short paragraph)
  "meetingPrepSummary": ""       // Prep summary for meeting (concise)
}

Keep it simple. This is MVP1 - just the basics for meeting prep.`;

    const contactContext = `Contact Info:
- Name: ${contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown'}
- Title: ${contact.title || 'Not specified'}
- Company: ${contact.companyName || 'Not specified'}
- Industry: ${contact.companyIndustry || 'Not specified'}
- Notes: ${contact.notes || 'None'}`;

    const companyContext = companyHQ
      ? `Your Company Context:
- Name: ${companyHQ.companyName}
- Industry: ${companyHQ.companyIndustry || 'Not specified'}
- What You Do: ${companyHQ.whatYouDo || 'Not specified'}`
      : '';

    const userPrompt = `Generate meeting prep analysis for this contact.

${contactContext}

${companyContext ? `${companyContext}\n` : ''}

Focus on:
- How to speak with THIS specific person (recommendedTalkTrack is key)
- What they might want (basic - infer from their role, title, company)
- Concise meeting prep summary

Return the JSON structure with practical, actionable meeting prep.`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Parse OpenAI response
   */
  private static parseResponse(content: string): MinimalContactAnalysisJSON {
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from OpenAI');
      }
    }

    // Extract analysis data (could be nested or flat)
    const analysisData = parsed.analysis || parsed;

    return {
      recommendedTalkTrack: analysisData.recommendedTalkTrack || '',
      whatTheyMightWant: analysisData.whatTheyMightWant || '',
      meetingPrepSummary: analysisData.meetingPrepSummary || '',
    };
  }
}

