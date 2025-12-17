/**
 * @deprecated This route is maintained for backward compatibility only.
 * Please use the modular routes instead:
 * - GET /api/contacts/retrieve - For retrieving contacts
 * - POST /api/contacts/create - For creating contacts
 * - GET /api/contacts/hydrate - For hydrating contacts with full relations
 */

import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

// Import modular route handlers
import { GET as retrieveGET } from './retrieve/route';
import { POST as createPOST } from './create/route';

/**
 * GET /api/contacts
 * @deprecated Use GET /api/contacts/retrieve instead
 * Delegates to the modular retrieve route for backward compatibility
 */
export async function GET(request) {
  return retrieveGET(request);
}

/**
 * POST /api/contacts
 * @deprecated Use POST /api/contacts/create instead
 * Delegates to the modular create route for backward compatibility
 */
export async function POST(request) {
  return createPOST(request);
}

