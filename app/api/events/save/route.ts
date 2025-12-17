import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { saveEvent } from '@/lib/services/EventUpsertService';

export async function POST(req: Request) {
  try {
    // Verify authentication
    await verifyFirebaseToken(req);
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { eventSuggestion, userId } = await req.json();

    if (!eventSuggestion || !userId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const saved = await saveEvent(eventSuggestion, userId);
    return NextResponse.json({ success: true, saved });

  } catch (err: any) {
    console.error("Event Save Error:", err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}

