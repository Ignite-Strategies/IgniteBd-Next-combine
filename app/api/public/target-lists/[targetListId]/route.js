import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';

/**
 * GET /api/public/target-lists/[targetListId]
 * Get contacts for a public target list (no auth)
 * 
 * Query params:
 *   - companyHQId: string (required)
 * 
 * Returns contacts grouped by date
 */
export async function GET(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const companyHQId = searchParams.get('companyHQId');
    
    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    // Await params in Next.js 15+
    const resolvedParams = await params;
    const targetListId = resolvedParams?.targetListId || params?.targetListId;
    
    if (!targetListId) {
      return NextResponse.json(
        { success: false, error: 'targetListId is required' },
        { status: 400 },
      );
    }

    // Calculate week bounds for response (used for both query and response)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(today.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    const todayDateString = today.toISOString().split('T')[0];

    // Get target list data from Redis
    let contactIds = null;
    try {
      const redis = getRedis();
      const redisKey = `target-list:${targetListId}`;
      const storedData = await redis.get(redisKey);
      
      if (storedData) {
        const targetListData = JSON.parse(storedData);
        contactIds = targetListData.contactIds;
      }
    } catch (redisError) {
      console.warn('⚠️ Redis retrieval failed:', redisError);
    }

    // If we have stored contact IDs, use them; otherwise fall back to contacts with nextSendDate this week
    let contacts;
    if (contactIds && contactIds.length > 0) {
      // Get specific contacts from the target list
      contacts = await prisma.contacts.findMany({
        where: {
          id: { in: contactIds },
          companyHQId: companyHQId,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          goesBy: true,
          email: true,
          nextSendDate: true,
        },
        orderBy: {
          nextSendDate: 'asc',
        },
      });
    } else {
      // Fallback: Get contacts for this company that have nextSendDate this week
      contacts = await prisma.contacts.findMany({
        where: {
          companyHQId: companyHQId,
          nextSendDate: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          goesBy: true,
          email: true,
          nextSendDate: true,
        },
        orderBy: {
          nextSendDate: 'asc',
        },
      });
    }

    // Group by date (use today's date if no nextSendDate)
    const contactsByDate = {};
    
    contacts.forEach((contact) => {
      const date = contact.nextSendDate 
        ? new Date(contact.nextSendDate).toISOString().split('T')[0]
        : todayDateString;
      
      if (!contactsByDate[date]) {
        contactsByDate[date] = [];
      }
      contactsByDate[date].push({
        id: contact.id,
        name: contact.goesBy || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || 'Unknown',
        email: contact.email,
        nextSendDate: contact.nextSendDate || null,
      });
    });

    const sortedDates = Object.keys(contactsByDate).sort();

    return NextResponse.json({
      success: true,
      targetListId,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      contactsByDate,
      sortedDates,
      totalContacts: contacts.length,
    });
  } catch (error) {
    console.error('❌ Get public target list error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch target list',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
