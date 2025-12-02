import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { OpenAI } from 'openai';

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

interface Priorities {
  travel?: number; // 1-5
  cost?: number; // 1-5
  networking?: number; // 1-5
  learning?: number; // 1-5
  ecosystem?: number; // 1-5
}

/**
 * POST /api/events/opp/generate
 * Generate BDEventOpp records from EventMeta candidates
 * 
 * Input:
 * - personaId
 * - priorities: { travel, cost, networking, learning, ecosystem }
 * - companyHQId (from auth)
 * - ownerId (from auth)
 */
export async function POST(request: Request) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { personaId, priorities, limit = 20 } = body;

    if (!personaId) {
      return NextResponse.json({ success: false, error: 'personaId is required' }, { status: 400 });
    }

    // Get companyHQId and ownerId from request headers or body
    const companyHQId = body.companyHQId || request.headers.get('x-companyhq-id');
    const ownerId = firebaseUser.uid || body.ownerId;

    if (!companyHQId || !ownerId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId and ownerId are required' },
        { status: 400 }
      );
    }

    // Get persona
    const persona = await prisma.persona.findUnique({
      where: { id: personaId },
      include: {
        companyHQ: true,
      },
    });

    if (!persona) {
      return NextResponse.json({ success: false, error: 'Persona not found' }, { status: 404 });
    }

    // Get candidate EventMeta records (recent, with organizer info)
    const candidateEvents = await prisma.eventMeta.findMany({
      include: {
        organizer: true,
      },
      take: limit * 2, // Get more candidates than needed
      orderBy: { createdAt: 'desc' },
    });

    if (candidateEvents.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No event candidates found. Please ingest events first.' },
        { status: 404 }
      );
    }

    // Build scoring prompt
    const personaSummary = `
Persona:
- Title: ${persona.title || persona.personName || 'Not specified'}
- Industry: ${persona.industry || 'Not specified'}
- Location: ${persona.location || 'Not specified'}
- Description: ${persona.description || 'Not specified'}
- Pain Points: ${Array.isArray(persona.painPoints) ? persona.painPoints.join(', ') : 'Not specified'}
- Goals: ${persona.whatTheyWant || 'Not specified'}
`;

    const prioritiesText = priorities
      ? `
Priorities (1-5, higher = more important):
- Travel: ${priorities.travel || 3}/5
- Cost: ${priorities.cost || 3}/5
- Networking: ${priorities.networking || 3}/5
- Learning: ${priorities.learning || 3}/5
- Ecosystem: ${priorities.ecosystem || 3}/5
`
      : 'No priorities specified (using defaults)';

    const eventsSummary = candidateEvents
      .slice(0, limit)
      .map(
        (event, idx) => `
Event ${idx + 1}:
- Name: ${event.name}
- Organizer: ${event.organizer?.normalizedName || 'Unknown'}
- Type: ${event.eventType}
- Location: ${event.city || ''} ${event.state || ''}
- Date: ${event.dateRange || event.startDate || 'TBD'}
- Cost: ${event.costMin ? `$${event.costMin}` : 'Unknown'}
- Organizer BD Score: ${event.organizer?.bdRelevanceScore || 'N/A'}
- Organizer Industry Tags: ${event.organizer?.industryTags?.join(', ') || 'None'}
`
      )
      .join('\n');

    const prompt = `You are a BD intelligence engine. Score ${limit} events for this persona.

${personaSummary}

${prioritiesText}

Events to score:
${eventsSummary}

For each event, return ONLY JSON with scores:
{
  "scores": [
    {
      "eventIndex": 1,
      "personaAlignment": 0-100,  // Overall fit with persona
      "travelBurden": 1-10,       // Lower = less travel burden (1 = local, 10 = very far)
      "costFit": 1-10,            // Higher = better cost fit (10 = free/very affordable)
      "ecosystemFit": 0-100,      // Fit based on organizer intelligence (use organizer BD score + industry tags)
      "bdOpportunity": 0-100,     // Composite BD opportunity score
      "notes": "Brief explanation of scores"
    },
    ...
  ]
}

Guidelines:
- personaAlignment: How well event matches persona's industry, role, goals, pain points
- travelBurden: Consider persona location vs event location (1 = same city, 10 = international)
- costFit: Consider event cost vs persona budget sensitivity (higher = more affordable)
- ecosystemFit: Use organizer's bdRelevanceScore and industry tags alignment
- bdOpportunity: Weighted composite of all scores, prioritizing user's priority preferences
- Return exactly ${limit} scores, one per event`;

    // Call OpenAI for scoring
    const openai = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'You are a BD intelligence engine. Return only valid JSON with event scores. No markdown, no code blocks.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse scores
    let scoresData: any;
    try {
      scoresData = JSON.parse(content);
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI JSON response:', parseError);
      throw new Error('Invalid JSON response from OpenAI');
    }

    const scores = scoresData.scores || [];

    // Create BDEventOpp records
    const bdEventOpps = [];
    for (let i = 0; i < Math.min(scores.length, candidateEvents.length); i++) {
      const score = scores[i];
      const event = candidateEvents[score.eventIndex - 1]; // eventIndex is 1-based

      if (!event) continue;

      // Check if BDEventOpp already exists for this event + persona
      const existing = await prisma.bdEventOpp.findFirst({
        where: {
          eventMetaId: event.id,
          personaId: personaId,
          companyHQId: companyHQId,
        },
      });

      if (existing) {
        // Update existing
        const updated = await prisma.bdEventOpp.update({
          where: { id: existing.id },
          data: {
            personaAlignment: score.personaAlignment || null,
            travelBurden: score.travelBurden || null,
            costFit: score.costFit || null,
            ecosystemFit: score.ecosystemFit || null,
            bdOpportunity: score.bdOpportunity || null,
            notes: score.notes || null,
          },
        });
        bdEventOpps.push(updated);
      } else {
        // Create new
        const bdOpp = await prisma.bdEventOpp.create({
          data: {
            companyHQId,
            ownerId,
            eventMetaId: event.id,
            personaId: personaId,
            personaAlignment: score.personaAlignment || null,
            travelBurden: score.travelBurden || null,
            costFit: score.costFit || null,
            ecosystemFit: score.ecosystemFit || null,
            bdOpportunity: score.bdOpportunity || null,
            notes: score.notes || null,
            status: 'CONSIDERING',
          },
        });
        bdEventOpps.push(bdOpp);
      }
    }

    return NextResponse.json({
      success: true,
      count: bdEventOpps.length,
      bdEventOpps: bdEventOpps.map((opp) => ({
        ...opp,
        eventMeta: candidateEvents.find((e) => e.id === opp.eventMetaId),
      })),
    });
  } catch (error) {
    console.error('❌ BDEventOpp generate error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate BD event opportunities',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

