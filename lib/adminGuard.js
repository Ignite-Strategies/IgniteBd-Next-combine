import { redirect } from 'next/navigation';
import { prisma } from './prisma';
import { verifyFirebaseToken } from './firebaseAdmin';

/**
 * Admin Route Guard
 * 
 * Checks if user is SuperAdmin, redirects if not
 * Use this in server components or API routes
 */
export async function requireSuperAdmin(request) {
  try {
    const firebaseUser = await verifyFirebaseToken(request);
    const firebaseId = firebaseUser.uid;

    const owner = await prisma.owner.findUnique({
      where: { firebaseId },
      include: {
        superAdmin: true,
      },
    });

    if (!owner) {
      redirect('/growth-dashboard');
    }

    const isSuperAdmin = !!owner.superAdmin; // If SuperAdmin record exists, they're active

    if (!isSuperAdmin) {
      redirect('/growth-dashboard');
    }

    return { owner, isSuperAdmin: true };
  } catch (error) {
    console.error('Admin guard error:', error);
    redirect('/growth-dashboard');
  }
}

