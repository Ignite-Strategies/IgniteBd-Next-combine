import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { resolveMembership } from '@/lib/membership';
import { VariableCatalogue, resolveVariablesFromDatabase } from '@/lib/services/variableMapperService';

/**
 * POST /api/variables/preview
 *
 * Returns all catalogue variables with their resolved values for a given context.
 * Used by the variable bank UI to show what each {{variable}} will resolve to.
 *
 * Request body:
 * {
 *   "contactId": "uuid",     // optional — for CONTACT variables
 *   "companyHQId": "uuid",   // required — tenant context + senderCompany source
 *   "ownerId": "uuid",       // optional — for OWNER variables (senderName, etc.)
 * }
 *
 * Returns:
 * {
 *   "success": true,
 *   "variables": [
 *     {
 *       "key": "firstName",
 *       "source": "CONTACT",
 *       "description": "Recipient's first name",
 *       "example": "John",
 *       "value": "Sarah",        // resolved value (empty string if not set)
 *       "resolved": true,        // true if value was found
 *     },
 *     ...
 *   ]
 * }
 */
export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { contactId, companyHQId, ownerId } = body ?? {};

    if (!companyHQId) {
      return NextResponse.json({ error: 'companyHQId is required' }, { status: 400 });
    }

    // Verify access
    if (ownerId) {
      const owner = await prisma.owners.findUnique({
        where: { id: ownerId },
        select: { id: true },
      });
      if (owner) {
        const { membership } = await resolveMembership(owner.id, companyHQId);
        if (!membership) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    }

    const context = {
      contactId: contactId || undefined,
      ownerId: ownerId || undefined,
      companyHQId,
    };

    // Resolve all catalogue variables in one pass
    const allKeys = Object.keys(VariableCatalogue);
    const resolvedMap = await resolveVariablesFromDatabase(allKeys, context);

    const variables = allKeys.map((key) => {
      const def = VariableCatalogue[key];
      const value = resolvedMap[key] ?? '';
      return {
        key,
        variable: `{{${key}}}`,
        source: def.source,
        description: def.description,
        example: def.example || '',
        value,
        resolved: value !== '',
      };
    });

    return NextResponse.json({ success: true, variables });
  } catch (error) {
    console.error('❌ Variables preview error:', error);
    return NextResponse.json(
      { error: 'Failed to resolve variables', details: error.message },
      { status: 500 },
    );
  }
}
