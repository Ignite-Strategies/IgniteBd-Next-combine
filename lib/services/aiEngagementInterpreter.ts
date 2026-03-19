/**
 * AI Engagement Interpreter
 *
 * Interprets parsed email content for engagement meaning — what the contact is saying,
 * disposition, next steps. Does NOT do structural parsing (use universalEmailParser for that).
 *
 * Input: Parsed email (from universal parser) + owner context
 * Output: summary, isResponse, nextEngagementDate, contactEmail, contactName
 */

import { OpenAI } from 'openai';

export interface ParsedEmailInput {
  from?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
  to?: string | null;
  toEmail?: string | null;
  toName?: string | null;
  subject?: string | null;
  body?: string | null;
  headers?: string | null;
  raw?: string | null;
}

export interface OwnerContext {
  name?: string | null;
  email?: string | null;
  companyName?: string | null;
}

export type ActivityType =
  | 'inbound_email'   // An actual email FROM the contact TO the owner
  | 'outbound_email'  // An email FROM the owner TO the contact (forwarded to CRM)
  | 'call_note'       // Owner logging a phone call they had with the contact
  | 'meeting_note'    // Owner logging an in-person or video meeting
  | 'note';           // General update/note with no specific activity type

export interface EngagementInterpretation {
  subject: string;
  body: string;
  contactEmail: string;
  contactName: string | null;
  nextEngagementDate: string | null; // ISO date "YYYY-MM-DD" or null
  inReplyTo: string | null;
  references: string[] | null;
  isResponse: boolean;
  summary: string; // 1-2 sentence summary of the interaction
  activityType: ActivityType; // What kind of activity this email describes
  activityDate: string | null; // ISO date "YYYY-MM-DD" of when the activity actually happened (may differ from email date)
}

/**
 * Interpret engagement meaning from a parsed email.
 * Uses AI to determine: contact identity, disposition, next steps, summary.
 */
