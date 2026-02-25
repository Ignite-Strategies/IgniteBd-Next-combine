import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { writePayload } from '@/lib/redis';
import { randomUUID } from 'crypto';
import { hydrateTemplateFromDatabase } from '@/lib/services/variableMapperService';

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
      toName, // Optional: recipient display name
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
      signatureId, // Optional: if provided, use this signature; otherwise use default
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
    
    // Step 3.5: Handle template content if templateId is provided
    // If template is selected, use template's subject/body as the source content
    let sourceSubject = subject;
    let sourceBody = emailBody;
    
    if (templateId) {
      console.log('📧 Template ID provided, fetching template content...');
      
      // Fetch template
      const template = await prisma.templates.findUnique({
        where: { id: templateId },
        select: { subject: true, body: true },
      });
      
      if (!template) {
        return NextResponse.json(
          { success: false, error: 'Template not found' },
          { status: 404 }
        );
      }
      
      // Use template content as source (body field is single source of truth)
      sourceSubject = template.subject || subject;
      sourceBody = template.body || emailBody;
      
      console.log('✅ Template content loaded:', {
        subjectLength: sourceSubject.length,
        bodyLength: sourceBody.length,
      });
    }
    
    // Step 3.6: ALWAYS hydrate variables in content (regardless of template or manual entry)
    // Body field is single source of truth - variables get resolved from database
    // companyHQId enables same-company snippet logic (omit "as you may remember" when contact is at our company)
    const context = {
      contactId: contactId || undefined,
      contactEmail: undefined, // Will be inferred from 'to' if contactId is missing
      to: to, // Pass 'to' field so variable mapper can extract email if needed
      ownerId: owner.id,
      companyHQId: tenantId || undefined,
    };
    
    // Hydrate variables in subject and body using variable mapper service
    // This is universal - works on ANY content, not just templates
    const finalSubject = await hydrateTemplateFromDatabase(sourceSubject, context, {});
    const finalBody = await hydrateTemplateFromDatabase(sourceBody, context, {});
    
    console.log('✅ Variables hydrated in content:', {
      originalSubjectLength: sourceSubject.length,
      originalBodyLength: sourceBody.length,
      hydratedSubjectLength: finalSubject.length,
      hydratedBodyLength: finalBody.length,
      contactId: contactId || 'none',
      hasTemplate: !!templateId,
    });
    
    // Step 3.7: Append signature to body if available
    // Fetch owner's signature (default or specified one)
    let signature = null;
    if (signatureId) {
      // Fetch specific signature
      signature = await prisma.email_signatures.findFirst({
        where: {
          id: signatureId,
          owner_id: owner.id,
        },
        select: { content: true },
      });
    } else {
      // Fetch default signature
      signature = await prisma.email_signatures.findFirst({
        where: {
          owner_id: owner.id,
          is_default: true,
        },
        select: { content: true },
      });
    }
    
    // Append signature to body if found
    if (signature?.content) {
      finalBody = finalBody + '\n\n' + signature.content;
      console.log('✅ Signature appended to body:', {
        signatureLength: signature.content.length,
        finalBodyLength: finalBody.length,
      });
    }
    
    // Validation (minimal - just required fields)
    // Note: If templateId is provided, finalBody will be from template
    // Note: Signature (if available) has been appended to finalBody
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
          to: [{ 
            email: to,
            ...(toName && { name: toName }),
          }],
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

