import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

export async function POST(request) {
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

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    const contacts = await prisma.contact.findMany({
      where: {
        crmId: companyHQId,
        email: { not: null },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const emailGroups = {};
    contacts.forEach((contact) => {
      if (contact.email) {
        const email = contact.email.toLowerCase().trim();
        if (!emailGroups[email]) {
          emailGroups[email] = [];
        }
        emailGroups[email].push(contact);
      }
    });

    let deletedCount = 0;
    let keptCount = 0;

    for (const group of Object.values(emailGroups)) {
      if (group.length > 1) {
        const keepContact = group[0];
        keptCount += 1;
        for (let i = 1; i < group.length; i += 1) {
          await prisma.contact.delete({
            where: { id: group[i].id },
          });
          deletedCount += 1;
        }
      } else if (group.length === 1) {
        keptCount += 1;
      }
    }

    console.log(`✅ Cleanup complete: Deleted ${deletedCount} duplicates, kept ${keptCount} unique contacts`);

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      kept: keptCount,
    });
  } catch (error) {
    console.error('❌ CleanupDuplicates error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to cleanup duplicates',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

