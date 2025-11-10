import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/microsoft-graph/send-mail
 * 
 * Server-side route to send email via Microsoft Graph
 * Body should include:
 * - accessToken: Microsoft Graph access token
 * - subject: Email subject
 * - body: Email body
 * - toRecipients: Array of email addresses
 * - ccRecipients (optional): Array of email addresses
 * - bccRecipients (optional): Array of email addresses
 * - contentType (optional): 'HTML' or 'Text', defaults to 'HTML'
 */
export async function POST(request) {
  try {
    // Verify Firebase authentication
    await verifyFirebaseToken(request);

    const body = await request.json();
    const { accessToken, subject, body: emailBody, toRecipients, ccRecipients, bccRecipients, contentType = 'HTML' } = body;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Microsoft Graph access token required' },
        { status: 400 }
      );
    }

    if (!subject || !emailBody || !toRecipients || !Array.isArray(toRecipients)) {
      return NextResponse.json(
        { error: 'Subject, body, and toRecipients are required' },
        { status: 400 }
      );
    }

    // Prepare email message
    const message = {
      message: {
        subject,
        body: {
          contentType,
          content: emailBody,
        },
        toRecipients: toRecipients.map((email) => ({
          emailAddress: {
            address: email,
          },
        })),
        ...(ccRecipients && Array.isArray(ccRecipients) && ccRecipients.length > 0 && {
          ccRecipients: ccRecipients.map((email) => ({
            emailAddress: {
              address: email,
            },
          })),
        }),
        ...(bccRecipients && Array.isArray(bccRecipients) && bccRecipients.length > 0 && {
          bccRecipients: bccRecipients.map((email) => ({
            emailAddress: {
              address: email,
            },
          })),
        }),
      },
    };

    // Send email via Microsoft Graph
    const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error?.message || 'Failed to send email via Microsoft Graph' },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
    });
  } catch (error) {
    console.error('Error sending email via Microsoft Graph:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

