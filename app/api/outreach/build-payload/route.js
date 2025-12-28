import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { writePayload } from '@/lib/redis';
import { randomUUID } from 'crypto';
import { hydrateTemplate } from '@/lib/templateVariables';

/**
 * POST /api/outreach/build-payload
 * 
 * Step 1: Input → Build Payload → Redis Write
 * 
 * Flow:
 * 1. Auth → verify Firebase token
 * 2. Fetch owner → get owner record
 * 3. Parse request body (to, subject, body, senderEmail, senderName)
 * 4. Build payload → construct SendGrid msg object (ONCE)
 * 5. Write to Redis → store payload blob for preview/send
 * 
 * Returns: requestId for preview/send endpoints
 */
export async function POST(request) {
  console.log('📝 POST /api/outreach/build-payload - Request received');
  
  try {
    // Step 1: Auth
    const firebaseUser = await verifyFirebaseToken(request);
    console.log('✅ Firebase token verified:', { uid: firebaseUser.uid, email: firebaseUser.email });
    
    // Step 2: Fetch owner
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: { id: true },
    });

    if (!owner) {
      console.error('❌ Owner not found for firebaseId:', firebaseUser.uid);
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 }
      );
    }
    console.log('✅ Owner found:', { ownerId: owner.id });

    // Step 3: Parse request body
    const body = await request.json();
    const { 
      to, 
      subject, 
      body: emailBody, 
      senderEmail,
      senderName,
      contactId, 
      tenantId, 
      campaignId,
      sequenceId,
      sequenceStepId,
      templateId, // Optional: if provided, hydrate template into body
    } = body;
    
    console.log('📦 Request body parsed:', {
      to,
      subject,
      bodyLength: emailBody?.length,
      senderEmail,
      hasContactId: !!contactId,
      hasTenantId: !!tenantId,
      hasTemplateId: !!templateId,
    });
    
    // Step 3.5: Handle template hydration if templateId is provided
    let finalSubject = subject;
    let finalBody = emailBody;
    let contactData = {};
    
    if (templateId) {
      console.log('📧 Template ID provided, hydrating template...');
      
      // Fetch template
      const template = await prisma.template.findUnique({
        where: { id: templateId },
        select: { subject: true, body: true },
      });
      
      if (!template) {
        return NextResponse.json(
          { success: false, error: 'Template not found' },
          { status: 404 }
        );
      }
      
      // Fetch contact data if contactId is provided (for variable hydration)
      if (contactId) {
        const contact = await prisma.contact.findUnique({
          where: { id: contactId },
          select: {
            firstName: true,
            lastName: true,
            fullName: true,
            goesBy: true,
            email: true,
            title: true,
            companyName: true,
            companyDomain: true,
            updatedAt: true,
          },
        });
        
        if (contact) {
          contactData = contact;
        }
      }
      
      // Hydrate template subject and body with contact data
      // Template becomes part of the payload JSON (not assigned separately)
      finalSubject = hydrateTemplate(template.subject, contactData, {});
      finalBody = hydrateTemplate(template.body, contactData, {});
      
      console.log('✅ Template hydrated:', {
        originalSubjectLength: template.subject.length,
        originalBodyLength: template.body.length,
        hydratedSubjectLength: finalSubject.length,
        hydratedBodyLength: finalBody.length,
      });
    }
    
    // Validation (minimal - just required fields)
    // Note: If templateId is provided, finalBody will be from template
    if (!to || !finalSubject || !finalBody || !senderEmail) {
      console.error('❌ Missing required fields:', { 
        to: !!to, 
        subject: !!finalSubject, 
        body: !!finalBody, 
        senderEmail: !!senderEmail 
      });
      return NextResponse.json(
        { success: false, error: 'to, subject, body, and senderEmail are required' },
        { status: 400 }
      );
    }

    // Step 4: Build Payload (ONCE - never rebuild)
    console.log('🔨 Step 4: Building SendGrid payload...');
    // Build canonical SendGrid payload (EXACT format)
    // custom_args must be INSIDE personalizations[0], not at top level
    // Template (if used) is already hydrated into finalSubject/finalBody - it's part of the JSON payload
    const msg = {
      personalizations: [
        {
          to: [{ email: to }],
          subject: finalSubject,
          // custom_args goes INSIDE personalizations (SendGrid requirement)
          ...(contactId || tenantId || campaignId || sequenceId || sequenceStepId ? {
            custom_args: {
              ownerId: owner.id.toString(),
              ...(contactId && { contactId: contactId.toString() }),
              ...(tenantId && { tenantId: tenantId.toString() }),
              ...(campaignId && { campaignId: campaignId.toString() }),
              ...(sequenceId && { sequenceId: sequenceId.toString() }),
              ...(sequenceStepId && { sequenceStepId: sequenceStepId.toString() }),
            },
          } : {}),
        },
      ],
      from: {
        email: senderEmail,
        name: senderName || undefined,
      },
      content: [
        {
          type: 'text/html',
          value: finalBody,
        },
      ],
    };

    console.log('📦 Payload built (canonical):', JSON.stringify(msg, null, 2));

    // Step 5: Write payload blob to Redis
    console.log('💾 Step 5: Writing payload to Redis...');
    // This is the EXACT payload that will be sent to SendGrid
    // Saved as JSON string (blob) - will be retrieved unchanged for preview/send
    const requestId = randomUUID();
    try {
      await writePayload(owner.id, requestId, msg);
      console.log('✅ Payload blob saved to Redis:', {
        requestId,
        size: JSON.stringify(msg).length,
        from: msg.from.email,
        to: msg.personalizations[0].to[0].email,
      });
    } catch (redisError) {
      console.error('❌ Redis write error:', redisError.message);
      throw new Error(`Failed to save payload to Redis: ${redisError.message}`);
    }

    console.log('✅ Step 6: Returning success response');
    return NextResponse.json({
      success: true,
      requestId,
      message: 'Payload built and stored',
    });
  } catch (error) {
    console.error('❌ Error building payload:', error);
    console.error('❌ Error stack:', error.stack);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to build payload',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

