import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/contacts/retrieve
 * Retrieve contacts - supports both list and single contact retrieval
 * 
 * Query params:
 * - companyHQId (required for list) - Get all contacts for a companyHQ
 * - contactId (optional) - Get single contact by ID
 * - pipeline (optional) - Filter by pipeline
 * - stage (optional) - Filter by stage
 * 
 * Returns:
 * - For list: { success: true, contacts: [...] }
 * - For single: { success: true, contact: {...} }
 */
export async function GET(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = request.nextUrl;
    const companyHQId = searchParams.get('companyHQId');
    const contactId = searchParams.get('contactId');
    const pipeline = searchParams.get('pipeline');
    const stage = searchParams.get('stage');

    // Single contact retrieval by ID
    if (contactId) {
      console.log('🔍 Fetching contact:', contactId);

      let contact;
      try {
      contact = await prisma.contact.findUnique({
        where: { id: contactId },
        include: {
          pipelines: true,
          companies: true, // Company relation via contactCompanyId
        },
      });
      } catch (prismaError) {
        console.error('❌ Prisma query error:', prismaError);
        console.error('❌ Prisma error name:', prismaError.name);
        console.error('❌ Prisma error message:', prismaError.message);
        console.error('❌ Prisma error code:', prismaError.code);
        console.error('❌ Prisma error stack:', prismaError.stack);
        throw prismaError;
      }

      if (!contact) {
        console.log('❌ Contact not found:', contactId);
        return NextResponse.json(
          { success: false, error: 'Contact not found' },
          { status: 404 },
        );
      }

      console.log('✅ Contact found, serializing...');
      console.log('✅ Contact ID:', contact.id);
      console.log('✅ Contact has pipelines:', !!contact.pipelines);
      console.log('✅ Contact has companies:', !!contact.companies);
      console.log('✅ Contact has careerTimeline:', !!contact.careerTimeline);

      // Safely serialize the contact, handling JSON fields and potential circular references
      try {
        // Use JSON.parse/stringify to ensure clean serialization
        // This handles any potential circular references or non-serializable values
        const serializedContact = JSON.parse(JSON.stringify(contact, (key, value) => {
          // Handle Date objects
          if (value instanceof Date) {
            return value.toISOString();
          }
          // Handle BigInt (if any)
          if (typeof value === 'bigint') {
            return value.toString();
          }
          // Handle undefined (convert to null for JSON)
          if (value === undefined) {
            return null;
          }
          return value;
        }));

        return NextResponse.json({
          success: true,
          contact: serializedContact,
        });
      } catch (serializeError) {
        console.error('❌ Serialization error:', serializeError);
        console.error('❌ Serialization error stack:', serializeError.stack);
        console.error('❌ Contact keys:', Object.keys(contact || {}));
        
        // Try to return a minimal version without problematic fields
        try {
          const { careerTimeline, ...contactWithoutTimeline } = contact;
          const minimalContact = JSON.parse(JSON.stringify(contactWithoutTimeline, (key, value) => {
            if (value instanceof Date) return value.toISOString();
            if (typeof value === 'bigint') return value.toString();
            if (value === undefined) return null;
            return value;
          }));
          
          return NextResponse.json({
            success: true,
            contact: minimalContact,
            warning: 'Some fields may be missing due to serialization issues',
          });
        } catch (fallbackError) {
          console.error('❌ Fallback serialization also failed:', fallbackError);
          throw serializeError; // Re-throw original error
        }
      }
    }

    // List contacts retrieval
    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required for list retrieval' },
        { status: 400 },
      );
    }

    console.log('🔍 Fetching contacts for companyHQId:', companyHQId);

    const where = {
      crmId: companyHQId,
    };

    // Filter by pipeline/stage if provided
    if (pipeline || stage) {
      where.pipelines = {};
      if (pipeline) {
        where.pipelines.pipeline = pipeline;
      }
      if (stage) {
        where.pipelines.stage = stage;
      }
    }

    console.log('🔍 Where clause:', JSON.stringify(where, null, 2));

    let contacts;
    try {
      console.log('🔍 Executing Prisma query...');
      contacts = await prisma.contact.findMany({
        where,
        include: {
          pipelines: true,
          companies: true, // Company relation via contactCompanyId
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      console.log(`✅ Found ${contacts.length} contacts`);
    } catch (prismaError) {
      console.error('❌ Prisma query error:', prismaError);
      console.error('❌ Prisma error name:', prismaError.name);
      console.error('❌ Prisma error message:', prismaError.message);
      console.error('❌ Prisma error code:', prismaError.code);
      console.error('❌ Prisma error stack:', prismaError.stack);
      throw prismaError;
    }

    // Safely serialize contacts, handling JSON fields and potential circular references
    try {
      const serializedContacts = JSON.parse(JSON.stringify(contacts, (key, value) => {
        // Handle Date objects
        if (value instanceof Date) {
          return value.toISOString();
        }
        // Handle BigInt (if any)
        if (typeof value === 'bigint') {
          return value.toString();
        }
        // Handle undefined (convert to null for JSON)
        if (value === undefined) {
          return null;
        }
        return value;
      }));

      // Map companies to contactCompany for backward compatibility
      const mappedContacts = serializedContacts.map(contact => ({
        ...contact,
        contactCompany: contact.companies || null,
      }));

      return NextResponse.json({
        success: true,
        contacts: mappedContacts,
      });
    } catch (serializeError) {
      console.error('❌ Serialization error:', serializeError);
      console.error('❌ Serialization error stack:', serializeError.stack);
      
      // Try to return a minimal version without problematic fields
      try {
        const minimalContacts = contacts.map(contact => {
          const { careerTimeline, enrichmentPayload, ...contactWithoutProblematicFields } = contact;
          const serialized = JSON.parse(JSON.stringify(contactWithoutProblematicFields, (key, value) => {
            if (value instanceof Date) return value.toISOString();
            if (typeof value === 'bigint') return value.toString();
            if (value === undefined) return null;
            return value;
          }));
          // Map companies to contactCompany for backward compatibility
          return {
            ...serialized,
            contactCompany: serialized.companies || null,
          };
        });
        
        return NextResponse.json({
          success: true,
          contacts: minimalContacts,
          warning: 'Some fields may be missing due to serialization issues',
        });
      } catch (fallbackError) {
        console.error('❌ Fallback serialization also failed:', fallbackError);
        throw serializeError; // Re-throw original error
      }
    }
  } catch (error) {
    console.error('❌ RetrieveContacts error:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve contacts',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}

