/**
 * takeCrmClientEmailAndParseAiService
 * 
 * Parses raw email content from client (forwarded chains, pasted content).
 * Extracts: contact name, contact email, next engagement date, threading headers.
 */

import { OpenAI } from 'openai';

export interface ParsedEmailData {
  subject: string;
  body: string;
  contactEmail: string;
  contactName: string | null;
  nextEngagementDate: string | null;  // ISO date "YYYY-MM-DD" or null
  inReplyTo: string | null;           // Message-ID from In-Reply-To header
  references: string[] | null;        // Message-IDs from References header
  isResponse: boolean;                 // AI-detected: is this likely a response?
}

export interface ParseEmailInput {
  /** Plain text body (preferred for body extraction) */
  text?: string | null;
  /** HTML body (use for contact/signature extraction when present) */
  html?: string | null;
  /** Raw MIME or combined content (fallback when text/html empty) */
  raw?: string | null;
}

export async function takeCrmClientEmailAndParseAiService(
  emailRawTextOrInput: string | ParseEmailInput,
  headers?: string  // Raw headers string from SendGrid
): Promise<ParsedEmailData> {
  const input: ParseEmailInput =
    typeof emailRawTextOrInput === 'string'
      ? { raw: emailRawTextOrInput }
      : emailRawTextOrInput;

  const text = (input.text || '').trim();
  const html = (input.html || '').trim();
  const raw = (input.raw || '').trim();

  const emailRawText =
    text && html
      ? `PLAIN TEXT (use for body extraction):\n${text}\n\nHTML (use for contact/signature - tags stripped):\n${html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}`
      : text || (html ? html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : raw) || raw;

  if (!emailRawText) {
    throw new Error('No content to parse');
  }
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || 'gpt-4o';

    // Extract headers info for context
    let headersContext = '';
    if (headers) {
      // Try to extract In-Reply-To and References from headers
      const inReplyToMatch = headers.match(/In-Reply-To:\s*(.+)/i);
      const referencesMatch = headers.match(/References:\s*(.+)/i);
      
      if (inReplyToMatch) {
        headersContext += `In-Reply-To: ${inReplyToMatch[1]}\n`;
      }
      if (referencesMatch) {
        headersContext += `References: ${referencesMatch[1]}\n`;
      }
    }

    const systemPrompt = `You are an email parsing assistant. Extract structured data from raw email content.

The email may be a forwarded chain or pasted content. Focus on the MOST RECENT message in the thread for extraction.

Extract:
1. Contact name - from signature, From field, or body. This is critical.
2. Contact email - from From field or signature
3. Next engagement date (if mentioned - "follow up in X months", "later this year", specific dates)
4. Threading headers (In-Reply-To, References) if present
5. Response detection (is this a reply? subject RE:, quoted text, etc.)

Return EXACTLY this JSON structure:
{
  "subject": "...",
  "body": "...",
  "contactEmail": "...",
  "contactName": "..." or null,
  "nextEngagementDate": "YYYY-MM-DD" or null,
  "inReplyTo": "Message-ID" or null,
  "references": ["Message-ID1", "Message-ID2"] or null,
  "isResponse": true or false
}

Keep it simple. Extract what you can find.`;

    const userPrompt = `Parse this raw email:

${headersContext ? `Headers:\n${headersContext}\n` : ''}
Raw email content:
${emailRawText}

Extract the structured data and return JSON only.`;

    console.log(`🤖 takeCrmClientEmailAndParseAiService: Parsing email (${model})...`);

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.3, // Lower temperature for more consistent parsing
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse response
    const parsed = parseResponse(content);

    console.log('✅ Email parsed:', {
      contactEmail: parsed.contactEmail,
      contactName: parsed.contactName,
      hasNextEngagementDate: !!parsed.nextEngagementDate,
      isResponse: parsed.isResponse,
    });

    return parsed;
  } catch (error: any) {
    console.error('❌ takeCrmClientEmailAndParseAiService error:', error);
    throw new Error(`Failed to parse email: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Parse OpenAI response
 */
function parseResponse(content: string): ParsedEmailData {
  let parsed: any;
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

  // Extract data (could be nested or flat)
  const data = parsed.email || parsed;

  return {
    subject: data.subject || parsed.subject || '',
    body: data.body || parsed.body || '',
    contactEmail: data.contactEmail || parsed.contactEmail || '',
    contactName: data.contactName || parsed.contactName || null,
    nextEngagementDate: data.nextEngagementDate || parsed.nextEngagementDate || null,
    inReplyTo: data.inReplyTo || parsed.inReplyTo || null,
    references: Array.isArray(data.references || parsed.references) 
      ? (data.references || parsed.references) 
      : null,
    isResponse: data.isResponse !== undefined ? data.isResponse : parsed.isResponse !== undefined ? parsed.isResponse : false,
  };
}
