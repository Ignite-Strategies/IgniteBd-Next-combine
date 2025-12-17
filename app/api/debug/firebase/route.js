/**
 * Debug endpoint to test Firebase Admin initialization
 * GET /api/debug/firebase
 */

import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebaseAdmin';

export async function GET() {
  try {
    console.log('🔍 Firebase debug check:', {
      hasFirebaseKey: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
      appsLength: admin.apps.length,
      firebaseKeyLength: process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.length || 0,
    });

    if (!admin.apps.length) {
      return NextResponse.json(
        { ok: false, error: 'Firebase admin not initialized. Check FIREBASE_SERVICE_ACCOUNT_KEY.' },
        { status: 500 },
      );
    }

    // Try to list users (limited to 1 for testing)
    const users = await admin.auth().listUsers(1);
    
    return NextResponse.json({
      ok: true,
      message: 'Firebase Admin is working',
      firstUserUid: users.users[0]?.uid || 'No users found',
      totalUsers: users.users.length,
    });
  } catch (error) {
    console.error('🔥 Firebase debug error:', error?.message);
    console.error('Error stack:', error?.stack);
    
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
      { status: 500 },
    );
  }
}