export async function interpretEngagement(
  parsedEmail: ParsedEmailInput,
  ownerContext?: OwnerContext | null,
): Promise<EngagementInterpretation> {
  const body =
    (parsedEmail.body || '').trim() ||
    (parsedEmail.raw || '').trim().slice(0, 8000);

  if (!body && !parsedEmail.subject) {
    throw new Error('No content to interpret');
  }

  let headersContext = '';
  if (parsedEmail.headers) {
    const inReplyToMatch = parsedEmail.headers.match(/In-Reply-To:\s*(.+)/i);
    const referencesMatch = parsedEmail.headers.match(/References:\s*(.+)/i);
    if (inReplyToMatch) headersContext += `In-Reply-To: ${inReplyToMatch[1]}\n`;
    if (referencesMatch) headersContext += `References: ${referencesMatch[1]}\n`;
  }

  let ownerBlock = '';
  if (ownerContext?.name || ownerContext?.email || ownerContext?.companyName) {
    ownerBlock = '\nOWNER/CLIENT CONTEXT (the person who forwarded this to the CRM — they are NOT the contact):\n';
    if (ownerContext.name) ownerBlock += `  Owner name: ${ownerContext.name}\n`;
    if (ownerContext.email) ownerBlock += `  Owner email: ${ownerContext.email}\n`;
    if (ownerContext.companyName) ownerBlock += `  Owner company: ${ownerContext.companyName}\n`;
    ownerBlock +=
      '\nThe CONTACT is the OTHER person in the conversation — the prospect/target. Do NOT return the owner as the contact.\n';
    ownerBlock +=
      '\nFORWARDED EMAILS: If the From: header is the owner (they forwarded this), the REAL contact is INSIDE the body. ';
    ownerBlock +=
      'Scan the body for: "From: name <email>", "----- Original Message -----", "Begin forwarded message", "From:", etc. ';
    ownerBlock +=
      'Extract the contact email and contact name from the FIRST/original sender block (the person the owner is corresponding with), NOT the forwarder.\n';
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  const contentBlock = [
    parsedEmail.subject ? `Subject: ${parsedEmail.subject}` : null,
    parsedEmail.from ? `From: ${parsedEmail.from}` : null,
    parsedEmail.to ? `To: ${parsedEmail.to}` : null,
    headersContext ? `Headers:\n${headersContext}` : null,
    body ? `Body:\n${body}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  const systemPrompt = `You are an engagement interpreter for a CRM. The email has ALREADY been parsed (headers, from, to, subject, body). Your job is to INTERPRET the engagement meaning.

${ownerBlock}
CRITICAL: The CONTACT is the prospect/target the owner is corresponding with — NOT the owner.

IMPORTANT: If no contact email appears in the body or headers, the subject line may contain the contact's full name — extract it as contactName even if contactEmail must be left empty string.

ACTIVITY TYPE — Determine what kind of activity this email actually describes:
- "inbound_email": An actual email FROM the contact TO the owner (a real received email)
- "outbound_email": An email the OWNER sent TO the contact, forwarded to CRM for logging
- "call_note": The owner is logging/reporting a phone call they had with the contact. Signals: "I spoke with", "called", "on the phone", "spoke to him/her", "had a call"
- "meeting_note": The owner is logging an in-person or video meeting. Signals: "met with", "had a meeting", "sat down with", "meeting with"
- "note": A general update or context note with no specific email/call/meeting

ACTIVITY DATE — If the email describes an event that happened on a DIFFERENT date than today (e.g. "I spoke with him on Monday 3/2"), extract THAT date as activityDate. Today is ${todayStr}. If the event is happening now or no date is mentioned, set null.

Interpret:
1. Contact email — who is the prospect/target? (NOT the owner)
2. Contact name — the prospect's name if visible. If the subject line looks like a person's name (short, no colon, not a typical email topic), treat it as the contact's name.
3. Subject — use parsed subject (may clean up Re:/Fwd:)
4. Body — CONTEXTUAL summary: what the contact actually said (key points, tone, or short quotes). Include buyer/forwarding signals (e.g. "I'll forward your stuff", "not the right person", "happy to connect", "we're not looking now"). Then the immediate next step. Not just the action — include context so we can see if they're a buyer or a pass-through.
5. Next engagement date — be AGGRESSIVE. Today is ${todayStr}. Examples:
   - "follow up in 3-6 months" → midpoint (~4.5 months from today)
   - "later this year" → ~6 months from today
   - "next quarter" → 3 months from today
   - Any specific date mentioned → use that date
   - "not interested" with no follow-up → null
6. isResponse — is the contact responding to the owner's outreach?
7. Summary — 1-2 sentences WITH CONTEXT: what the contact said (e.g. buyer vs will-forward, interested vs not), disposition, and next steps. Include enough so we know if they're a buyer or just forwarding. Used for cadence logic.
8. activityType — one of: "inbound_email", "outbound_email", "call_note", "meeting_note", "note"
9. activityDate — "YYYY-MM-DD" if the described event happened on a specific past date, else null

Return EXACTLY this JSON:
{
  "subject": "...",
  "body": "contextual summary: what contact said + signals + next step",
  "contactEmail": "prospect email, NOT owner",
  "contactName": "prospect name" or null,
  "nextEngagementDate": "YYYY-MM-DD" or null,
  "inReplyTo": "Message-ID" or null,
  "references": ["Message-ID1"] or null,
  "isResponse": true or false,
  "summary": "1-2 sentences with context (what they said, buyer/forward, next step)",
  "activityType": "inbound_email" | "outbound_email" | "call_note" | "meeting_note" | "note",
  "activityDate": "YYYY-MM-DD" or null
}

Return JSON only.`;

  const userPrompt = `Interpret this parsed email:\n\n${contentBlock}`;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || 'gpt-4o';

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');

    const result = parseResponse(content);

    // Fallback: if AI didn't return contactEmail, use parsed from/to + owner
    if (!result.contactEmail && ownerContext?.email) {
      const ownerLower = ownerContext.email.toLowerCase();
      if (parsedEmail.fromEmail?.toLowerCase() !== ownerLower) {
        result.contactEmail = parsedEmail.fromEmail || '';
      } else if (parsedEmail.toEmail?.toLowerCase() !== ownerLower) {
        result.contactEmail = parsedEmail.toEmail || '';
      }
    }
    if (!result.contactEmail) {
      result.contactEmail = parsedEmail.fromEmail || parsedEmail.toEmail || '';
    }
    if (!result.subject && parsedEmail.subject) {
      result.subject = parsedEmail.subject;
    }

    console.log('✅ AI Engagement Interpreter:', {
      contactEmail: result.contactEmail,
      contactName: result.contactName,
      activityType: result.activityType,
      activityDate: result.activityDate,
      hasNextEngagementDate: !!result.nextEngagementDate,
      isResponse: result.isResponse,
    });

    return result;
  } catch (error: unknown) {
    console.error('❌ aiEngagementInterpreter error:', error);
    throw new Error(
      `Failed to interpret engagement: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

function parseResponse(content: string): EngagementInterpretation {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    else throw new Error('Invalid JSON from AI');
  }

  const d = (parsed.email as Record<string, unknown>) || parsed;

  const VALID_ACTIVITY_TYPES = [
    'inbound_email',
    'outbound_email',
    'call_note',
    'meeting_note',
    'note',
  ] as const;

  const rawActivityType = d.activityType ?? parsed.activityType;
  const activityType: ActivityType = VALID_ACTIVITY_TYPES.includes(rawActivityType as ActivityType)
    ? (rawActivityType as ActivityType)
    : 'inbound_email';

  const rawActivityDate = d.activityDate ?? parsed.activityDate;
  const activityDate =
    typeof rawActivityDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawActivityDate)
      ? rawActivityDate
      : null;

  return {
    subject: String(d.subject ?? parsed.subject ?? ''),
    body: String(d.body ?? parsed.body ?? ''),
    contactEmail: String(d.contactEmail ?? parsed.contactEmail ?? ''),
    contactName:
      typeof (d.contactName ?? parsed.contactName) === 'string'
        ? (d.contactName ?? parsed.contactName) as string
        : null,
    nextEngagementDate:
      typeof (d.nextEngagementDate ?? parsed.nextEngagementDate) === 'string'
        ? (d.nextEngagementDate ?? parsed.nextEngagementDate) as string
        : null,
    inReplyTo:
      typeof (d.inReplyTo ?? parsed.inReplyTo) === 'string'
        ? (d.inReplyTo ?? parsed.inReplyTo) as string
        : null,
    references: Array.isArray(d.references ?? parsed.references)
      ? (d.references ?? parsed.references) as string[]
      : null,
    isResponse:
      typeof (d.isResponse ?? parsed.isResponse) === 'boolean'
        ? (d.isResponse ?? parsed.isResponse) as boolean
        : false,
    summary: String(d.summary ?? parsed.summary ?? ''),
    activityType,
    activityDate,
  };
}
