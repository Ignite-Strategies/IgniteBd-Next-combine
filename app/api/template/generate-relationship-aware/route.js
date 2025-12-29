import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { OpenAI } from 'openai';
import { extractVariableNames } from '@/lib/templateVariables';

// Initialize OpenAI client
let openaiClient = null;

function getOpenAIClient() {
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

export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { 
      relationship, 
      typeOfPerson, 
      whyReachingOut, 
      whatWantFromThem,
      // Template context fields (from template_relationship_helpers model + form extras)
      timeSinceConnected,
      timeHorizon,
      knowledgeOfBusiness,
      myBusinessDescription,
      desiredOutcome,
      contextNotes, // From template_relationship_helpers model
      ownerId, // For getting owner name for signature
    } = body ?? {};

    // Get owner name for signature (if ownerId provided)
    let ownerName = '[Your name]';
    if (ownerId) {
      try {
        const { prisma } = await import('@/lib/prisma');
        const owner = await prisma.owners.findUnique({
          where: { id: ownerId },
          select: { firstName: true, lastName: true, name: true },
        });
        if (owner) {
          ownerName = owner.firstName || owner.name?.split(' ')[0] || '[Your name]';
        }
      } catch (err) {
        console.warn('Could not fetch owner name:', err);
      }
    }

    if (!relationship || !typeOfPerson || !whyReachingOut) {
      return NextResponse.json(
        { error: 'relationship, typeOfPerson, and whyReachingOut are required' },
        { status: 400 },
      );
    }

    // Build logic-based instructions based on relationship context
    let relationshipLogic = '';
    
    // Logic for relationship types
    if (relationship === 'FRIEND_OF_FRIEND' || typeOfPerson === 'FRIEND_OF_FRIEND') {
      relationshipLogic += '- This is a FRIEND: Use casual, warm, personal tone. No business formality.\n';
    }
    
    if (relationship === 'ESTABLISHED') {
      relationshipLogic += '- This is an ESTABLISHED relationship: Write like checking in with a friend. Very casual.\n';
    }
    
    if (relationship === 'DORMANT' || (timeSinceConnected && timeSinceConnected.toLowerCase().includes('long'))) {
      relationshipLogic += '- This is a DORMANT relationship or LONG TIME since contact: MUST acknowledge the gap. Use phrases like "I know it\'s been a long time" or "Haven\'t connected in a while".\n';
    }
    
    if (relationship === 'WARM') {
      relationshipLogic += '- This is a WARM relationship: Reference the prior connection naturally.\n';
    }
    
    if (relationship === 'COLD') {
      relationshipLogic += '- This is a COLD relationship: Friendly but acknowledge it\'s a first contact.\n';
    }

    // Logic for time since connected
    if (timeSinceConnected) {
      relationshipLogic += `- Time since connected: "${timeSinceConnected}" - Use this EXACTLY in the template to acknowledge the gap.\n`;
    }

    // Logic for business knowledge
    if (knowledgeOfBusiness) {
      relationshipLogic += '- They ALREADY KNOW about your business - no need to introduce it, just reference it naturally.\n';
    } else if (myBusinessDescription) {
      relationshipLogic += `- They DON'T KNOW about your business - introduce it naturally: "${myBusinessDescription}"\n`;
    }

    // Logic for desired outcome
    if (desiredOutcome) {
      relationshipLogic += `- Desired outcome: "${desiredOutcome}" - Present this clearly but with low pressure.\n`;
    } else if (whatWantFromThem) {
      relationshipLogic += `- What you want: "${whatWantFromThem}" - Present this clearly but with low pressure.\n`;
    }

    // Logic for time horizon
    if (timeHorizon) {
      relationshipLogic += `- Time horizon: "${timeHorizon}" - Use this when mentioning when you want to connect.\n`;
    }

    // Logic for context notes (from template_relationship_helpers model)
    if (contextNotes) {
      relationshipLogic += `- Additional context: "${contextNotes}" - Use this context to inform the tone and content of the message.\n`;
    }

    const prompt = `You are a Business Development Relationship Manager. Your task is to create a human, low-pressure outreach EMAIL TEMPLATE with DYNAMIC VARIABLES using relationship-aware logic.

=== RELATIONSHIP CONTEXT (from template_relationship_helpers model) ===
Familiarity Level (relationship): ${relationship}
Relationship Type (typeOfPerson): ${typeOfPerson}
Why Reaching Out: ${whyReachingOut}
${whatWantFromThem ? `What Want From Them: ${whatWantFromThem}` : 'What Want From Them: Not specified'}

=== TEMPLATE CONTEXT (from template_relationship_helpers model) ===
${timeSinceConnected ? `Time Since Connected: ${timeSinceConnected}` : 'Time Since Connected: Not specified'}
${timeHorizon ? `Time Horizon: ${timeHorizon}` : 'Time Horizon: Not specified'}
${myBusinessDescription ? `My Business: ${myBusinessDescription}` : 'My Business: Not specified'}
${desiredOutcome ? `Desired Outcome: ${desiredOutcome}` : 'Desired Outcome: Not specified'}
${contextNotes ? `Additional Context Notes: ${contextNotes}` : 'Additional Context Notes: Not specified'}
Knowledge of Business: ${knowledgeOfBusiness ? 'Yes, they know' : 'No, they don\'t know'}

=== RELATIONSHIP-AWARE LOGIC RULES ===
${relationshipLogic}

=== YOUR TASK ===
Create a warm, human, low-pressure outreach message template using VARIABLE TAGS for personalization.

Return ONLY valid JSON in this exact format:
{
  "title": "Template title/name (e.g., 'Reconnecting with {{typeOfPerson}} - {{relationship}}')",
  "subject": "Simple subject line WITHOUT variables (e.g., 'Reaching Out', 'Reconnecting', 'Collaboration in 2026')",
  "content": "The email body template with {{variableName}} tags for dynamic content",
  "suggestedVariables": ["firstName", "companyName", etc.]
}

=== VARIABLE TAG FORMAT ===
Use {{variableName}} ONLY for contact-specific data that will be filled in later from the database.

**CONTACT VARIABLES** (use {{tags}} - these will be filled later):
- {{firstName}} - Contact's first name (ALWAYS use this in greeting, preferred over goesBy for formal contexts)
- {{goesBy}} - Contact's preferred/nickname (use for casual, friendly contexts)
- {{lastName}} - Contact's last name
- {{fullName}} - Contact's full name (computed from firstName + lastName)
- {{companyName}} - Their current company name (use when relevant to context)
- {{title}} - Their job title/role (use when relevant to context)
- {{seniority}} - Their seniority level (e.g., "C-Suite", "VP+", "Director+")
- {{department}} - Their department (use when relevant)
- {{city}} - Their city (use for local events or regional context)
- {{state}} - Their state/region (use for regional context)
- {{country}} - Their country (use for international context)
- {{email}} - Their email address (rarely needed in body, but available)
- {{phone}} - Their phone number (rarely needed in body, but available)
- {{linkedinUrl}} - Their LinkedIn profile URL (use when offering to connect on LinkedIn)

**TEMPLATE CONTEXT** (from template_relationship_helpers model - use provided values DIRECTLY as text, NOT as {{variables}}):
- Relationship Type: "${typeOfPerson}" - Use this to inform tone and approach
- Familiarity Level: "${relationship}" - Use this to determine formality
- Why Reaching Out: "${whyReachingOut}" - BAKE THIS INTO THE CONTENT
- Time Since Connected: "${timeSinceConnected || 'not specified'}" - BAKE THIS INTO THE CONTENT if provided
- Time Horizon: "${timeHorizon || 'soon'}" - BAKE THIS INTO THE CONTENT if provided
- My Business: "${myBusinessDescription || 'not specified'}" - BAKE THIS INTO THE CONTENT if provided
- Desired Outcome: "${desiredOutcome || whatWantFromThem || 'catch up'}" - BAKE THIS INTO THE CONTENT
- Context Notes: "${contextNotes || 'none'}" - Use any additional context notes to inform the message tone and content

=== REQUIREMENTS ===
1. **Title**: Create a simple descriptive title that infers variables (e.g., "Collaboration Outreach to Old Colleague", "Reconnecting with Former Co-worker", "Reaching Out to Prospect"). Keep it under 60 characters. This is for template organization, not the email subject.
2. **Subject**: Create a simple, human email subject line WITHOUT variables. Should relate to the body content. Examples: "Reaching Out", "Reconnecting", "Collaboration in 2026". Do NOT use variables like {{firstName}} in the subject - that's spammy.
3. **Contact Variables Only**: Use {{variableName}} for contact-specific data from the list above (firstName, goesBy, lastName, fullName, companyName, title, seniority, department, city, state, country, email, phone, linkedinUrl). Choose variables that make sense for the context.
4. **Bake in Context**: Time, business description, desired outcome should be PLAIN TEXT (not {{variables}})
5. **Follow Logic Rules**: Apply the relationship-aware logic rules above
6. **Human & Natural**: Write like a real person, not a sales bot
7. **Low Pressure**: Always include a release valve that removes pressure
8. **No Sales Language**: No CTAs, no calendar links, no "let's hop on a call"
9. **Greeting**: Always start with "Hi {{firstName}}," or "Hi {{goesBy}}," (use goesBy for very casual/friendly relationships, firstName for more formal)
10. **Company Context**: Use {{companyName}} when relevant to the conversation
11. **Location Context**: Use {{city}} or {{state}} when mentioning local events or regional topics
12. **Professional Context**: Use {{title}} or {{seniority}} when relevant to the ask or context
13. **Signature**: End with the provided signature: "${ownerName}" (NOT "[Your name]")

=== TEMPLATE STRUCTURE ===
1. **Warm Greeting**: "Hi {{firstName}}," or similar
2. **Acknowledgment**: If DORMANT or long time, acknowledge the gap using timeSinceConnected
3. **Engagement**: Reference whyReachingOut naturally
4. **Context**: If needed, introduce business (if knowledgeOfBusiness is false)
5. **The Ask**: Present desiredOutcome or whatWantFromThem with low pressure
6. **Release Valve**: Include a line that removes pressure
7. **Soft Close**: Friendly closing

=== EXAMPLE OUTPUT ===

If relationship="DORMANT", typeOfPerson="FORMER_COWORKER", timeSinceConnected="a long time", timeHorizon="2026", myBusinessDescription="my own NDA house", desiredOutcome="see if we can collaborate":

{
  "title": "Collaboration Outreach to Old Colleague",
  "subject": "Collaboration in 2026",
  "content": "Hi {{firstName}},\\n\\nI know it's been a long time since we connected. I saw you recently started working at {{companyName}}.\\n\\nNot sure if you knew, but I run my own NDA house.\\n\\nLet's get together in 2026 — see if we can collaborate and get some NDA work from you.\\n\\nNo pressure at all — just wanted to reach out.\\n\\nCheers to what's ahead!\\n\\n${ownerName}",
  "suggestedVariables": ["firstName", "companyName"]
}

If relationship="ESTABLISHED", typeOfPerson="FRIEND_OF_FRIEND", whatWantFromThem="catch up":

{
  "title": "Reconnecting with Friend",
  "subject": "Reconnecting",
  "content": "Hi {{firstName}},\\n\\nHope you're doing well! Been thinking about you and wanted to reach out.\\n\\nWould love to catch up if you're open to it — maybe grab coffee or lunch?\\n\\nNo pressure at all, just thought it'd be nice to reconnect.\\n\\nLet me know if you're interested!\\n\\nCheers,\\n${ownerName}",
  "suggestedVariables": ["firstName"]
}

IMPORTANT: 
- Only use {{variables}} for contact-specific data
- Template context should be BAKED INTO the content as plain text
- Follow the relationship-aware logic rules strictly
- If timeSinceConnected is provided and relationship is DORMANT, you MUST acknowledge the gap

Return ONLY the JSON object, no markdown, no code blocks, no explanation.`;

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that creates relationship-aware email templates with variable tags. Return only valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('No response from AI');
    }

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      // Try to extract JSON from markdown if AI wrapped it
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse AI response as JSON');
      }
    }

    // Validate and ensure required fields
    if (!parsed.content || typeof parsed.content !== 'string') {
      throw new Error('AI response missing content field');
    }

    // Replace [Your name] with actual owner name in content if it exists
    let templateContent = parsed.content;
    if (ownerName && ownerName !== '[Your name]') {
      templateContent = templateContent.replace(/\[Your name\]/g, ownerName);
    }

    // Generate title if not provided (simple descriptive title)
    let title = parsed.title;
    if (!title || typeof title !== 'string') {
      if (whatWantFromThem && whatWantFromThem.toLowerCase().includes('collaboration')) {
        title = relationship === 'DORMANT' ? 'Collaboration Outreach to Old Colleague' : 'Collaboration Outreach';
      } else {
        title = relationship === 'DORMANT' ? 'Reconnecting with Former Colleague' : 'Reaching Out';
      }
    }
    
    // Generate subject if not provided (simple, NO variables)
    let subject = parsed.subject;
    if (!subject || typeof subject !== 'string') {
      if (whatWantFromThem && whatWantFromThem.toLowerCase().includes('collaboration')) {
        subject = 'Collaboration in 2026';
      } else {
        subject = relationship === 'DORMANT' ? 'Reconnecting' : 'Reaching Out';
      }
    }

    // Extract variables from content only (subject has no variables)
    const extractedVariablesFromContent = extractVariableNames(templateContent);
    
    // Merge with AI's suggested variables
    const allVariables = Array.from(
      new Set([
        ...extractedVariablesFromContent,
        ...(parsed.suggestedVariables || [])
      ])
    );

    return NextResponse.json({
      success: true,
      title: title.trim(),
      subject: subject.trim(),
      body: templateContent.trim(), // Map content to body for Template model (with owner name replaced)
      template: templateContent.trim(), // Keep for backward compatibility
      variables: allVariables, // Simple string array
    });
  } catch (error) {
    console.error('❌ Template generate relationship-aware error:', error);
    return NextResponse.json(
      { error: 'Failed to generate relationship-aware template' },
      { status: 500 },
    );
  }
}

