import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/keepalive
 * 
 * Lightweight endpoint to wake up Neon database if it's sleeping.
 * Executes a trivial query (SELECT 1) with no side effects.
 * Safe to call repeatedly.
 */
export async function GET() {
  try {
    // Execute trivial query to wake database connection
    await prisma.$queryRaw`SELECT 1`;
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Log error but don't throw - keepalive failures shouldn't break the app
    console.error('❌ Keepalive error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

