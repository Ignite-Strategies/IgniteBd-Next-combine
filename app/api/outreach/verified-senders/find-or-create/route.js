import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { listSenders } from '@/lib/sendgridSendersApi';

/**
 * POST /api/outreach/verified-senders/find-or-create
 * 
 * Find verified senders from SendGrid (NO CREATE - verification must be done in SendGrid dashboard)
 * 1. Check if owner already has a verified sender configured
 * 2. If not, check SendGrid for existing verified senders
 * 3. Return verified senders for selection
 * 
 * Body:
 * - email: (optional) Email to check
 */
export async function POST(request) {
  try {
    const firebaseUser = await verifyFirebaseToken(request);
    const body = await request.json();
    const { email, name } = body || {};

    // Get owner
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: {
        id: true,
        sendgridVerifiedEmail: true,
        sendgridVerifiedName: true,
      },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 }
      );
    }

    // STEP 1: Check if owner already has a verified sender
    if (owner.sendgridVerifiedEmail) {
      // Check if it's still verified in SendGrid
      const sendersResult = await listSenders();
      const allSenders = sendersResult.senders || [];
      
      const existingSender = allSenders.find(
        (s) => (s.from?.email || s.email)?.toLowerCase() === owner.sendgridVerifiedEmail.toLowerCase()
      );

      if (existingSender && existingSender.verified === true) {
        return NextResponse.json({
          success: true,
          action: 'found',
          sender: {
            email: owner.sendgridVerifiedEmail,
            name: owner.sendgridVerifiedName,
            verified: true,
          },
        });
      }
    }

    // STEP 2: Check SendGrid for existing verified senders
    console.log('🔍 Checking SendGrid for verified senders...');
    const sendersResult = await listSenders();
    const allSenders = sendersResult.senders || [];
    
    console.log(`📦 SendGrid returned ${allSenders.length} total senders`);
    if (allSenders.length > 0) {
      console.log('📋 Sample sender structure:', JSON.stringify(allSenders[0], null, 2));
    }
    
    // Filter verified senders - only verified === true
    const verifiedSenders = allSenders.filter(sender => {
      const email = sender.from?.email || sender.email;
      const isVerified = sender.verified === true;
      
      console.log(`  ${email}: verified=${isVerified}`);
      
      return isVerified;
    });
    
    console.log(`✅ Found ${verifiedSenders.length} verified senders`);

    // STEP 3: If email provided, check if it exists in verified senders
    if (email) {
      const matchingSender = verifiedSenders.find(
        (s) => (s.from?.email || s.email)?.toLowerCase() === email.toLowerCase()
      );

      if (matchingSender) {
        // Found in SendGrid - update owner and return
        const senderEmail = matchingSender.from?.email || matchingSender.email;
        const senderName = matchingSender.from?.name || matchingSender.name || name;

        await prisma.owners.update({
          where: { id: owner.id },
          data: {
            sendgridVerifiedEmail: senderEmail,
            sendgridVerifiedName: senderName || null,
          },
        });

        return NextResponse.json({
          success: true,
          action: 'found',
          sender: {
            email: senderEmail,
            name: senderName,
            verified: true,
          },
        });
      }
    }

    // STEP 4: If verified senders exist, return list for selection
    if (verifiedSenders.length > 0) {
      return NextResponse.json({
        success: true,
        action: 'select',
        senders: verifiedSenders.map(sender => ({
          id: sender.id,
          email: sender.from?.email || sender.email,
          name: sender.from?.name || sender.name,
          verified: true,
        })),
      });
    }

    // STEP 5: No verified senders found - user must verify in SendGrid dashboard
    return NextResponse.json({
      success: true,
      action: 'create',
      message: 'No verified senders found. Please add and verify senders in the SendGrid dashboard, then refresh here.',
    });
  } catch (error) {
    console.error('Find-or-create sender error:', error);
    
    // Provide helpful error message for permission issues
    let errorMessage = error.message || 'Failed to find or create sender';
    if (errorMessage.includes('forbidden') || errorMessage.includes('access')) {
      errorMessage = 
        'SendGrid API key permissions issue. ' +
        'Your API key needs "Sender Management" or "Full Access" permissions. ' +
        'Please update your API key in SendGrid Settings → API Keys. ' +
        'Original error: ' + errorMessage;
    }
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

