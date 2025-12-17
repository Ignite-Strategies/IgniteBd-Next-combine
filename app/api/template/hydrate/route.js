import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * Deterministic hydration logic for outreach messages
 * This composes a human, low-pressure message from TemplateBase inputs
 */
function hydrateMessage(templateBase) {
  const { whyReachingOut, relationship, whatWantFromThem } = templateBase;

  // Opening - reference whyReachingOut
  const opening = whyReachingOut.trim();

  // Context - neutral sentence based on relationship
  let context = '';
  switch (relationship) {
    case 'COLD':
      context = "I'd love to connect and learn more about what you're working on.";
      break;
    case 'WARM':
      context = "It's been a while since we last connected.";
      break;
    case 'ESTABLISHED':
      context = "I wanted to reach out and see how things are going.";
      break;
    case 'DORMANT':
      context = "I know it's been a while, but I wanted to reconnect.";
      break;
    default:
      context = "I wanted to reach out and say hello.";
  }

  // Release Valve - always include to remove pressure
  const releaseValveOptions = [
    "No agenda — just wanted to check in.",
    "No pressure at all.",
    "Thought I'd reach out and say hello.",
    "Just wanted to touch base — no expectations.",
  ];
  const releaseValve = releaseValveOptions[Math.floor(Math.random() * releaseValveOptions.length)];

  // Optional close - only if whatWantFromThem is provided
  let close = '';
  if (whatWantFromThem && whatWantFromThem.trim() !== '') {
    close = `If you're open to it, ${whatWantFromThem.trim().toLowerCase()}. But again, no pressure — just wanted to put it out there.`;
  } else {
    close = "Hope you're doing well!";
  }

  // Compose message sections
  const sections = {
    opening,
    context,
    releaseValve,
    close,
  };

  // Combine into full message
  const content = [
    opening,
    context,
    releaseValve,
    close,
  ].join(' ');

  return {
    content,
    sections,
  };
}

export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { templateBaseId } = body ?? {};

    if (!templateBaseId) {
      return NextResponse.json(
        { error: 'templateBaseId is required' },
        { status: 400 },
      );
    }

    const templateBase = await prisma.template_bases.findUnique({
      where: { id: templateBaseId },
    });

    if (!templateBase) {
      return NextResponse.json(
        { error: 'TemplateBase not found' },
        { status: 404 },
      );
    }

    const hydrated = hydrateMessage(templateBase);

    return NextResponse.json({
      success: true,
      message: hydrated.content,
      sections: hydrated.sections,
      templateBase,
    });
  } catch (error) {
    console.error('❌ Template hydrate error:', error);
    return NextResponse.json(
      { error: 'Failed to hydrate template' },
      { status: 500 },
    );
  }
}

