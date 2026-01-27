/**
 * GET /api/meetings
 * 
 * Fetch upcoming meetings from Microsoft Graph calendar
 * Matches meetings to contacts by email addresses
 */

import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getCalendarEvents, isMicrosoftConnected } from '@/lib/microsoftGraphClient';

export async function GET(request) {
  try {
    // Verify Firebase token
    const firebaseUser = await verifyFirebaseToken(request);
    
    // Get owner from Firebase ID
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: {
        id: true,
      },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 }
      );
    }

    // Check if Microsoft account is connected (using MicrosoftAccount model)
    const connected = await isMicrosoftConnected(owner.id);
    if (!connected) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Microsoft account not connected',
          connected: false 
        },
        { status: 400 }
      );
    }

    // Get query params for date range
    const { searchParams } = new URL(request.url);
    const daysAhead = parseInt(searchParams.get('daysAhead') || '30', 10);
    
    // Calculate date range (now to N days ahead)
    const startDateTime = new Date().toISOString();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysAhead);
    const endDateTime = endDate.toISOString();

    // Fetch calendar events from Microsoft Graph
    let calendarData;
    try {
      calendarData = await getCalendarEvents(owner.id, {
        startDateTime,
        endDateTime,
        top: 100,
      });
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to fetch calendar events',
          details: error.message 
        },
        { status: 500 }
      );
    }

    const events = calendarData.events || [];

    // Get all contacts for this owner to match against
    const companyHQId = request.headers.get('x-company-hq-id');
    const contactsQuery = {
      where: {
        ownerId: owner.id,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        fullName: true,
      },
    };

    // If companyHQId is provided, filter by it
    if (companyHQId) {
      contactsQuery.where.companyHQId = companyHQId;
    }

    const contacts = await prisma.contact.findMany(contactsQuery);

    // Create email -> contact map for quick lookup
    const emailToContactMap = new Map();
    contacts.forEach(contact => {
      if (contact.email) {
        const emailLower = contact.email.toLowerCase();
        emailToContactMap.set(emailLower, contact);
      }
    });

    // Process events and match to contacts
    const meetings = events
      .filter(event => {
        // Filter out cancelled events
        if (event.isCancelled) return false;
        
        // Only include events with attendees (meetings)
        return event.attendees && event.attendees.length > 0;
      })
      .map(event => {
        // Extract attendee emails
        const attendeeEmails = (event.attendees || [])
          .map(attendee => attendee.emailAddress?.address)
          .filter(Boolean)
          .map(email => email.toLowerCase());

        // Find matching contact by email
        let matchedContact = null;
        for (const email of attendeeEmails) {
          if (emailToContactMap.has(email)) {
            matchedContact = emailToContactMap.get(email);
            break;
          }
        }

        // Parse start/end times
        const startTime = event.start?.dateTime 
          ? new Date(event.start.dateTime) 
          : null;
        const endTime = event.end?.dateTime 
          ? new Date(event.end.dateTime) 
          : null;

        // Format date/time for display
        const formatDate = (date) => {
          if (!date) return null;
          return date.toLocaleDateString('en-US', { 
            weekday: 'short',
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
          });
        };

        const formatTime = (date) => {
          if (!date) return null;
          return date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          });
        };

        return {
          id: event.id,
          subject: event.subject || 'Untitled Meeting',
          startTime: startTime?.toISOString() || null,
          endTime: endTime?.toISOString() || null,
          date: formatDate(startTime),
          time: startTime ? `${formatTime(startTime)} - ${formatTime(endTime)}` : null,
          location: event.location?.displayName || null,
          attendees: event.attendees?.map(a => ({
            name: a.emailAddress?.name || a.emailAddress?.address,
            email: a.emailAddress?.address,
          })) || [],
          // Contact match
          contactId: matchedContact?.id || null,
          contactName: matchedContact?.fullName || matchedContact?.firstName || null,
          // Raw event data for reference
          rawEvent: {
            organizer: event.organizer?.emailAddress?.address,
            webLink: event.webLink,
          },
        };
      })
      .sort((a, b) => {
        // Sort by start time (earliest first)
        if (!a.startTime) return 1;
        if (!b.startTime) return -1;
        return new Date(a.startTime) - new Date(b.startTime);
      });

    return NextResponse.json({
      success: true,
      meetings,
      count: meetings.length,
      connected: true,
    });

  } catch (error) {
    console.error('❌ Meetings API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch meetings',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

