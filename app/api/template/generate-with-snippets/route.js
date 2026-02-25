import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { OpenAI } from 'openai';
import { prisma } from '@/lib/prisma';
import { resolveMembership } from '@/lib/membership';

let openaiClient = null;
function getOpenAIClient() {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

const DONT_KNOW = 'DONT_KNOW';
function isDefined(v) { return v && v !== DONT_KNOW; }
function humanize(str) {
  if (!str) return '';
  return str.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Derive tone guidance from the persona slug + relationship context.
 * This is the key piece that was missing — the AI needs to know HOW to write,
 * not just WHO it's writing to.
 */
function buildToneGuidance(personaSlug, rc) {
  const slug = (personaSlug || '').toLowerCase();
  const ctx = (rc?.contextOfRelationship || '').toLowerCase();
  const recency = (rc?.relationshipRecency || '').toLowerCase();

  const isFormerColleague =
    slug.includes('former') ||
    slug.includes('colleague') ||
    ctx.includes('used_to_work') ||
    ctx.includes('former');

  const isLongDormant =
    recency.includes('long_dormant') ||
    recency.includes('dormant') ||
    slug.includes('longtime') ||
    slug.includes('long_time');

  const isWarmReconnect = isFormerColleague || slug.includes('reconnect');

  const lines = [];

  if (isWarmReconnect) {
    lines.push('TONE: This is a warm reconnect with someone you already know personally. Write like a real person reaching out to an old colleague — casual, genuine, short.');
    lines.push('DO NOT introduce yourself or explain your company — they know you.');
    lines.push('DO NOT say things like "as you may remember when you were at [company]" — that sounds weird and clinical. Just check in naturally.');
    lines.push('DO start with something like "Hey {{firstName}}!" or "{{firstName}}!" — not "Dear {{firstName}}".');
  }

  if (isLongDormant) {
    lines.push('It has been a while since you were in touch. Acknowledge that briefly and naturally — e.g. "It\'s been too long!" or "Hope you\'ve been well." — then get to the point.');
    lines.push('Keep it short. Long emails feel weird after a long gap.');
  }

  if (rc?.formerCompany && isDefined(rc.formerCompany)) {
    lines.push(`The recipient formerly worked at ${rc.formerCompany} — that is YOUR company or a company you are both connected to. Do NOT reference this as if it is their old company in a distant way; it is your shared connection.`);
  }

  if (rc?.primaryWork && isDefined(rc.primaryWork)) {
    lines.push(`The recipient now works at a ${rc.primaryWork}. Reference this naturally if relevant (e.g. "congrats on the new role" or "knowing you are now on the fund side").`);
  }

  if (lines.length === 0) {
    lines.push('Tone should be warm, professional, and human — not stiff or generic.');
  }

  return lines.join('\n');
}

/**
 * POST /api/template/generate-with-snippets
 */
export async function POST(request) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { companyHQId, intent, ownerId, contactId, additionalContext } = body ?? {};
    // effectiveRelationshipContext: comes from caller (URL param passthrough) or gets
    // replaced by DB data below — caller data is always overridden if DB has richer info.
    let effectiveRelationshipContext = body?.relationshipContext ?? null;
    let effectivePersonaSlug = body?.personaSlug ?? null;

    if (!companyHQId || !intent || intent.trim() === '') {
      return NextResponse.json(
        { error: 'companyHQId and intent are required' },
        { status: 400 },
      );
    }

    // Verify membership
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: { id: true },
    });
    if (!owner) return NextResponse.json({ error: 'Owner not found' }, { status: 404 });

    const { membership } = await resolveMembership(owner.id, companyHQId);
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // ── Hydrate contact data from DB ────────────────────────────────────────
    let contactNotes = null;
    let contactInfo = null;

    if (contactId) {
      try {
        const contactRecord = await prisma.contact.findUnique({
          where: { id: contactId },
          select: {
            firstName: true,
            lastName: true,
            goesBy: true,
            title: true,
            companyName: true,
            notes: true,
            outreachPersonaSlug: true,
            relationship_contexts: {
              select: {
                contextOfRelationship: true,
                relationshipRecency: true,
                companyAwareness: true,
                formerCompany: true,
                primaryWork: true,
                relationshipQuality: true,
                opportunityType: true,
              },
            },
          },
        });

        if (contactRecord) {
          if (contactRecord.notes) contactNotes = contactRecord.notes;

          contactInfo = {
            name: contactRecord.goesBy || [contactRecord.firstName, contactRecord.lastName].filter(Boolean).join(' ') || null,
            title: contactRecord.title || null,
            companyName: contactRecord.companyName || null,
          };

          // Always prefer DB persona slug over URL param
          if (contactRecord.outreachPersonaSlug) {
            effectivePersonaSlug = contactRecord.outreachPersonaSlug;
          }

          // Always prefer DB relationship context (strip DONT_KNOWs)
          if (contactRecord.relationship_contexts) {
            const rc = contactRecord.relationship_contexts;
            const clean = {};
            if (isDefined(rc.contextOfRelationship)) clean.contextOfRelationship = rc.contextOfRelationship;
            if (isDefined(rc.relationshipRecency)) clean.relationshipRecency = rc.relationshipRecency;
            if (isDefined(rc.companyAwareness)) clean.companyAwareness = rc.companyAwareness;
            if (rc.formerCompany) clean.formerCompany = rc.formerCompany;
            if (rc.primaryWork) clean.primaryWork = rc.primaryWork;
            if (isDefined(rc.relationshipQuality)) clean.relationshipQuality = rc.relationshipQuality;
            if (isDefined(rc.opportunityType)) clean.opportunityType = rc.opportunityType;
            if (Object.keys(clean).length > 0) effectiveRelationshipContext = clean;
          }
        }
      } catch (err) {
        console.warn('Could not fetch contact data:', err);
      }
    }

    // ── Fetch persona description from DB ────────────────────────────────────
    let personaRecord = null;
    if (effectivePersonaSlug) {
      try {
        personaRecord = await prisma.outreach_personas.findUnique({
          where: { slug: effectivePersonaSlug },
          select: { name: true, description: true },
        });
      } catch (err) {
        console.warn('Could not fetch persona record:', err);
      }
    }

    // ── Load snippets ─────────────────────────────────────────────────────────
    const snippets = await prisma.contentSnip.findMany({
      select: {
        snipSlug: true,
        snipName: true,
        snipText: true,
        templatePosition: true,
        personaSlug: true,
        bestUsedWhen: true,
      },
      orderBy: [{ templatePosition: 'asc' }, { snipName: 'asc' }],
    });

    if (snippets.length === 0) {
      return NextResponse.json(
        { error: 'No active content snippets found. Please create some snippets first.' },
        { status: 400 },
      );
    }

    // ── Owner name for signature ──────────────────────────────────────────────
    let ownerName = '[Your name]';
    if (ownerId) {
      try {
        const ownerData = await prisma.owners.findUnique({
          where: { id: ownerId },
          select: { firstName: true, lastName: true, name: true },
        });
        if (ownerData) {
          ownerName = ownerData.firstName || ownerData.name?.split(' ')[0] || '[Your name]';
        }
      } catch (err) {
        console.warn('Could not fetch owner name:', err);
      }
    }

    const snippetsList = snippets.map((s) => ({
      name: s.snipSlug,
      displayName: s.snipName,
      text: s.snipText,
      templatePosition: s.templatePosition,
      personaSlug: s.personaSlug ?? null,
      bestUsedWhen: s.bestUsedWhen ?? null,
    }));

    const openai = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o';

    // ── Build prompt sections ─────────────────────────────────────────────────

    // Relationship context — only include known values, no DONT_KNOWs
    let relationshipContextDesc = '';
    if (effectiveRelationshipContext && Object.keys(effectiveRelationshipContext).length > 0) {
      const rc = effectiveRelationshipContext;
      const parts = [];
      if (rc.contextOfRelationship) parts.push(`Relationship type: ${humanize(rc.contextOfRelationship)}`);
      if (rc.relationshipRecency) parts.push(`Recency: ${humanize(rc.relationshipRecency)}`);
      if (rc.formerCompany) parts.push(`Former company connection: ${rc.formerCompany}`);
      if (rc.primaryWork) parts.push(`Recipient now works at: ${rc.primaryWork}`);
      if (rc.companyAwareness) parts.push(`Company awareness: ${humanize(rc.companyAwareness)}`);
      if (rc.relationshipQuality) parts.push(`Relationship quality: ${humanize(rc.relationshipQuality)}`);
      if (rc.opportunityType) parts.push(`Opportunity type: ${humanize(rc.opportunityType)}`);
      if (parts.length > 0) {
        relationshipContextDesc = `\n\n=== RELATIONSHIP CONTEXT ===\n${parts.join('\n')}`;
      }
    }

    // Persona
    let personaDesc = '';
    if (effectivePersonaSlug) {
      const personaFriendly = personaRecord?.name || humanize(effectivePersonaSlug.replace(/([A-Z])/g, ' $1').trim());
      personaDesc = `\n\n=== OUTREACH PERSONA ===\nPersona: ${personaFriendly}`;
      if (personaRecord?.description) {
        personaDesc += `\nDescription: ${personaRecord.description}`;
      }
    }

    // Contact info
    let contactInfoDesc = '';
    if (contactInfo) {
      const parts = [];
      if (contactInfo.name) parts.push(`Name: ${contactInfo.name}`);
      if (contactInfo.title) parts.push(`Title: ${contactInfo.title}`);
      if (contactInfo.companyName) parts.push(`Current company: ${contactInfo.companyName}`);
      if (parts.length > 0) {
        contactInfoDesc = `\n\n=== RECIPIENT ===\n${parts.join('\n')}`;
      }
    }

    // Tone guidance — derived from persona + relationship context
    const toneGuidance = buildToneGuidance(effectivePersonaSlug, effectiveRelationshipContext);

    const contactNotesDesc = contactNotes ? `\n\n=== CONTACT NOTES ===\n${contactNotes}` : '';
    const additionalContextDesc = additionalContext?.trim() ? `\n\n=== ADDITIONAL CONTEXT ===\n${additionalContext.trim()}` : '';

    const systemPrompt = `You are an expert at building email outreach templates by selecting and assembling content snippets.

Your task: given context about the recipient and the relationship, select the most relevant snippets and write the connecting tissue between them to produce a complete, natural email.

CRITICAL RULES:
1. Use provided snippets in the format {{snippet:snippetSlug}} — do not invent content
2. Write connecting text between snippets that sounds like a real person, not a template
3. Add variables like {{firstName}}, {{companyName}} where appropriate
4. Natural flow: greeting → context/connection → value → ask → close
5. Select snippets that match the persona and relationship type (check personaSlug and bestUsedWhen fields)

=== TONE GUIDANCE ===
${toneGuidance}`;

    const userPrompt = `=== USER'S INTENT / NOTES ===
${intent.trim()}${contactInfoDesc}${contactNotesDesc}${additionalContextDesc}${relationshipContextDesc}${personaDesc}

=== AVAILABLE SNIPPETS ===
${JSON.stringify(snippetsList, null, 2)}

=== YOUR TASK ===
1. Read the relationship context and persona carefully — they define the TONE and APPROACH
2. Select 2-4 snippets that best fit this situation (prefer snippets whose personaSlug or bestUsedWhen matches)
3. Write a complete email that:
   - Opens appropriately for the relationship (casual if warm reconnect, professional if cold)
   - Weaves snippets in naturally with your own connecting text
   - Uses {{firstName}} and other variables where they help personalisation
   - Ends with: ${ownerName}
4. Keep it concise — people skim long emails

Return ONLY valid JSON:
{
  "title": "Short descriptive title for this template",
  "subject": "Email subject line",
  "body": "Complete email body with {{snippet:slug}} references and {{firstName}} variables",
  "selectedSnippets": ["slugOne", "slugTwo"],
  "reasoning": "One sentence: why these snippets and this tone"
}`;

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'AI generation failed: Empty response' }, { status: 500 });
    }

    let generated;
    try {
      generated = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      return NextResponse.json({ error: 'AI generation failed: Invalid response format' }, { status: 500 });
    }

    if (!generated.title || !generated.subject || !generated.body) {
      return NextResponse.json({ error: 'AI generation failed: Missing required fields' }, { status: 500 });
    }

    const selectedSnippets = generated.selectedSnippets || [];
    const validSnippets = snippets.map((s) => s.snipSlug);

    return NextResponse.json({
      success: true,
      template: {
        title: generated.title,
        subject: generated.subject,
        body: generated.body,
      },
      selectedSnippets: selectedSnippets.filter((name) => validSnippets.includes(name)),
      reasoning: generated.reasoning || 'Snippets selected based on intent and relationship context',
      availableSnippets: snippets.length,
    });

  } catch (error) {
    console.error('❌ AI template generation error:', error);
    if (error.message?.includes('OPENAI_API_KEY')) {
      return NextResponse.json(
        { error: 'AI service error: Invalid OpenAI API key configuration' },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: `AI generation failed: ${error.message || 'Unknown error'}` },
      { status: 500 },
    );
  }
}
